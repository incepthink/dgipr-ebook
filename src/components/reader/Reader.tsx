'use client'

import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  GalleryHorizontal,
  Headphones,
  List,
  Maximize,
  Minimize,
  Search,
  Share2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import type { PageFlip } from 'page-flip'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { encodeAnchor, pageForAnchor } from '@/lib/paginate/anchors'
import { computeLayout, FONT_STEPS } from '@/lib/paginate/layout'
import { paginate } from '@/lib/paginate/paginate'
import type { Anchor, Layout, Pagination } from '@/lib/paginate/types'
import { toDevanagariDigits } from '@/lib/marathi'
import type { ReaderBook } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { Cover, type CoverData } from './Cover'
import { FlipBook } from './FlipBook'
import { buildTextChapters } from './bookText'
import { ContentsPanel, SettingsPanel, SharePanel } from './Panels'
import { PageView, folio, type PageContext } from './PageView'
import { ListenBar, MorePanel, NotePanel, SearchPanel } from './ReaderPanels'
import { playFlip } from './sound'
import {
  loadBookmarks,
  loadHighlights,
  loadPosition,
  loadPrefs,
  saveBookmarks,
  saveHighlights,
  savePosition,
  savePrefs,
  type Bookmark,
  type Highlight,
  type Prefs,
} from './storage'
import { TextReader } from './TextReader'
import { ThumbStrip } from './ThumbStrip'
import { createSync, mergeBookmarks, mergeHighlights } from './sync'
import { useReadAloud } from './useReadAloud'

type PanelId = 'toc' | 'marks' | 'hl' | 'settings' | 'share' | 'search' | 'more' | null

/** The signed-in reader's saved state for this book, loaded on the server. */
export interface ReaderAccount {
  signedIn: boolean
  progress: { anchor: Anchor } | null
  bookmarks: Bookmark[]
  highlights: Highlight[]
}

interface Props {
  data: ReaderBook
  preview: boolean
  /** 0-based page from `?p=`. */
  initialPage: number | null
  /** An exact place from `?at=c.b.o` (a bookmark, or "continue reading"). */
  initialAnchor?: Anchor | null
  /** `?mode=text`: open in the easy-reading view (links from highlights). */
  initialMode?: 'text' | null
  /** `?find=`: from a search result; open at the first paragraph of that article containing it. */
  initialFind?: string | null
  account?: ReaderAccount
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

export default function Reader({ data, preview, initialPage, initialAnchor: atParam = null, initialMode = null, initialFind = null, account }: Props) {
  const { book } = data
  const slug = book.slug
  const signedIn = !!account?.signedIn && !preview
  const syncRef = useRef<ReturnType<typeof createSync> | null>(null)
  if (signedIn && !syncRef.current) syncRef.current = createSync(book.id)

  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p = loadPrefs()
    return initialMode === 'text' ? { ...p, mode: 'text' } : p
  })
  const textMode = prefs.mode === 'text'
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
  const [marks, setMarks] = useState<Bookmark[]>(() =>
    signedIn ? mergeBookmarks(loadBookmarks(slug), account!.bookmarks) : loadBookmarks(slug),
  )
  const [resume, setResume] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')
  const [highlights, setHighlights] = useState<Highlight[]>(() =>
    signedIn ? mergeHighlights(loadHighlights(slug), account!.highlights) : loadHighlights(slug),
  )
  const [noteId, setNoteId] = useState<string | null>(null)

  /* --------------------------------------------- easy-reading (text) view */

  const textChapters = useMemo(() => buildTextChapters(data), [data])
  const textBlocks = useMemo(() => textChapters.flatMap((c) => c.blocks), [textChapters])
  // A search result names the article; the word itself picks the paragraph.
  const initialAnchor = useMemo<Anchor | null>(() => {
    if (!atParam || !initialFind) return atParam
    const needle = initialFind.toLowerCase()
    const hit = textBlocks.find((t) => t.c === atParam.c && t.text.toLowerCase().includes(needle))
    return hit ? { c: hit.c, b: hit.b, o: Math.max(0, hit.text.toLowerCase().indexOf(needle)) } : atParam
    // Once, at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const titles = useMemo(() => data.chapters.map((c) => c.article.title), [data.chapters])
  // Where the text view opens: an explicit place, else the account's, else this device's.
  const startAnchor = useMemo<Anchor>(
    () => initialAnchor ?? (signedIn ? account?.progress?.anchor : null) ?? loadPosition(slug) ?? { c: 0, b: 0, o: 0 },
    // Read once, at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [textAnchor, setTextAnchor] = useState<Anchor>(() => (startAnchor.c < 0 ? { c: 0, b: 0, o: 0 } : startAnchor))
  const [jump, setJump] = useState<{ anchor: Anchor; nonce: number; flash?: boolean; smooth?: boolean } | null>(() =>
    textMode ? { anchor: startAnchor.c < 0 ? { c: 0, b: 0, o: 0 } : startAnchor, nonce: 1 } : null,
  )
  const lastChapter = data.chapters.length - 1
  const jumpTo = useCallback(
    (anchor: Anchor, opts: { flash?: boolean; smooth?: boolean } = {}) => {
      // Front and back matter have no text view of their own: the first or last article stands in.
      const a = anchor.c < 0 ? { c: 0, b: 0, o: 0 } : anchor.c > lastChapter ? { c: lastChapter, b: 0, o: 0 } : anchor
      setJump((j) => ({ anchor: a, nonce: (j?.nonce ?? 0) + 1, ...opts }))
    },
    [lastChapter],
  )

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
          } else if (initialAnchor) {
            start = pageForAnchor(p.pages, initialAnchor)
          } else {
            // The account's place wins: it may come from another device.
            const saved = (signedIn ? account?.progress?.anchor : null) ?? loadPosition(slug)
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
    // The account state and anchor are read once, on the first pagination only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layout, prefs.fontStep, initialPage, slug])

  /* ------------------------------------------------- reading position */

  const textModeRef = useRef(textMode)
  textModeRef.current = textMode
  useEffect(() => {
    // In the easy-reading view the scroll position is the reading position.
    if (!pag || textModeRef.current) return
    const primary = primaryOf(visible, pag)
    const page = pag.pages[primary]
    if (!page) return
    if (reflowedRef.current) reflowedRef.current = false
    else posRef.current = page.anchor
    if (current > 0) {
      savePosition(slug, posRef.current ?? page.anchor)
      syncRef.current?.progress({
        anchor: posRef.current ?? page.anchor,
        page: primary + 1,
        pageCount: count,
        finished: visible.includes(count - 1),
      })
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('at')
    url.searchParams.delete('mode')
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
  useEffect(() => {
    saveBookmarks(slug, marks)
    syncRef.current?.bookmarks(marks)
  }, [slug, marks])

  useEffect(() => {
    saveHighlights(slug, highlights)
    syncRef.current?.highlights(highlights)
  }, [slug, highlights])

  // The easy-reading view reports the paragraph at the top of the screen.
  const onTextPosition = useCallback(
    (a: Anchor) => {
      setTextAnchor(a)
      posRef.current = a
      savePosition(slug, a)
      const page = pag ? pageForAnchor(pag.pages, a) : 0
      const lastBlocks = textChapters[lastChapter]?.blocks.length ?? 1
      syncRef.current?.progress({
        anchor: a,
        page: page + 1,
        pageCount: Math.max(count, 1),
        finished: a.c === lastChapter && a.b >= lastBlocks - 2,
      })
      const url = new URL(window.location.href)
      url.searchParams.delete('p')
      url.searchParams.set('at', encodeAnchor(a))
      window.history.replaceState(window.history.state, '', url)
    },
    [slug, pag, count, textChapters, lastChapter],
  )

  // Leaving the tab or the book: send the last place right away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') syncRef.current?.flush(true)
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      syncRef.current?.flush(true)
    }
  }, [])

  /* -------------------------------------------------------- navigation */

  const goTo = useCallback(
    (i: number) => {
      // Contents, bookmarks and thumbnails speak in pages; the text view scrolls to the same words.
      if (textModeRef.current) {
        const a = pag?.pages[Math.max(0, Math.min(i, (pag?.pages.length ?? 1) - 1))]?.anchor
        if (a) jumpTo(a, { smooth: true })
        if (window.matchMedia('(max-width: 640px)').matches) setPanel(null)
        return
      }
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
    [pag, pagLayout.mode, current, count, reducedMotion, jumpTo],
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

  // The text view keeps its bars: there is no page to tap to bring them back.
  const pinned = textMode || !!panel || thumbs || !pag || resume != null
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
  const sameBlock = (a: { c: number; b: number }, b: { c: number; b: number }) => a.c === b.c && a.b === b.b
  const isMarked = textMode ? marks.some((m) => sameBlock(m.anchor, textAnchor)) : visible.some((i) => markedPages.has(i))

  const toggleMark = () => {
    if (textMode) {
      // In the text view a bookmark marks the paragraph at the top of the screen.
      if (isMarked) return setMarks((m) => m.filter((b) => !sameBlock(b.anchor, textAnchor)))
      const block = textBlocks.find((t) => sameBlock(t, textAnchor))
      setMarks((m) => [
        ...m,
        {
          anchor: { ...textAnchor, o: 0 },
          label: titles[textAnchor.c] ?? book.title,
          snippet: block?.text ? block.text.slice(0, 90) + (block.text.length > 90 ? '…' : '') : book.title,
          at: Date.now(),
        },
      ])
      return
    }
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
      // Arrows, space and Page keys scroll the text view as usual.
      if (panel || textMode) return
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
  const [scrub, setScrub] = useState<number | null>(null)
  const sliderVal = scrub ?? current
  const pct = count > 1 ? (sliderVal / (count - 1)) * 100 : 0

  /* ------------------------------------------------------ the article now */

  // The article being read, in either view: what "share" and "listen" start from.
  const hereAnchor: Anchor = textMode ? textAnchor : (primaryPage?.anchor ?? { c: 0, b: 0, o: 0 })
  const hereChapter = textMode ? textAnchor.c : (primaryPage?.chapter ?? null)
  const hereTitle = hereChapter != null && hereChapter >= 0 ? (titles[hereChapter] ?? '') : ''

  // Sharing sends a link to this article (stable across devices and font sizes), never the book file.
  const shareUrl =
    hereChapter != null && hereChapter >= 0 && hereChapter <= lastChapter
      ? `${window.location.origin}/read/${slug}?at=${hereChapter}.0.0`
      : `${window.location.origin}/read/${slug}`

  /* ------------------------------------------------------------ modes */

  const setMode = (mode: 'book' | 'text') => {
    if (mode === prefs.mode) return
    if (mode === 'text') {
      jumpTo(posRef.current ?? hereAnchor)
      setThumbs(false)
    } else if (pag) {
      // Back to the book on the page holding the same words.
      const page = pageForAnchor(pag.pages, textAnchor)
      const left = spreadLeft(page, pagLayout.mode)
      apiRef.current?.turnToPage(page)
      setCurrent(left)
    }
    setResume(null)
    setPanel(null)
    setPrefs((p) => ({ ...p, mode }))
  }

  /** Go to an exact place (search hit, highlight) in whichever view is open. */
  const goAnchor = (a: Anchor) => {
    if (textMode) jumpTo(a, { flash: true, smooth: true })
    else if (pag) goTo(pageForAnchor(pag.pages, a))
    if (window.matchMedia('(max-width: 640px)').matches) setPanel(null)
  }

  /* -------------------------------------------------------- read aloud */

  const [listening, setListening] = useState(false)
  const speech = useReadAloud(textBlocks, prefs.rate, (block) => {
    // Follow along: the text view scrolls itself; the book turns to the page.
    if (!textModeRef.current && pag) {
      const page = pageForAnchor(pag.pages, { c: block.c, b: block.b, o: 0 })
      if (!visibleOf(current, count, pagLayout.mode).includes(page)) goTo(page)
    }
  })
  const speakingBlock = speech.index >= 0 ? textBlocks[speech.index] : null
  const startListening = () => {
    const a = hereAnchor.c < 0 ? { c: 0, b: 0, o: 0 } : hereAnchor
    const i = textBlocks.findIndex((t) => t.c > a.c || (t.c === a.c && t.b >= a.b))
    setListening(true)
    setPanel(null)
    speech.playFrom(i < 0 ? 0 : i)
  }
  const stopListening = () => {
    speech.stop()
    setListening(false)
  }

  /* -------------------------------------------------------- highlights */

  const addHighlight = (h: Omit<Highlight, 'id' | 'at' | 'note'>, thenNote: boolean) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    setHighlights((list) => [...list, { ...h, id, note: '', at: Date.now() }])
    if (thenNote) setNoteId(id)
  }
  const updateHighlight = (id: string, patch: Partial<Highlight>) => setHighlights((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  const removeHighlight = (id: string) => setHighlights((list) => list.filter((h) => h.id !== id))
  const noteHighlight = noteId ? highlights.find((h) => h.id === noteId) : null

  const openPanel = (p: PanelId) => setPanel((cur) => (cur === p ? null : p))

  return (
    <div
      className="reader"
      data-theme={prefs.theme}
      data-mode={prefs.mode}
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

      {textMode && (
        <TextReader
          chapters={textChapters}
          fontScale={FONT_STEPS[prefs.fontStep]}
          highlights={highlights}
          jump={jump}
          speaking={speakingBlock ? { c: speakingBlock.c, b: speakingBlock.b } : null}
          onPosition={onTextPosition}
          onAddHighlight={addHighlight}
          onUpdateHighlight={updateHighlight}
          onRemoveHighlight={removeHighlight}
          onEditNote={setNoteId}
        />
      )}

      {!textMode && (!pag || busy) && (
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
          <span>{textMode ? hereTitle || (book.subtitle ?? '') : (book.subtitle ?? '')}</span>
        </div>
        {/* Phones show four: mode, contents, bookmark, more. Wider screens show them all. */}
        <button
          className={`ibtn mode-btn${textMode ? ' is-on' : ''}`}
          aria-label={textMode ? 'पुस्तक रूपात वाचा' : 'सोपे वाचन: मोठी अक्षरे, स्क्रोल करून वाचा'}
          title={textMode ? 'पुस्तक रूप' : 'सोपे वाचन'}
          onClick={() => setMode(textMode ? 'book' : 'text')}
        >
          {textMode ? <BookOpen /> : <BookOpenText />}
          <span className="mode-label">{textMode ? 'पुस्तक' : 'सोपे वाचन'}</span>
        </button>
        <button className="ibtn hide-sm" aria-label="पुस्तकात शोधा" aria-pressed={panel === 'search'} onClick={() => openPanel('search')}>
          <Search />
        </button>
        {speech.supported && (
          <button className="ibtn hide-sm" aria-label="ऐका" aria-pressed={listening} onClick={() => (listening ? stopListening() : startListening())}>
            <Headphones />
          </button>
        )}
        <button className="ibtn" aria-label="अनुक्रमणिका" aria-pressed={panel === 'toc'} onClick={() => openPanel('toc')}>
          <List />
        </button>
        <button
          className="ibtn"
          aria-label={isMarked ? 'खूण काढा' : textMode ? 'हा परिच्छेद खूण करा' : 'हे पान खूण करा'}
          aria-pressed={isMarked}
          onClick={toggleMark}
          disabled={!textMode && !pag}
        >
          {isMarked ? <BookmarkCheck /> : <BookmarkIcon />}
        </button>
        {!textMode && (
          <button className="ibtn hide-sm" aria-label="पानांचे लघुरूप" aria-pressed={thumbs} onClick={() => setThumbs((t) => !t)} disabled={!pag}>
            <GalleryHorizontal />
          </button>
        )}
        <button className="ibtn hide-sm" aria-label="वाचन सेटिंग्ज" aria-pressed={panel === 'settings'} onClick={() => openPanel('settings')}>
          <Type />
        </button>
        <button className="ibtn hide-sm" aria-label="हा लेख शेअर करा" aria-pressed={panel === 'share'} onClick={() => openPanel('share')}>
          <Share2 />
        </button>
        {!textMode && (
          <button className="ibtn hide-sm" aria-label={fullscreen ? 'पूर्ण स्क्रीन बंद' : 'पूर्ण स्क्रीन'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize /> : <Maximize />}
          </button>
        )}
        <button className="ibtn show-sm" aria-label="अधिक पर्याय" aria-pressed={panel === 'more'} onClick={() => openPanel('more')}>
          <EllipsisVertical />
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

      <AnimatePresence>{thumbs && !textMode && ctx && <ThumbStrip key="thumbs" ctx={ctx} visible={visible} onGo={goTo} />}</AnimatePresence>

      <AnimatePresence>
        {(panel === 'toc' || panel === 'marks' || panel === 'hl') && pag && (
          <ContentsPanel
            key="toc"
            data={data}
            pag={pag}
            current={textMode ? pageForAnchor(pag.pages, textAnchor) : current}
            visible={textMode ? [pageForAnchor(pag.pages, textAnchor)] : visible}
            bookmarks={marks}
            highlights={highlights}
            initialTab={panel === 'marks' ? 'marks' : panel === 'hl' ? 'hl' : 'toc'}
            onGo={goTo}
            onGoAnchor={(a) => {
              // Highlights live in the text view: open it there.
              if (!textMode) setMode('text')
              jumpTo(a, { flash: true, smooth: textMode })
              setPanel(null)
            }}
            onRemoveBookmark={(b) => setMarks((m) => m.filter((x) => x.at !== b.at))}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'search' && (
          <SearchPanel
            key="search"
            blocks={textBlocks}
            titles={titles}
            onGo={(a) => goAnchor(a)}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'more' && (
          <MorePanel
            key="more"
            textMode={textMode}
            canListen={speech.supported}
            onClose={() => setPanel(null)}
            onPick={(what) => {
              if (what === 'mode') setMode(textMode ? 'book' : 'text')
              else if (what === 'listen') startListening()
              else if (what === 'thumbs') {
                setPanel(null)
                setThumbs(true)
              } else setPanel(what)
            }}
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
          <SharePanel
            key="share"
            url={shareUrl}
            title={hereTitle ? `${hereTitle} — ${book.title}` : book.title}
            pageLabel={hereTitle ? 'हा लेख' : 'हे पुस्तक'}
            onClose={() => setPanel(null)}
          />
        )}
        {noteHighlight && (
          <NotePanel
            key={`note-${noteHighlight.id}`}
            highlight={noteHighlight}
            onSave={(note) => {
              updateHighlight(noteHighlight.id, { note })
              setNoteId(null)
            }}
            onRemove={() => {
              removeHighlight(noteHighlight.id)
              setNoteId(null)
            }}
            onClose={() => setNoteId(null)}
          />
        )}
      </AnimatePresence>

      {(listening || speech.status !== 'idle') && (
        <ListenBar
          status={speech.status}
          title={speakingBlock ? (titles[speakingBlock.c] ?? '') : hereTitle}
          rate={prefs.rate}
          voiceLang={speech.voiceLang}
          raised={!textMode}
          onPlay={() => (speech.status === 'paused' ? speech.resume() : startListening())}
          onPause={speech.pause}
          onSkip={speech.skip}
          onRate={(rate) => setPrefs((p) => ({ ...p, rate }))}
          onClose={stopListening}
        />
      )}

      <AnimatePresence>
        {resume != null && pag && !textMode && !panel && !listening && (
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
