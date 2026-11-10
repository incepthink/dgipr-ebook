'use client'

import { buildChapterBlocks, hydrateImages } from '@/lib/paginate/blocks'
import type { ReaderBook } from '@/lib/types'

/**
 * The book as continuous text, for the easy-reading view, read-aloud and
 * search. Blocks are numbered exactly as the paginator numbers them
 * (0 = the article's opener, then one per paragraph, list, quote or figure),
 * so an anchor {c, b, o} means the same place in both views.
 */
export interface TextBlock {
  c: number
  b: number
  /** What is read aloud and searched. */
  text: string
  /** Paragraph-like blocks can be highlighted; the opener and figures cannot. */
  prose: boolean
}

export interface TextChapter {
  c: number
  title: string
  html: string
  blocks: TextBlock[]
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

export function buildTextChapters(data: ReaderBook): TextChapter[] {
  return data.chapters.map((ch, c) => {
    const { opener, body } = buildChapterBlocks(ch, ch.sectionLabel, { hero: true })
    const all = [opener, ...body]
    const wrap = document.createElement('div')
    const blocks: TextBlock[] = all.map((el, b) => {
      el.setAttribute('data-b', String(b))
      wrap.appendChild(el)
      if (b === 0) {
        const title = clean(el.querySelector('.opener-title')?.textContent)
        const deck = Array.from(el.querySelectorAll('.opener-deck li')).map((li) => clean(li.textContent))
        return { c, b, text: [title, ...deck].filter(Boolean).join('. '), prose: false }
      }
      if (el.tagName === 'FIGURE') return { c, b, text: clean(el.querySelector('figcaption')?.textContent), prose: false }
      return { c, b, text: clean(el.textContent), prose: true }
    })
    const html = hydrateImages(wrap.innerHTML).replace(/<img /g, '<img loading="lazy" ')
    return { c, title: ch.article.title, html, blocks }
  })
}

/** Text that can be spoken in one go: browsers cut long utterances short. */
export function speechChunks(text: string, max = 220): string[] {
  const parts = text.split(/(?<=[।.!?॥])\s+/)
  const out: string[] = []
  let cur = ''
  for (const p of parts) {
    if ((cur + ' ' + p).trim().length <= max) cur = (cur + ' ' + p).trim()
    else {
      if (cur) out.push(cur)
      if (p.length <= max) cur = p
      else {
        // A very long sentence: break at commas or spaces.
        let rest = p
        while (rest.length > max) {
          const cut = Math.max(rest.lastIndexOf(',', max), rest.lastIndexOf(' ', max))
          const at = cut > max * 0.5 ? cut + 1 : max
          out.push(rest.slice(0, at).trim())
          rest = rest.slice(at)
        }
        cur = rest.trim()
      }
    }
  }
  if (cur) out.push(cur)
  return out
}
