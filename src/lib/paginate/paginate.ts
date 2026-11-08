/**
 * Typesets a book into pages, in the browser.
 *
 * Blocks are poured into an off-screen page body styled exactly like the real
 * one. When a block overflows, a paragraph is cut at the last word boundary
 * that fits (Devanagari breaks only at spaces, so a conjunct is never split),
 * lists and quotes are cut between items, and photos are shrunk to the space
 * left or carried to the next page. Headings never end a page; a paragraph
 * leaves at least two lines on each side of a page break.
 */
import type { ReaderBook } from '../types'
import { buildChapterBlocks } from './blocks'
import { computeGeometry, layoutKey } from './layout'
import { BACK, FRONT, type Anchor, type Geometry, type Layout, type Page, type Pagination, type TocItem } from './types'

interface Item {
  node: HTMLElement
  b: number
  o: number
}

const TEXT_SPLIT = new Set(['P', 'LI'])
const CONTAINER_SPLIT = new Set(['UL', 'OL', 'BLOCKQUOTE'])
const HEADINGS = new Set(['H2', 'H3'])

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0))

/* ------------------------------------------------------------ measuring */

class Measure {
  readonly page: HTMLElement
  readonly flow: HTMLElement
  readonly scratch: HTMLElement
  readonly avail: number

  constructor(layout: Layout, g: Geometry, extraClass = 'page--content') {
    this.page = document.createElement('div')
    this.page.className = `page ${extraClass} reader-measure`
    this.page.setAttribute('aria-hidden', 'true')
    applyVars(this.page, pageVars(layout, g))
    const body = document.createElement('div')
    body.className = 'page-body'
    this.flow = document.createElement('div')
    this.flow.className = 'flow'
    body.appendChild(this.flow)
    this.scratch = document.createElement('div')
    this.scratch.className = 'flow'
    this.scratch.style.cssText = 'position:absolute;left:0;right:0;top:0'
    body.appendChild(this.scratch)
    this.page.appendChild(body)
    document.body.appendChild(this.page)
    this.avail = g.bodyH
  }

  /** Height the flow's content occupies, ignoring the last block's bottom margin. */
  used(): number {
    const last = this.flow.lastElementChild as HTMLElement | null
    if (!last) return 0
    return last.getBoundingClientRect().bottom - this.flow.getBoundingClientRect().top
  }

  fits(): boolean {
    return this.used() <= this.avail + 0.5
  }

  destroy() {
    this.page.remove()
  }
}

/** `Object.assign(el.style, …)` silently drops custom properties; setProperty doesn't. */
function applyVars(el: HTMLElement, vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
}

export function pageVars(layout: Layout, g: Geometry): Record<string, string> {
  return {
    width: `${layout.pageW}px`,
    height: `${layout.pageH}px`,
    '--fs': `${g.fs}px`,
    '--pad-x': `${g.padX}px`,
    '--pad-t': `${g.padT}px`,
    '--pad-b': `${g.padB}px`,
    '--body-h': `${g.bodyH}px`,
  } as Record<string, string>
}

/* ------------------------------------------------------------- splitting */

function textNodes(root: Node): Text[] {
  const out: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text)
  return out
}

function setBoundary(range: Range, root: HTMLElement, nodes: Text[], offset: number, which: 'start' | 'end') {
  let acc = 0
  for (const t of nodes) {
    const len = t.data.length
    if (offset <= acc + len) {
      if (which === 'start') range.setStart(t, offset - acc)
      else range.setEnd(t, offset - acc)
      return
    }
    acc += len
  }
  if (which === 'start') range.setStart(root, root.childNodes.length)
  else range.setEnd(root, root.childNodes.length)
}

/** The element's content between two character offsets, inline markup intact. */
function slice(el: HTMLElement, start: number, end: number): HTMLElement {
  const nodes = textNodes(el)
  const range = document.createRange()
  setBoundary(range, el, nodes, start, 'start')
  setBoundary(range, el, nodes, end, 'end')
  const out = el.cloneNode(false) as HTMLElement
  out.appendChild(range.cloneContents())
  return out
}

function trimEnd(el: HTMLElement) {
  const nodes = textNodes(el)
  for (let i = nodes.length - 1; i >= 0; i--) {
    nodes[i].data = nodes[i].data.replace(/\s+$/, '')
    if (nodes[i].data) break
  }
}

function lineHeight(el: HTMLElement): number {
  const lh = parseFloat(getComputedStyle(el).lineHeight)
  return Number.isFinite(lh) && lh > 0 ? lh : parseFloat(getComputedStyle(el).fontSize) * 1.74
}

function lines(el: HTMLElement): number {
  return Math.round(el.getBoundingClientRect().height / lineHeight(el))
}

interface Split {
  head: HTMLElement
  tail: HTMLElement
  /** Characters of the original that went into the head. */
  consumed: number
}

/**
 * Cut a paragraph (or list item) so its head fills the page. `parent` is where
 * the head is tried — the flow, or a list being split.
 */
function splitText(m: Measure, el: HTMLElement, parent: HTMLElement, pageEmpty: boolean): Split | null {
  const text = el.textContent ?? ''
  const cuts: number[] = []
  for (let i = 1; i < text.length; i++) if (text[i - 1] === ' ' && text[i] !== ' ') cuts.push(i)
  if (!cuts.length) return null

  const tryHead = (k: number) => {
    const head = slice(el, 0, k)
    trimEnd(head)
    head.classList.add('split-head')
    parent.appendChild(head)
    const ok = m.fits()
    return { head, ok }
  }

  // Largest cut whose head fits.
  let lo = 0
  let hi = cuts.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const { head, ok } = tryHead(cuts[mid])
    head.remove()
    if (ok) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (best < 0) return null

  let k = cuts[best]
  let { head } = tryHead(k)
  const headLines = lines(head)
  head.remove()
  // Orphan: a lone line at the foot of a page goes over with its paragraph.
  if (headLines < 2 && !pageEmpty) return null

  // Widow: a lone line at the head of the next page pulls one line back with it.
  const tail = slice(el, k, text.length)
  m.scratch.appendChild(tail)
  const tailLines = lines(tail)
  tail.remove()
  if (tailLines < 2 && headLines >= 3) {
    const lh = lineHeight(el)
    const target = (headLines - 1) * lh + 1
    for (let i = best - 1; i >= 0; i--) {
      const h = slice(el, 0, cuts[i])
      trimEnd(h)
      h.classList.add('split-head')
      parent.appendChild(h)
      const height = h.getBoundingClientRect().height
      h.remove()
      if (height <= target) {
        k = cuts[i]
        break
      }
    }
  }

  head = slice(el, 0, k)
  trimEnd(head)
  head.classList.add('split-head')
  const rest = slice(el, k, text.length)
  rest.classList.remove('split-head', 'lede')
  rest.classList.add('split-tail')
  return { head, tail: rest, consumed: k }
}

/** Cut a list or quote between its children, splitting the child at the cut if it's text. */
function splitContainer(m: Measure, el: HTMLElement, pageEmpty: boolean): Split | null {
  const kids = Array.from(el.children) as HTMLElement[]
  const head = el.cloneNode(false) as HTMLElement
  head.classList.add('split-head')
  m.flow.appendChild(head)
  let consumed = 0
  for (let j = 0; j < kids.length; j++) {
    const c = kids[j].cloneNode(true) as HTMLElement
    head.appendChild(c)
    if (m.fits()) {
      consumed += kids[j].textContent?.length ?? 0
      continue
    }
    c.remove()
    let tailFirst: HTMLElement | null = null
    if (TEXT_SPLIT.has(kids[j].tagName)) {
      const s = splitText(m, kids[j], head, pageEmpty && j === 0)
      if (s) {
        head.appendChild(s.head)
        tailFirst = s.tail
        consumed += s.consumed
      }
    }
    head.remove()
    if (!head.children.length) return null
    const tail = el.cloneNode(false) as HTMLElement
    tail.classList.add('split-tail')
    if (tailFirst) tail.appendChild(tailFirst)
    for (const k of kids.slice(j + 1)) tail.appendChild(k.cloneNode(true))
    if (el.tagName === 'OL') {
      const start = Number(el.getAttribute('start') ?? 1)
      tail.setAttribute('start', String(start + j))
    }
    return { head, tail, consumed }
  }
  head.remove()
  return null
}

/**
 * A photo that doesn't fit: shrink it into the space left (cropping a little
 * if it must) or, on a fresh page, scale it down whole.
 */
function fitFigure(m: Measure, fig: HTMLElement, pageEmpty: boolean): boolean {
  const im = fig.querySelector('img') as HTMLImageElement | null
  if (!im) return false
  const ratio = Number(im.dataset.ratio) || 4 / 3
  const natural = m.flow.clientWidth / ratio

  // Everything on the page plus the figure's caption and margins — the photo gets what's left.
  im.style.height = '0px'
  im.style.aspectRatio = 'auto'
  m.flow.appendChild(fig)
  const room = Math.floor(m.avail - m.used())
  fig.remove()

  const reset = () => {
    im.style.height = ''
    im.style.aspectRatio = `${ratio}`
    im.classList.remove('fit-cover', 'fit-contain')
  }

  if (pageEmpty) {
    const h = Math.max(60, Math.min(natural, room))
    im.style.height = `${h}px`
    im.style.aspectRatio = `${ratio}`
    im.classList.add('fit-contain')
    m.flow.appendChild(fig)
    return true
  }
  if (room >= Math.max(natural * 0.55, m.avail * 0.26, 90)) {
    im.style.height = `${room}px`
    im.classList.add('fit-cover')
    m.flow.appendChild(fig)
    if (m.fits()) return true
    fig.remove()
  }
  reset()
  return false
}

/* ------------------------------------------------------------- the flow */

interface FlowPage {
  html: string
  anchor: Anchor
  isOpener: boolean
}

/** Typeset one chapter's blocks into pages. */
function flowChapter(m: Measure, c: number, blocks: HTMLElement[]): FlowPage[] {
  const pages: FlowPage[] = []
  const queue: Item[] = blocks.map((node, b) => ({ node, b, o: 0 }))
  let placed: Item[] = []

  const close = () => {
    // A heading never ends a page: carry it over with what follows.
    const carry: Item[] = []
    while (placed.length > 1 && HEADINGS.has(placed[placed.length - 1].node.tagName)) {
      const h = placed.pop()!
      h.node.remove()
      carry.unshift(h)
    }
    if (placed.length) {
      pages.push({
        html: m.flow.innerHTML,
        anchor: { c, b: placed[0].b, o: placed[0].o },
        isOpener: placed[0].b === 0 && placed[0].node.classList.contains('opener'),
      })
    }
    m.flow.innerHTML = ''
    placed = []
    queue.unshift(...carry)
  }

  let guard = 0
  while (queue.length) {
    if (++guard > 20000) throw new Error('pagination did not converge')
    const item = queue.shift()!
    const empty = placed.length === 0
    m.flow.appendChild(item.node)
    if (m.fits()) {
      placed.push(item)
      continue
    }
    item.node.remove()

    const tag = item.node.tagName
    // The closing "०००" and sign-off are not worth a page of their own.
    if (item.node.matches('p.endmark, p.signoff') && !empty) continue
    if (tag === 'FIGURE' && !item.node.classList.contains('opener-hero')) {
      if (fitFigure(m, item.node, empty)) {
        placed.push(item)
        if (empty) close()
        continue
      }
      close()
      queue.unshift(item)
      continue
    }

    let split: Split | null = null
    if (TEXT_SPLIT.has(tag)) split = splitText(m, item.node, m.flow, empty)
    else if (CONTAINER_SPLIT.has(tag)) split = splitContainer(m, item.node, empty)
    if (split) {
      m.flow.appendChild(split.head)
      placed.push({ node: split.head, b: item.b, o: item.o })
      close()
      queue.unshift({ node: split.tail, b: item.b, o: item.o + split.consumed })
      continue
    }

    if (empty) {
      // Taller than a page and unsplittable: it gets the page to itself.
      m.flow.appendChild(item.node)
      placed.push(item)
      close()
      continue
    }
    close()
    queue.unshift(item)
  }
  close()
  return pages
}

/** How many contents pages, and which entries go on each. */
function flowToc(layout: Layout, g: Geometry, items: TocItem[], titles: string[], kickers: (string | null)[]): TocItem[][] {
  const m = new Measure(layout, g, 'page--toc')
  m.page.innerHTML = ''
  const toc = document.createElement('div')
  toc.className = 'toc'
  m.page.appendChild(toc)
  const pages: TocItem[][] = []
  let current: TocItem[] = []

  const start = (first: boolean) => {
    toc.innerHTML = ''
    if (first) {
      const head = document.createElement('div')
      head.className = 'toc-head'
      head.innerHTML = '<h2>अनुक्रमणिका</h2><span>०००</span>'
      toc.appendChild(head)
    }
  }
  const fits = () => {
    const last = toc.lastElementChild as HTMLElement | null
    if (!last) return true
    return last.getBoundingClientRect().bottom <= toc.getBoundingClientRect().bottom - bottomPad(toc) + 0.5
  }

  start(true)
  for (const it of items) {
    const node = document.createElement('div')
    if (it.type === 'section') {
      node.className = 'toc-section'
      node.textContent = it.label
    } else {
      node.className = 'toc-entry'
      node.innerHTML = `<span class="toc-num">००</span><span class="toc-title"></span><span class="toc-pg">०००</span>`
      const t = node.querySelector('.toc-title')!
      if (kickers[it.chapter]) {
        const s = document.createElement('small')
        s.textContent = kickers[it.chapter]
        t.appendChild(s)
      }
      t.appendChild(document.createTextNode(titles[it.chapter]))
    }
    toc.appendChild(node)
    if (fits() || !current.length) {
      current.push(it)
      continue
    }
    node.remove()
    // A section label never ends a page.
    const carry: TocItem[] = []
    if (current.length > 1 && current[current.length - 1].type === 'section') carry.push(current.pop()!)
    pages.push(current)
    start(false)
    current = [...carry]
    for (const c of carry) {
      const n = document.createElement('div')
      n.className = 'toc-section'
      n.textContent = (c as { label: string }).label
      toc.appendChild(n)
    }
    toc.appendChild(node)
    current.push(it)
  }
  if (current.length || !pages.length) pages.push(current)
  m.destroy()
  return pages
}

function bottomPad(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).paddingBottom) || 0
}

/* ------------------------------------------------------------- the book */

const cache = new Map<string, Pagination>()

export function paginationKey(data: ReaderBook, layout: Layout, fontStep: number): string {
  return `${data.book.id}:${data.book.updatedAt}:${data.chapters.length}:${layoutKey(layout)}:${fontStep}`
}

async function fontsReady(layout: Layout, g: Geometry) {
  // Lay out a line in every face so the browser starts fetching them, then wait.
  const probe = document.createElement('div')
  probe.className = 'page page--content reader-measure'
  applyVars(probe, pageVars(layout, g))
  // Every face and weight, in Devanagari and Latin: each script is a separate font file.
  const t = 'मराठी, ‘Aa 12’ – “.”'
  probe.innerHTML = `<div class="flow"><p>${t}</p><p><strong>${t}</strong><em>${t}</em></p><p><strong class="dateline">${t}</strong></p><h3>${t}</h3><figcaption>${t}</figcaption><div class="opener"><div class="opener-kicker">${t}</div><h2 class="opener-title">${t}</h2><div class="opener-byline">${t}</div></div></div><div class="toc"><div class="toc-title">${t}</div><div class="toc-num">${t}</div></div>`
  document.body.appendChild(probe)
  void probe.offsetHeight
  try {
    await document.fonts.ready
    // `ready` can resolve before a load triggered by this very layout is queued.
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await document.fonts.ready
  } finally {
    probe.remove()
  }
}

export async function paginate(
  data: ReaderBook,
  layout: Layout,
  fontStep: number,
  onProgress?: (fraction: number) => void,
): Promise<Pagination> {
  const key = paginationKey(data, layout, fontStep)
  const hit = cache.get(key)
  if (hit) return hit

  const g = computeGeometry(layout, fontStep)
  await fontsReady(layout, g)
  const spread = layout.mode === 'spread'
  const { chapters } = data

  // Contents: section labels where they change.
  const tocItems: TocItem[] = []
  let lastSection: string | null = null
  chapters.forEach((ch, i) => {
    if (ch.sectionLabel && ch.sectionLabel !== lastSection) tocItems.push({ type: 'section', label: ch.sectionLabel })
    lastSection = ch.sectionLabel
    tocItems.push({ type: 'entry', chapter: i })
  })
  const tocPages = flowToc(
    layout,
    g,
    tocItems,
    chapters.map((c) => c.article.title),
    chapters.map((c) => c.article.kicker),
  )

  const pages: Page[] = []
  const front = (kind: Page['kind'], extra: Partial<Page> = {}) =>
    pages.push({ kind, anchor: { c: FRONT, b: pages.length, o: 0 }, ...extra })

  front('cover', { hard: true })
  if (spread) front('endpaper', { hard: true })
  front('title')
  front('imprint')
  for (const [i, items] of tocPages.entries()) front('toc', { toc: { items, first: i === 0 } })

  const m = new Measure(layout, g)
  const chapterStart: number[] = []
  lastSection = null
  try {
    for (const [c, ch] of chapters.entries()) {
      const newSection = ch.sectionLabel && ch.sectionLabel !== lastSection ? ch.sectionLabel : null
      lastSection = ch.sectionLabel
      // Chapters open on a right-hand page. The left page facing it carries
      // the chapter's photograph full-bleed when there is one (the opener
      // then leads with its headline), else announces a new section.
      let hero = true
      if (spread && pages.length % 2 === 1) {
        const anchor = { c, b: 0, o: -1 }
        if (ch.article.heroImage) {
          hero = false
          pages.push({ kind: 'photo', anchor, image: ch.article.heroImage, credit: ch.article.heroCredit, label: newSection ?? undefined, chapter: c })
        } else if (newSection) {
          pages.push({ kind: 'section', label: newSection, anchor })
        } else {
          pages.push({ kind: 'blank', anchor })
        }
      }
      const { opener, body } = buildChapterBlocks(ch, ch.sectionLabel, { hero })
      chapterStart.push(pages.length)
      for (const p of flowChapter(m, c, [opener, ...body])) {
        pages.push({ kind: 'content', anchor: p.anchor, html: p.html, chapter: c, isOpener: p.isOpener })
      }
      onProgress?.((c + 1) / chapters.length)
      await yieldToBrowser()
    }
  } finally {
    m.destroy()
  }

  const back = (kind: Page['kind'], extra: Partial<Page> = {}) =>
    pages.push({ kind, anchor: { c: BACK, b: pages.length, o: 0 }, ...extra })
  back('colophon')
  if (spread) {
    // The back board is the last two pages: its inside on the right, the cover alone on the left.
    if (pages.length % 2 === 1) back('blank')
    back('endpaper', { hard: true })
  }
  back('back', { hard: true })

  const result: Pagination = { key, pages, chapterStart, geometry: g }
  cache.set(key, result)
  return result
}
