import { districtName } from '../districts'
import { img } from '../img'
import { dateMr } from '../marathi'
import type { ChapterWithArticle } from '../types'

export interface ChapterBlocks {
  opener: HTMLElement
  body: HTMLElement[]
}

/**
 * While measuring, images carry a blank placeholder and an explicit aspect
 * ratio, so the whole book can be laid out without downloading every photo.
 * The real URL waits in data-src until the page is actually shown.
 */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export function hydrateImages(html: string): string {
  return html.replace(/ src="data:image\/gif;base64,[^"]*"/g, '').replace(/ data-src="/g, ' src="')
}

function deferSrc(im: HTMLImageElement, url: string) {
  im.setAttribute('src', BLANK)
  im.setAttribute('data-src', url)
}

const BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'FIGURE'])

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text != null) e.textContent = text
  return e
}

/** "मुंबई, दि. १५" → "मुंबई" */
function placeOf(dateline: string | null): string | null {
  if (!dateline) return null
  const p = dateline.split(/,|दि\./)[0].trim()
  return p || null
}

/**
 * One article as typesettable blocks: the opener (photo, kicker, headline,
 * deck, byline) and its body, one element per top-level block.
 */
export function buildChapterBlocks(
  ch: ChapterWithArticle,
  sectionLabel: string | null,
  opts: { hero?: boolean } = {},
): ChapterBlocks {
  const a = ch.article
  const root = document.createElement('div')
  root.innerHTML = a.contentHtml

  // Loose inline content at the top level is gathered into paragraphs.
  const body: HTMLElement[] = []
  let loose: HTMLParagraphElement | null = null
  for (const node of Array.from(root.childNodes)) {
    if (node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName)) {
      loose = null
      body.push(node)
    } else if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      continue
    } else {
      if (!loose) {
        loose = el('p')
        body.push(loose)
      }
      loose.appendChild(node)
    }
  }

  // A short bullet list before the first paragraph is the story's deck.
  let deck: HTMLElement | null = null
  if (body[0]?.tagName === 'UL') {
    const items = Array.from(body[0].children)
    if (items.length <= 4 && items.every((li) => (li.textContent ?? '').length < 200)) {
      deck = body.shift()!
      deck.className = 'opener-deck'
    }
  }

  for (const im of Array.from(root.querySelectorAll('img'))) {
    const src = im.getAttribute('src') ?? ''
    deferSrc(im, img(src, 1080))
    im.setAttribute('decoding', 'async')
    if (!im.getAttribute('alt')) im.setAttribute('alt', '')
    // Without intrinsic dimensions, assume a landscape photo.
    const w = Number(im.getAttribute('width')) || 4
    const h = Number(im.getAttribute('height')) || 3
    im.removeAttribute('width')
    im.removeAttribute('height')
    im.dataset.ratio = String(w / h)
    im.style.aspectRatio = `${w} / ${h}`
  }

  const firstP = body.find((b) => b.tagName === 'P')
  if (firstP) firstP.classList.add('lede')

  // --- opener
  const hasPhoto = !!a.heroImage && opts.hero !== false
  const opener = el('div', `opener ${hasPhoto ? 'opener--photo' : 'opener--text'}`)
  if (hasPhoto) {
    const fig = el('figure', 'opener-hero')
    const im = el('img')
    deferSrc(im, img(a.heroImage, 1080))
    im.alt = ''
    im.decoding = 'async'
    fig.appendChild(im)
    if (a.heroCredit) fig.appendChild(el('figcaption', 'opener-credit', a.heroCredit))
    opener.appendChild(fig)
  }
  if (sectionLabel) opener.appendChild(el('div', 'opener-section', sectionLabel))
  const kicker = a.kicker || (a.district ? districtName(a.district) : null)
  if (kicker) opener.appendChild(el('div', 'opener-kicker', kicker))
  opener.appendChild(el('h2', 'opener-title', a.title))
  if (deck) opener.appendChild(deck)
  const byline = el('div', 'opener-byline')
  const place = placeOf(a.dateline) ?? (a.district ? districtName(a.district) : null)
  if (place) byline.appendChild(el('span', '', place))
  if (a.publishedAt) byline.appendChild(el('span', '', dateMr(a.publishedAt)))
  if (byline.childNodes.length) opener.appendChild(byline)

  return { opener, body }
}
