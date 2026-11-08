'use client'

import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  List,
  Maximize,
  Minimize,
  Share2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import type { PageFlip } from 'page-flip'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { pageForAnchor } from '@/lib/paginate/anchors'
import { computeLayout, FONT_STEPS } from '@/lib/paginate/layout'
import { paginate } from '@/lib/paginate/paginate'
import type { Anchor, Layout, Pagination } from '@/lib/paginate/types'
import { toDevanagariDigits } from '@/lib/marathi'
import type { ReaderBook } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { Cover, type CoverData } from './Cover'
import { FlipBook } from './FlipBook'
import { ContentsPanel, SettingsPanel, SharePanel } from './Panels'
import { PageView, folio, type PageContext } from './PageView'
import { playFlip } from './sound'
import {
  loadBookmarks,
  loadPosition,
  loadPrefs,
  saveBookmarks,
  savePosition,
  savePrefs,
  type Bookmark,
  type Prefs,
} from './storage'
import { ThumbStrip } from './ThumbStrip'

type PanelId = 'toc' | 'marks' | 'settings' | 'share' | null

interface Props {
  data: ReaderBook
  preview: boolean
  /** 0-based page from `?p=`. */
  initialPage: number | null
}

const ZOOMS = [1, 1.5, 2, 3]
/** Pages further than this from the open spread render as bare paper. */
const LIVE_RADIUS = 5

/** The left page of the spread showing page `i` (or `i` itself when single). */
function spreadLeft(i: number, mode: Layout['mode']): number {
  if (mode === 'single' || i <= 0) return Math.max(0, i)
  return i % 2 === 1 ? i : i - 1
}

function visibleOf(current: number, count: number, mode: Layout['mode']): number[] {
  if (mode === 'single' || current === 0) return [current]
  return current + 1 < count ? [current, current + 1] : [current]
}

/** The page of a spread that stands for it: a chapter opener, else the first page of text. */
function primaryOf(visible: number[], pag: Pagination): number {
  return (
    visible.find((i) => pag.pages[i]?.isOpener) ??
    visible.find((i) => pag.pages[i]?.kind === 'content') ??
    visible.at(-1)!
  )
}

const stripTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export default function Reader({ data, preview, initialPage }: Props) {
  const { book } = data
  const slug = book.slug

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [layout, setLayout] = useState<Layout>(() => computeLayout(window.innerWidth, window.innerHeight))
  const [book$, setBook$] = useState<{ pag: Pagination; layout: Layout; start: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(true)
  const [current, setCurrent] = useState(0)
  const [panel, setPanel] = useState<PanelId>(null)
  const [thumbs, setThumbs] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 })
  const [fullscreen, setFullscreen] = useState(false)
  const [marks, setMarks] = useState<Bookmark[]>(() => loadBookmarks(slug))
  const [resume, setResume] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')

  const apiRef = useRef<PageFlip | null>(null)
  const posRef = useRef<Anchor | null>(null)
  const firstRef = useRef(true)
  const reflowedRef = useRef(false)
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const pag = book$?.pag ?? null
  const pagLayout = book$?.layout ?? layout
  const count = pag?.pages.length ?? 0
  const visible = useMemo(() => visibleOf(current, count, pagLayout.mode), [current, count, pagLayout.mode])

  /* ------------------------------------------------------------ layout */

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const next = computeLayout(window.innerWidth, window.innerHeight)
        setLayout((prev) =>
          prev.mode === next.mode && Math.abs(prev.pageW - next.pageW) < 6 && Math.abs(prev.pageH - next.pageH) < 6 ? prev : next,
        )
      }, 220)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  /* -------------------------------------------------------- pagination */

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    setProgress(0)
    paginate(data, layout, prefs.fontStep, (f) => !cancelled && setProgress(f))
      .then((p) => {
        if (cancelled) return
        let start = 0
        if (firstRef.current) {
          firstRef.current = false
          if (initialPage != null) {
            start = Math.max(0, Math.min(initialPage, p.pages.length - 1))
          } else {
            const saved = loadPosition(slug)
            if (saved) {
              const sp = pageForAnchor(p.pages, saved)
              if (sp > 3 && sp < p.pages.length - 2) setResume(sp)
            }
          }
        } else if (posRef.current) {
          // Re-flowed: back to the same words, wherever they now fall. The
          // remembered position stays put until the reader turns a page, so
          // repeated re-flows don't drift.
          start = pageForAnchor(p.pages, posRef.current)
          reflowedRef.current = true
        }
        start = spreadLeft(start, layout.mode)
        setCurrent(start)
        setBook$({ pag: p, layout, start })
        setBusy(false)
      })
      .catch((err) => {
        console.error('[reader] pagination failed', err)
        setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [data, layout, prefs.fontStep, initialPage, slug])

  /* ------------------------------------------------- reading position */

  useEffect(() => {
    if (!pag) return
    const primary = primaryOf(visible, pag)
    const page = pag.pages[primary]
    if (!page) return
    if (reflowedRef.current) reflowedRef.current = false
    else posRef.current = page.anchor
    if (current > 0) savePosition(slug, posRef.current ?? page.anchor)
    const url = new URL(window.location.href)
    if (current > 0) url.searchParams.set('p', String(primary + 1))
    else url.searchParams.delete('p')
    window.history.replaceState(window.history.state, '', url)
    setAnnounce(
      visible.length === 2
        ? `पाने ${folio(visible[0])} आणि ${folio(visible[1])}, एकूण ${toDevanagariDigits(count)}`
        : `पान ${folio(visible[0])}, एकूण ${toDevanagariDigits(count)}`,
    )
  }, [current, pag, visible, slug, count])

  useEffect(() => {
    if (resume == null) return
    const t = setTimeout(() => setResume(null), 12000)
    return () => clearTimeout(t)
  }, [resume])

  useEffect(() => savePrefs(prefs), [prefs])
  useEffect(() => saveBookmarks(slug, marks), [slug, marks])

  /* -------------------------------------------------------- navigation */

  const goTo = useCallback(
    (i: number) => {
      const pf = apiRef.current
      if (!pf || !pag) return
      const target = Math.max(0, Math.min(i, pag.pages.length - 1))
      const left = spreadLeft(target, pagLayout.mode)
      if (visibleOf(current, count, pagLayout.mode).includes(target)) return
      setCurrent(left)
      if (reducedMotion) pf.turnToPage(target)
      else pf.flip(target)
      if (window.matchMedia('(max-width: 640px)').matches) setPanel(null)
    },
    [pag, pagLayout.mode, current, count, reducedMotion],
  )

  const next = useCallback(() => {
    const pf = apiRef.current
    if (!pf || pf.getState() !== 'read') return
    if (reducedMotion) {
      const last = visibleOf(current, count, pagLayout.mode).at(-1)!
      if (last + 1 < count) {
        pf.turnToPage(last + 1)
        setCurrent(spreadLeft(last + 1, pagLayout.mode))
      }
    } else pf.flipNext()
  }, [current, count, pagLayout.mode, reducedMotion])

  const prev = useCallback(() => {
    const pf = apiRef.current
    if (!pf || pf.getState() !== 'read') return
    if (reducedMotion) {
      if (current > 0) {
        const t = spreadLeft(current - 1, pagLayout.mode)
        pf.turnToPage(t)
        setCurrent(t)
      }
    } else pf.flipPrev()
  }, [current, pagLayout.mode, reducedMotion])

  const onFlip = useCallback((i: number) => setCurrent(spreadLeft(i, pagLayout.mode)), [pagLayout.mode])
  const soundRef = useRef(prefs.sound)
  soundRef.current = prefs.sound
  const onState = useCallback((s: string) => {
    if (s === 'flipping' && soundRef.current) playFlip()
  }, [])

  /* ------------------------------------------------------------ chrome */

  const pinned = !!panel || thumbs || !pag || resume != null
  const pinnedRef = useRef(pinned)
  pinnedRef.current = pinned
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const poke = useCallback(() => {
    setChrome(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!pinnedRef.current) setChrome(false)
    }, 3400)
  }, [])

  useEffect(() => {
    if (pinned) {
      setChrome(true)
      clearTimeout(hideTimer.current)
    } else poke()
  }, [pinned, poke])

  useEffect(() => {
    let last = 0
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const now = performance.now()
      if (now - last < 120) return
      last = now
      poke()
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [poke])

  /* -------------------------------------------------------------- zoom */

  const setScale = useCallback((s: number) => {
    const clamped = Math.max(1, Math.min(3, s))
    setZoom((z) => (clamped === 1 ? { s: 1, x: 0, y: 0 } : { ...z, s: clamped }))
  }, [])
  const zoomStep = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom.s - 0.01)
    setScale(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + dir))])
  }

  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoom((z) => {
        const s = Math.max(1, Math.min(3, z.s * Math.exp(-e.deltaY * 0.01)))
        return s <= 1.01 ? { s: 1, x: 0, y: 0 } : { ...z, s }
      })
    }
    // Pinch: two fingers zoom the book instead of folding a page.
    let pinch: { d: number; s: number } | null = null
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation()
        e.preventDefault()
        pinch = { d: dist(e.touches), s: zoomRef.current }
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.stopPropagation()
        e.preventDefault()
        const s = Math.max(1, Math.min(3, (pinch.s * dist(e.touches)) / pinch.d))
        setZoom((z) => (s <= 1.02 ? { s: 1, x: 0, y: 0 } : { ...z, s }))
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    el.addEventListener('touchend', onTouchEnd, { capture: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart, { capture: true })
      el.removeEventListener('touchmove', onTouchMove, { capture: true })
      el.removeEventListener('touchend', onTouchEnd, { capture: true })
    }
  }, [])
  const zoomRef = useRef(1)
  zoomRef.current = zoom.s

  const pan = useRef<{ x: number; y: number; zx: number; zy: number; id: number } | null>(null)

  /* -------------------------------------------------------- fullscreen */

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  /* --------------------------------------------------------- bookmarks */

  const markedPages = useMemo(() => {
    if (!pag) return new Set<number>()
    return new Set(marks.map((b) => pageForAnchor(pag.pages, b.anchor)))
  }, [marks, pag])
  const isMarked = visible.some((i) => markedPages.has(i))

  const toggleMark = () => {
    if (!pag) return
    if (isMarked) {
      setMarks((m) => m.filter((b) => !visible.includes(pageForAnchor(pag.pages, b.anchor))))
      return
    }
    const i = visible.find((v) => pag.pages[v].kind === 'content') ?? visible.at(-1)!
    const page = pag.pages[i]
    const ch = page.chapter != null ? data.chapters[page.chapter] : null
    const snippet = page.html ? stripTags(page.html.replace(/<div class="opener[\s\S]*?<\/h2>/, '')).slice(0, 90) + '…' : ''
    setMarks((m) => [
      ...m,
      {
        anchor: page.anchor,
        label: ch ? ch.article.title : page.kind === 'toc' ? 'अनुक्रमणिका' : book.title,
        snippet: snippet || `पान ${folio(i)}`,
        at: Date.now(),
      },
    ])
  }

  /* ---------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'Escape') {
        if (panel) setPanel(null)
        else if (thumbs) setThumbs(false)
        else if (zoom.s > 1) setScale(1)
        return
      }
      if (panel) return
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          prev()
          break
        case 'Home':
          e.preventDefault()
          goTo(0)
          break
        case 'End':
          e.preventDefault()
          goTo(count - 1)
          break
        case '+':
        case '=':
          zoomStep(1)
          break
        case '-':
          zoomStep(-1)
          break
        default:
          return
      }
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ------------------------------------------------- tap & click zones */

  const down = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = down.current
    down.current = null
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
    const target = e.target as HTMLElement
    const goto = target.closest('[data-goto]') as HTMLElement | null
    if (goto) {
      goTo(Number(goto.dataset.goto))
      return
    }
    const a = target.closest('a[href]') as HTMLAnchorElement | null
    if (a) {
      if (e.pointerType !== 'mouse') window.open(a.href, '_blank', 'noopener')
      return
    }
    const host = e.currentTarget
    const x = e.clientX
    // Let a corner click the library handles finish first.
    setTimeout(() => {
      const pf = apiRef.current
      if (!pf || pf.getState() !== 'read') return
      const r = host.getBoundingClientRect()
      const fx = (x - r.left) / r.width
      if (fx < 0.26) prev()
      else if (fx > 0.74) next()
      else if (e.pointerType !== 'mouse') {
        if (chrome) {
          clearTimeout(hideTimer.current)
          if (!pinnedRef.current) setChrome(false)
        } else poke()
      }
    }, 40)
  }

  /* ------------------------------------------------------------ render */

  const cover: CoverData = useMemo(
    () => ({
      book,
      leadImage: data.chapters.find((c) => c.article.heroImage)?.article.heroImage ?? null,
      lines: data.chapters.slice(0, 3).map((c) => ({ title: c.article.title, kicker: c.article.kicker })),
    }),
    [book, data.chapters],
  )

  const ctx: PageContext | null = useMemo(
    () => (pag ? { data, pag, layout: pagLayout, cover } : null),
    [data, pag, pagLayout, cover],
  )

  const renderPage = (i: number) =>
    ctx ? (
      <PageView
        ctx={ctx}
        index={i}
        page={ctx.pag.pages[i]}
        dormant={Math.abs(i - current) > LIVE_RADIUS}
        bookmarked={markedPages.has(i)}
      />
    ) : null

  const spread = pagLayout.mode === 'spread'
  const closed = spread && pag ? (current === 0 ? 'front' : current === count - 1 ? 'back' : null) : null
  const shift = closed === 'front' ? -pagLayout.pageW / 2 : closed === 'back' ? pagLayout.pageW / 2 : 0
  // On a desktop the bars are reserved space; on a phone they float over the page.
  const offsetY = window.innerWidth >= 640 ? (56 - 64) / 2 : 0

  const primary = pag ? primaryOf(visible, pag) : 0
  const primaryPage = pag?.pages[primary]
  const chapterTitle =
    primaryPage?.chapter != null ? data.chapters[primaryPage.chapter].article.title : primaryPage?.kind === 'toc' ? 'अनुक्रमणिका' : ''
  const pageLabel = visible.length === 2 ? `पाने ${folio(visible[0])}–${folio(visible[1])}` : `पान ${folio(visible[0])}`
  const shareUrl = `${window.location.origin}/read/${slug}${primary > 0 ? `?p=${primary + 1}` : ''}`
  const [scrub, setScrub] = useState<number | null>(null)
  const sliderVal = scrub ?? current
  const pct = count > 1 ? (sliderVal / (count - 1)) * 100 : 0

  return (
    <div
      className="reader"
      data-theme={prefs.theme}
      data-chrome={chrome ? 'shown' : 'hidden'}
      style={{ '--accent': book.accentColor } as CSSProperties}
    >
      <a href="#linear-text" className="sr-only-focusable" style={{ position: 'absolute', zIndex: 60, top: 8, left: 8, background: '#fff', padding: 8 }}>
        मजकूर साध्या स्वरूपात वाचा
      </a>
      <div className="sr-only" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {announce}
      </div>

      {/* ------------------------------------------------------------ stage */}
      <div className="reader-stage" ref={stageRef} style={{ transform: `translateY(${offsetY}px)` }}>
        <div
          className="reader-zoom"
          data-panning={pan.current ? 'true' : 'false'}
          style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` }}
        >
          {pag && ctx ? (
            <div
              className="book-host"
              data-closed={closed ?? undefined}
              data-mode={pagLayout.mode}
              style={{ transform: `translateX(${shift}px)` }}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
            >
              <FlipBook
                instanceKey={pag.key}
                layout={pagLayout}
                count={count}
                startPage={book$!.start}
                isHard={(i) => !!pag.pages[i]?.hard}
                renderPage={renderPage}
                onFlip={onFlip}
                onState={onState}
                apiRef={apiRef}
                reducedMotion={reducedMotion}
              />
            </div>
          ) : (
            <div className="book-host" data-closed={layout.mode === 'spread' ? undefined : undefined} data-mode="single">
              <div className="page page--cover" style={{ width: layout.pageW, height: layout.pageH, boxShadow: '0 20px 50px -20px rgb(0 0 0 / .45)' }}>
                <Cover {...cover} />
              </div>
            </div>
          )}
        </div>
        {zoom.s > 1 && (
          <div
            className="pan-layer"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              pan.current = { x: e.clientX, y: e.clientY, zx: zoom.x, zy: zoom.y, id: e.pointerId }
            }}
            onPointerMove={(e) => {
              const p = pan.current
              if (!p || p.id !== e.pointerId) return
              setZoom((z) => ({ ...z, x: p.zx + (e.clientX - p.x), y: p.zy + (e.clientY - p.y) }))
            }}
            onPointerUp={() => (pan.current = null)}
            onDoubleClick={() => setScale(1)}
            title="ओढून पाहा · दोनदा क्लिक करून मूळ आकार"
          />
        )}
      </div>

      {(!pag || busy) && (
        <div className="loading-veil" style={pag ? { placeItems: 'end center', paddingBottom: 90 } : undefined}>
          <div className="loading-card" style={pag ? { background: 'var(--chrome-bg)', padding: '10px 16px', borderRadius: 12 } : { marginTop: layout.pageH * 0.9 }}>
            <span>पाने जुळवत आहोत…</span>
            <div className="loading-bar">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ top bar */}
      <header className="chrome chrome--top" onPointerDown={(e) => e.stopPropagation()}>
        <Link href={preview ? `/admin/books/${book.id}` : '/'} className="ibtn" aria-label={preview ? 'संपादनाकडे परत' : 'ग्रंथालयात परत'}>
          <ArrowLeft />
        </Link>
        <div className="chrome-title">
          <b>
            {book.title}
            {preview && book.status !== 'published' && (
              <span
                style={{
                  display: 'inline-block',
                  marginLeft: 8,
                  padding: '1px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  background: 'var(--accent)',
                  color: '#fff',
                  verticalAlign: 2,
                }}
              >
                पूर्वावलोकन · {STATUS_LABEL[book.status]}
              </span>
            )}
          </b>
          <span>{book.subtitle ?? ''}</span>
        </div>
        <button className="ibtn" aria-label="अनुक्रमणिका" aria-pressed={panel === 'toc'} onClick={() => setPanel(panel === 'toc' ? null : 'toc')}>
          <List />
        </button>
        <button className="ibtn" aria-label={isMarked ? 'खूण काढा' : 'हे पान खूण करा'} aria-pressed={isMarked} onClick={toggleMark} disabled={!pag}>
          {isMarked ? <BookmarkCheck /> : <BookmarkIcon />}
        </button>
        <button className="ibtn hide-sm" aria-label="पानांचे लघुरूप" aria-pressed={thumbs} onClick={() => setThumbs((t) => !t)} disabled={!pag}>
          <GalleryHorizontal />
        </button>
        <button
          className="ibtn"
          aria-label="वाचन सेटिंग्ज"
          aria-pressed={panel === 'settings'}
          onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
        >
          <Type />
        </button>
        <button className="ibtn" aria-label="शेअर करा" aria-pressed={panel === 'share'} onClick={() => setPanel(panel === 'share' ? null : 'share')}>
          <Share2 />
        </button>
        <button className="ibtn hide-sm" aria-label={fullscreen ? 'पूर्ण स्क्रीन बंद' : 'पूर्ण स्क्रीन'} onClick={toggleFullscreen}>
          {fullscreen ? <Minimize /> : <Maximize />}
        </button>
      </header>

      {/* --------------------------------------------------------- bottom bar */}
      <footer className="chrome chrome--bottom" onPointerDown={(e) => e.stopPropagation()}>
        <button className="ibtn" aria-label="मागील पान" onClick={prev} disabled={!pag || current === 0}>
          <ChevronLeft />
        </button>
        <div className="slider-wrap">
          <div className="slider-meta">
            <b>
              {scrub != null ? `पान ${folio(scrub)}` : pageLabel}
              <span style={{ fontWeight: 400, color: 'var(--chrome-muted)' }}> / {toDevanagariDigits(count || 0)}</span>
            </b>
            <span>{scrub != null ? (pag?.pages[scrub]?.chapter != null ? data.chapters[pag.pages[scrub].chapter!].article.title : '') : chapterTitle}</span>
          </div>
          <input
            type="range"
            className="slider"
            min={0}
            max={Math.max(0, count - 1)}
            value={sliderVal}
            style={{ '--pct': `${pct}%` } as CSSProperties}
            aria-label="पानावर जा"
            aria-valuetext={pageLabel}
            disabled={!pag}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={() => {
              if (scrub != null) goTo(scrub)
              setScrub(null)
            }}
            onKeyUp={(e) => {
              if (scrub != null && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) {
                goTo(scrub)
                setScrub(null)
              }
            }}
            onBlur={() => setScrub(null)}
          />
        </div>
        <div className="zoom-pill hide-sm">
          <button className="ibtn" aria-label="लहान करा" onClick={() => zoomStep(-1)} disabled={zoom.s <= 1}>
            <ZoomOut />
          </button>
          <span>{toDevanagariDigits(Math.round(zoom.s * 100))}%</span>
          <button className="ibtn" aria-label="मोठे करा" onClick={() => zoomStep(1)} disabled={zoom.s >= 3}>
            <ZoomIn />
          </button>
        </div>
        <button className="ibtn" aria-label="पुढील पान" onClick={next} disabled={!pag || visible.at(-1)! >= count - 1}>
          <ChevronRight />
        </button>
      </footer>

      <AnimatePresence>{thumbs && ctx && <ThumbStrip key="thumbs" ctx={ctx} visible={visible} onGo={goTo} />}</AnimatePresence>

      <AnimatePresence>
        {(panel === 'toc' || panel === 'marks') && pag && (
          <ContentsPanel
            key="toc"
            data={data}
            pag={pag}
            current={current}
            visible={visible}
            bookmarks={marks}
            initialTab={panel === 'marks' ? 'marks' : 'toc'}
            onGo={goTo}
            onRemoveBookmark={(b) => setMarks((m) => m.filter((x) => x.at !== b.at))}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'settings' && (
          <SettingsPanel
            key="settings"
            prefs={prefs}
            busy={busy}
            onChange={(p) =>
              setPrefs((old) => ({
                ...old,
                ...p,
                fontStep: Math.max(0, Math.min(FONT_STEPS.length - 1, p.fontStep ?? old.fontStep)),
              }))
            }
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'share' && (
          <SharePanel key="share" url={shareUrl} title={`${book.title}${chapterTitle ? ` — ${chapterTitle}` : ''}`} pageLabel={pageLabel} onClose={() => setPanel(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resume != null && pag && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span>मागच्या वेळी आपण पान {folio(resume)} वर होता</span>
            <button
              onClick={() => {
                goTo(resume)
                setResume(null)
              }}
            >
              पुढे वाचा
            </button>
            <button className="plain" onClick={() => setResume(null)} aria-label="बंद करा">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The whole text, linear, for screen readers and keyboard users. */}
      <section id="linear-text" tabIndex={-1} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        <h1>{book.title}</h1>
        {data.chapters.map((c) => (
          <article key={c.id}>
            <h2>{c.article.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: c.article.contentHtml.replace(/<img[^>]*>/g, '') }} />
          </article>
        ))}
      </section>
    </div>
  )
}
