/**
 * Search across every published book's articles: headline and full text,
 * optionally within one district. Each hit links to the book at that article
 * (`?at=<chapter>.0.0`), and `?find=` lets the reader go on to the exact
 * paragraph.
 */
import { query, VISIBLE } from './db'
import { decodeEntities } from './sanitize'
import { searchTerms } from './searchTerms'
import type { BookKind } from './types'

export interface ArticleHit {
  articleId: number
  title: string
  kicker: string | null
  district: string | null
  publishedAt: string | null
  image: string | null
  /** Text around the first match in the body; null when only the headline matched. */
  snippet: { before: string; match: string; after: string } | null
  excerpt: string | null
  book: { slug: string; title: string; kind: BookKind; editionDate: string | null }
  href: string
}

type Row = Record<string, unknown>

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)
const SNIP = 70

/** Around whichever of the terms occurs first in the text. */
function snippetOf(plain: string, terms: string[]) {
  const text = decodeEntities(plain).replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  let i = -1
  let needle = ''
  for (const t of terms) {
    const at = lower.indexOf(t.toLowerCase())
    if (at >= 0 && (i < 0 || at < i)) {
      i = at
      needle = t
    }
  }
  if (i < 0) return null
  return {
    before: (i > SNIP ? '…' : '') + text.slice(Math.max(0, i - SNIP), i),
    match: text.slice(i, i + needle.length),
    after: text.slice(i + needle.length, i + needle.length + SNIP) + (i + needle.length + SNIP < text.length ? '…' : ''),
  }
}

const isoDate = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))
function calendarDate(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  return String(v).slice(0, 10)
}

export async function searchArticles(opts: { q?: string | null; district?: string | null; limit?: number }): Promise<ArticleHit[]> {
  const q = opts.q?.trim().slice(0, 100) || null
  const district = opts.district || null
  if (!q && !district) return []
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 60)
  // English words become the Marathi ones the articles use ("woman" → महिला).
  const terms = q ? searchTerms(q) : []
  const likes = terms.length ? terms.map((t) => `%${escapeLike(t)}%`) : null

  const rows = await query<Row>(
    `WITH ch AS (
       SELECT c.book_id, c.article_id,
              (row_number() OVER (PARTITION BY c.book_id ORDER BY c.position, c.id) - 1)::int AS idx
       FROM chapters c JOIN books b ON b.id = c.book_id
       WHERE ${VISIBLE}
     )
     SELECT a.id, a.title, a.kicker, a.district, a.published_at, a.hero_image, a.excerpt,
            CASE WHEN $1::text[] IS NULL THEN '' ELSE regexp_replace(a.content_html, '<[^>]+>', ' ', 'g') END AS plain,
            b.slug, b.title AS book_title, b.kind, b.edition_date, ch.idx,
            ($1::text[] IS NOT NULL AND a.title ILIKE ANY($1::text[])) AS in_title
     FROM ch
     JOIN articles a ON a.id = ch.article_id
     JOIN books b ON b.id = ch.book_id
     WHERE ($1::text[] IS NULL OR a.title ILIKE ANY($1::text[]) OR a.content_html ILIKE ANY($1::text[]))
       AND ($2::text IS NULL OR a.district = $2)
     ORDER BY in_title DESC, a.published_at DESC NULLS LAST, (b.kind = 'edition') DESC, b.id DESC
     LIMIT 300`,
    [likes, district],
  )

  // An article can sit in several books: list it once, in the first (newest edition) book.
  const seen = new Set<number>()
  const out: ArticleHit[] = []
  for (const r of rows) {
    const id = Number(r.id)
    if (seen.has(id)) continue
    seen.add(id)
    const snippet = q ? snippetOf(String(r.plain ?? ''), terms) : null
    const params = new URLSearchParams({ at: `${Number(r.idx)}.0.0` })
    // The reader goes on to the paragraph holding the word that matched.
    if (snippet) params.set('find', snippet.match)
    out.push({
      articleId: id,
      title: String(r.title),
      kicker: (r.kicker as string) ?? null,
      district: (r.district as string) ?? null,
      publishedAt: isoDate(r.published_at),
      image: (r.hero_image as string) ?? null,
      snippet,
      excerpt: (r.excerpt as string) ?? null,
      book: {
        slug: String(r.slug),
        title: String(r.book_title),
        kind: r.kind as BookKind,
        editionDate: calendarDate(r.edition_date),
      },
      href: `/read/${encodeURIComponent(String(r.slug))}?${params}`,
    })
    if (out.length >= limit) break
  }
  return out
}
