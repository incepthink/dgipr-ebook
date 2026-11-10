/**
 * A reader's own data: where they are in each book, their bookmarks, and the
 * books they saved. Guests keep the same things in localStorage only
 * (`src/components/reader/storage.ts`).
 */
import { ensureSchema, pool, query, SUMMARY_SELECT, toSummary, VISIBLE } from './db'
import type { Anchor } from './paginate/types'
import type { BookSummary } from './types'

type Row = Record<string, unknown>
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))

export interface Progress {
  anchor: Anchor
  page: number
  pageCount: number
  percent: number
  updatedAt: string
  finishedAt: string | null
}

export interface ServerBookmark {
  anchor: Anchor
  label: string
  snippet: string
  at: number
}

export interface ShelfItem {
  book: BookSummary
  progress: Progress | null
  savedAt: string | null
}

export interface BookmarkGroup {
  book: { id: number; slug: string; title: string; subtitle: string | null }
  marks: ServerBookmark[]
}

export interface HighlightGroup {
  book: { id: number; slug: string; title: string; subtitle: string | null }
  chapterTitles: Record<number, string>
  highlights: ServerHighlight[]
}

function toProgress(r: Row): Progress {
  return {
    anchor: r.anchor as Anchor,
    page: Number(r.page),
    pageCount: Number(r.page_count),
    percent: Number(r.percent),
    updatedAt: iso(r.updated_at)!,
    finishedAt: iso(r.finished_at),
  }
}

const toMark = (r: Row): ServerBookmark => ({
  anchor: r.anchor as Anchor,
  label: String(r.label ?? ''),
  snippet: String(r.snippet ?? ''),
  at: r.created_at instanceof Date ? r.created_at.getTime() : Date.parse(String(r.created_at)),
})

/* ------------------------------------------------------------- one book */

export interface ServerHighlight {
  id: string
  c: number
  b: number
  start: number
  end: number
  text: string
  color: 'yellow' | 'green' | 'blue' | 'pink'
  note: string
  at: number
}

const toHighlight = (r: Row): ServerHighlight => ({
  id: String(r.id),
  c: Number(r.c),
  b: Number(r.b),
  start: Number(r.start_o),
  end: Number(r.end_o),
  text: String(r.text ?? ''),
  color: (['yellow', 'green', 'blue', 'pink'].includes(String(r.color)) ? r.color : 'yellow') as ServerHighlight['color'],
  note: String(r.note ?? ''),
  at: r.created_at instanceof Date ? r.created_at.getTime() : Date.parse(String(r.created_at)),
})

export interface ReaderState {
  progress: Progress | null
  bookmarks: ServerBookmark[]
  highlights: ServerHighlight[]
  saved: boolean
}

export async function readerState(userId: number, bookId: number): Promise<ReaderState> {
  const [p, marks, hls, saved] = await Promise.all([
    query('SELECT * FROM reading_progress WHERE user_id = $1 AND book_id = $2', [userId, bookId]),
    query('SELECT * FROM bookmarks WHERE user_id = $1 AND book_id = $2 ORDER BY created_at', [userId, bookId]),
    query('SELECT * FROM highlights WHERE user_id = $1 AND book_id = $2 ORDER BY created_at', [userId, bookId]),
    query('SELECT 1 FROM saved_books WHERE user_id = $1 AND book_id = $2', [userId, bookId]),
  ])
  return {
    progress: p[0] ? toProgress(p[0]) : null,
    bookmarks: marks.map(toMark),
    highlights: hls.map(toHighlight),
    saved: saved.length > 0,
  }
}

export async function saveProgress(
  userId: number,
  bookId: number,
  p: { anchor: Anchor; page: number; pageCount: number; finished: boolean },
): Promise<void> {
  const pageCount = Math.max(1, p.pageCount)
  const page = Math.min(Math.max(1, p.page), pageCount)
  const percent = p.finished ? 1 : Math.min(1, page / pageCount)
  await query(
    `INSERT INTO reading_progress (user_id, book_id, anchor, page, page_count, percent, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7 THEN now() END)
     ON CONFLICT (user_id, book_id) DO UPDATE SET
       anchor = EXCLUDED.anchor, page = EXCLUDED.page, page_count = EXCLUDED.page_count,
       percent = EXCLUDED.percent, updated_at = now(),
       finished_at = CASE WHEN $7 THEN coalesce(reading_progress.finished_at, now()) ELSE reading_progress.finished_at END`,
    [userId, bookId, JSON.stringify(p.anchor), page, pageCount, percent, p.finished],
  )
}

/** The reader holds the whole list for a book; replacing it keeps both sides in step. */
export async function replaceBookmarks(userId: number, bookId: number, marks: ServerBookmark[]): Promise<void> {
  await ensureSchema() // before taking a raw client from the pool
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM bookmarks WHERE user_id = $1 AND book_id = $2', [userId, bookId])
    for (const m of marks) {
      await client.query(
        `INSERT INTO bookmarks (user_id, book_id, anchor, label, snippet, created_at) VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))`,
        [userId, bookId, JSON.stringify(m.anchor), m.label, m.snippet, m.at],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Like bookmarks: the reader holds the book's whole list and sends it. */
export async function replaceHighlights(userId: number, bookId: number, list: ServerHighlight[]): Promise<void> {
  await ensureSchema()
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM highlights WHERE user_id = $1 AND book_id = $2', [userId, bookId])
    for (const h of list) {
      await client.query(
        `INSERT INTO highlights (id, user_id, book_id, c, b, start_o, end_o, text, color, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11 / 1000.0)) ON CONFLICT DO NOTHING`,
        [h.id, userId, bookId, h.c, h.b, h.start, h.end, h.text, h.color, h.note, h.at],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function setSaved(userId: number, bookId: number, saved: boolean): Promise<void> {
  if (saved) {
    await query('INSERT INTO saved_books (user_id, book_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, bookId])
  } else {
    await query('DELETE FROM saved_books WHERE user_id = $1 AND book_id = $2', [userId, bookId])
  }
}

export async function bookIsVisible(bookId: number): Promise<boolean> {
  const rows = await query(`SELECT 1 FROM books b WHERE b.id = $1 AND ${VISIBLE}`, [bookId])
  return rows.length > 0
}

/* ------------------------------------------------------------- shelves */

const SHELF_SELECT = `
  SELECT s.*, rp.anchor, rp.page, rp.page_count, rp.percent, rp.updated_at AS rp_updated_at, rp.finished_at, sb.created_at AS saved_at
  FROM (${SUMMARY_SELECT} WHERE ${VISIBLE}) s
  LEFT JOIN reading_progress rp ON rp.book_id = s.id AND rp.user_id = $1
  LEFT JOIN saved_books sb ON sb.book_id = s.id AND sb.user_id = $1`

function toShelfItem(r: Row): ShelfItem {
  return {
    book: toSummary(r),
    progress: r.anchor
      ? toProgress({ ...r, updated_at: r.rp_updated_at })
      : null,
    savedAt: iso(r.saved_at),
  }
}

/** Books started and not finished, most recent first: the "continue reading" row. */
export async function continueReading(userId: number, limit = 8): Promise<ShelfItem[]> {
  const rows = await query(
    `${SHELF_SELECT} WHERE rp.user_id IS NOT NULL AND rp.finished_at IS NULL ORDER BY rp.updated_at DESC LIMIT $2`,
    [userId, limit],
  )
  return rows.map(toShelfItem)
}

export async function savedBookIds(userId: number): Promise<number[]> {
  const rows = await query<{ book_id: number }>('SELECT book_id FROM saved_books WHERE user_id = $1', [userId])
  return rows.map((r) => Number(r.book_id))
}

export interface MyLibrary {
  reading: ShelfItem[]
  saved: ShelfItem[]
  finished: ShelfItem[]
  bookmarks: BookmarkGroup[]
  highlights: HighlightGroup[]
  stats: { started: number; finished: number; bookmarks: number; saved: number; highlights: number }
}

export async function myLibrary(userId: number): Promise<MyLibrary> {
  const [shelf, marks, hls] = await Promise.all([
    query(`${SHELF_SELECT} WHERE rp.user_id IS NOT NULL OR sb.user_id IS NOT NULL ORDER BY coalesce(rp.updated_at, sb.created_at) DESC`, [userId]),
    query(
      `SELECT bm.*, b.slug, b.title AS book_title, b.subtitle AS book_subtitle
       FROM bookmarks bm JOIN books b ON b.id = bm.book_id
       WHERE bm.user_id = $1 AND ${VISIBLE}
       ORDER BY bm.created_at DESC`,
      [userId],
    ),
    // Each highlight with its article's title: chapter c is the c-th chapter by position.
    query(
      `SELECT h.*, b.slug, b.title AS book_title, b.subtitle AS book_subtitle,
         (SELECT a.title FROM chapters ch JOIN articles a ON a.id = ch.article_id
           WHERE ch.book_id = b.id ORDER BY ch.position, ch.id OFFSET h.c LIMIT 1) AS chapter_title
       FROM highlights h JOIN books b ON b.id = h.book_id
       WHERE h.user_id = $1 AND ${VISIBLE}
       ORDER BY h.created_at DESC`,
      [userId],
    ),
  ])
  const items = shelf.map(toShelfItem)
  const groups = new Map<number, BookmarkGroup>()
  for (const r of marks) {
    const id = Number(r.book_id)
    let g = groups.get(id)
    if (!g) {
      g = { book: { id, slug: String(r.slug), title: String(r.book_title), subtitle: (r.book_subtitle as string) ?? null }, marks: [] }
      groups.set(id, g)
    }
    g.marks.push(toMark(r))
  }
  const hlGroups = new Map<number, HighlightGroup>()
  for (const r of hls) {
    const id = Number(r.book_id)
    let g = hlGroups.get(id)
    if (!g) {
      g = { book: { id, slug: String(r.slug), title: String(r.book_title), subtitle: (r.book_subtitle as string) ?? null }, chapterTitles: {}, highlights: [] }
      hlGroups.set(id, g)
    }
    const h = toHighlight(r)
    if (r.chapter_title) g.chapterTitles[h.c] = String(r.chapter_title)
    g.highlights.push(h)
  }
  const reading = items.filter((i) => i.progress && !i.progress.finishedAt)
  const finished = items.filter((i) => i.progress?.finishedAt)
  const saved = items.filter((i) => i.savedAt)
  return {
    reading,
    saved,
    finished,
    bookmarks: [...groups.values()],
    highlights: [...hlGroups.values()],
    stats: {
      started: items.filter((i) => i.progress).length,
      finished: finished.length,
      bookmarks: marks.length,
      saved: saved.length,
      highlights: hls.length,
    },
  }
}
