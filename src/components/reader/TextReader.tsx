'use client'

import { Check, Copy, NotebookPen, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { toDevanagariDigits } from '@/lib/marathi'
import type { Anchor } from '@/lib/paginate/types'
import type { TextChapter } from './bookText'
import type { Highlight, HighlightColor } from './storage'

export const HL_COLORS: { id: HighlightColor; label: string }[] = [
  { id: 'yellow', label: 'पिवळा' },
  { id: 'green', label: 'हिरवा' },
  { id: 'blue', label: 'निळा' },
  { id: 'pink', label: 'गुलाबी' },
]

interface Props {
  chapters: TextChapter[]
  fontScale: number
  highlights: Highlight[]
  /** Scroll here when `nonce` changes; `flash` briefly marks the block. */
  jump: { anchor: Anchor; nonce: number; flash?: boolean; smooth?: boolean } | null
  speaking: { c: number; b: number } | null
  onPosition: (a: Anchor) => void
  onAddHighlight: (h: Omit<Highlight, 'id' | 'at' | 'note'>, thenNote: boolean) => void
  onUpdateHighlight: (id: string, patch: Partial<Highlight>) => void
  onRemoveHighlight: (id: string) => void
  onEditNote: (id: string) => void
}

/** Wraps characters [start, end) of a block's text in <mark>, across inline tags. */
function markRange(block: HTMLElement, h: Highlight) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  let pos = 0
  for (const node of nodes) {
    const len = node.data.length
    const from = Math.max(h.start, pos)
    const to = Math.min(h.end, pos + len)
    if (from < to) {
      let target = node
      if (from > pos) target = target.splitText(from - pos)
      if (to < pos + len) target.splitText(to - from)
      const mark = document.createElement('mark')
      mark.className = `hl hl--${h.color}${h.note ? ' hl--note' : ''}`
      mark.dataset.hl = h.id
      target.parentNode!.insertBefore(mark, target)
      mark.appendChild(target)
    }
    pos += len
  }
}

/** Character offset of a point inside a block, counted the way markRange counts. */
function offsetIn(block: HTMLElement, node: Node, offset: number): number {
  const r = document.createRange()
  r.selectNodeContents(block)
  r.setEnd(node, offset)
  return r.toString().length
}

type Pop =
  | { kind: 'new'; c: number; b: number; start: number; end: number; text: string; x: number; y: number }
  | { kind: 'existing'; id: string; x: number; y: number }

export function TextReader({
  chapters,
  fontScale,
  highlights,
  jump,
  speaking,
  onPosition,
  onAddHighlight,
  onUpdateHighlight,
  onRemoveHighlight,
  onEditNote,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const articles = useRef<(HTMLElement | null)[]>([])
  const [pop, setPop] = useState<Pop | null>(null)
  const [copied, setCopied] = useState(false)

  // Fill each article once, then re-apply highlights whenever they change.
  useLayoutEffect(() => {
    chapters.forEach((ch, c) => {
      const el = articles.current[c]
      if (!el) return
      el.innerHTML = ch.html
      for (const h of highlights.filter((x) => x.c === c).sort((a, b) => a.start - b.start)) {
        const block = el.querySelector<HTMLElement>(`[data-b="${h.b}"]`)
        if (block) markRange(block, h)
      }
    })
  }, [chapters, highlights])

  // The block being read aloud.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    root.querySelectorAll('.tr-speaking').forEach((e) => e.classList.remove('tr-speaking'))
    if (!speaking) return
    const el = articles.current[speaking.c]?.querySelector<HTMLElement>(`[data-b="${speaking.b}"]`)
    if (!el) return
    el.classList.add('tr-speaking')
    const r = el.getBoundingClientRect()
    if (r.top < 70 || r.bottom > window.innerHeight - 140) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [speaking, highlights])

  // Jumps: opening at a place, contents, search results, bookmarks.
  useLayoutEffect(() => {
    if (!jump) return
    const art = articles.current[jump.anchor.c]
    if (!art) return
    const el = art.querySelector<HTMLElement>(`[data-b="${Math.max(0, jump.anchor.b)}"]`) ?? art
    el.scrollIntoView({ block: jump.anchor.b <= 0 ? 'start' : 'center', behavior: jump.smooth ? 'smooth' : 'auto' })
    if (jump.flash) {
      el.classList.remove('tr-flash')
      void el.offsetWidth
      el.classList.add('tr-flash')
    }
  }, [jump])

  // Report the first block still on screen: this is "where I am".
  const report = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onScroll = useCallback(() => {
    setPop((p) => (p?.kind === 'existing' ? null : p))
    clearTimeout(report.current)
    report.current = setTimeout(() => {
      const top = 64
      for (let c = 0; c < articles.current.length; c++) {
        const art = articles.current[c]
        if (!art) continue
        const ar = art.getBoundingClientRect()
        if (ar.bottom < top) continue
        for (const el of Array.from(art.querySelectorAll<HTMLElement>(':scope > [data-b]'))) {
          if (el.getBoundingClientRect().bottom > top + 8) {
            onPosition({ c, b: Number(el.dataset.b), o: 0 })
            return
          }
        }
      }
    }, 250)
  }, [onPosition])

  // Selecting text inside one paragraph offers the highlight toolbar.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onSel = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !sel.rangeCount) return setPop((p) => (p?.kind === 'new' ? null : p))
        const range = sel.getRangeAt(0)
        const startEl = (range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement)?.closest<HTMLElement>('[data-b]')
        if (!startEl || !scroller.current?.contains(startEl)) return
        const b = Number(startEl.dataset.b)
        const art = startEl.closest<HTMLElement>('[data-c]')
        if (!art || b < 1 || startEl.tagName === 'FIGURE') return
        const c = Number(art.dataset.c)
        const start = offsetIn(startEl, range.startContainer, range.startOffset)
        // A selection running past this paragraph is clipped to it.
        const end = startEl.contains(range.endContainer) ? offsetIn(startEl, range.endContainer, range.endOffset) : (startEl.textContent ?? '').length
        const text = (startEl.textContent ?? '').slice(start, end)
        if (end - start < 2 || !text.trim()) return
        const rect = range.getBoundingClientRect()
        setPop({ kind: 'new', c, b, start, end, text, x: rect.left + rect.width / 2, y: rect.bottom })
      }, 300)
    }
    document.addEventListener('selectionchange', onSel)
    return () => {
      clearTimeout(t)
      document.removeEventListener('selectionchange', onSel)
    }
  }, [])

  const onClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest<HTMLElement>('mark.hl')
    if (mark && window.getSelection()?.isCollapsed !== false) {
      const r = mark.getBoundingClientRect()
      setPop({ kind: 'existing', id: mark.dataset.hl!, x: r.left + r.width / 2, y: r.bottom })
    }
  }

  const clearSelection = () => window.getSelection()?.removeAllRanges()

  const add = (color: HighlightColor, thenNote = false) => {
    if (pop?.kind !== 'new') return
    // A new highlight replaces any it overlaps in the same paragraph.
    for (const h of highlights) if (h.c === pop.c && h.b === pop.b && h.start < pop.end && pop.start < h.end) onRemoveHighlight(h.id)
    onAddHighlight({ c: pop.c, b: pop.b, start: pop.start, end: pop.end, text: pop.text, color }, thenNote)
    clearSelection()
    setPop(null)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* the native menu still offers copy */
    }
  }

  const existing = pop?.kind === 'existing' ? highlights.find((h) => h.id === pop.id) : null

  return (
    <div className="tr" ref={scroller} onScroll={onScroll} onClick={onClick} onPointerDown={(e) => e.stopPropagation()}>
      <div className="tr-col" style={{ '--fs': `${Math.round(18 * fontScale)}px` } as CSSProperties}>
        {chapters.map((ch, c) => (
          <section key={c} className="tr-chapter">
            <div className="tr-num" aria-hidden>
              लेख {toDevanagariDigits(c + 1)} / {toDevanagariDigits(chapters.length)}
            </div>
            <article
              className="tr-article flow"
              data-c={c}
              ref={(el) => {
                articles.current[c] = el
              }}
            />
          </section>
        ))}
        <div className="tr-end">◆ पुस्तक पूर्ण ◆</div>
      </div>

      {pop && (pop.kind === 'new' || existing) && (
        <div
          className="tr-pop"
          role="toolbar"
          aria-label="ठळक करा"
          style={{ left: Math.max(8, Math.min(window.innerWidth - 8, pop.x)), top: Math.min(window.innerHeight - 70, pop.y + 10) }}
          onPointerDown={(e) => e.preventDefault()}
        >
          {HL_COLORS.map((col) => (
            <button
              key={col.id}
              className={`tr-swatch hl--${col.id}`}
              aria-label={`${col.label} रंगाने ठळक करा`}
              aria-pressed={existing?.color === col.id}
              onClick={() => (existing ? (onUpdateHighlight(existing.id, { color: col.id }), setPop(null)) : add(col.id))}
            />
          ))}
          <button
            className="tr-tool"
            aria-label="नोंद लिहा"
            onClick={() => {
              if (existing) {
                onEditNote(existing.id)
                setPop(null)
              } else add('yellow', true)
            }}
          >
            <NotebookPen size={18} />
          </button>
          <button className="tr-tool" aria-label="कॉपी करा" onClick={() => void copy(existing ? existing.text : pop.kind === 'new' ? pop.text : '')}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          {existing && (
            <button
              className="tr-tool"
              aria-label="ठळक काढा"
              onClick={() => {
                onRemoveHighlight(existing.id)
                setPop(null)
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            className="tr-tool"
            aria-label="बंद करा"
            onClick={() => {
              clearSelection()
              setPop(null)
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
