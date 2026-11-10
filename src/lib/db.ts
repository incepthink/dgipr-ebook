import { Pool } from 'pg'
import type {
  Article,
  ArticleInput,
  Book,
  BookKind,
  BookStatus,
  BookSummary,
  Chapter,
  ChapterWithArticle,
  CoverStyle,
  ReaderBook,
} from './types'
import { DEFAULT_ACCENT } from './types'

/**
 * One small pool per process. Serverless instances each get their own, so keep
 * it modest and let idle connections go quickly.
 */
function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — run `npm run db:start` and copy .env.example to .env.local.')
  }
  const p = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    ssl: sslConfig(),
    // Postgres itself refuses every write on these connections.
    options: readOnlyDb() ? '-c default_transaction_read_only=on' : undefined,
    // Second lock, in case a proxy drops the startup option. The pool waits for
    // this before handing the connection out, and discards it if it fails.
    onConnect: readOnlyDb()
      ? async (client) => {
          await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY')
        }
      : undefined,
  })
  // An unhandled 'error' from an idle client would take the process down.
  p.on('error', (err) => console.warn('[db] idle client dropped:', err.message))
  return p
}

/**
 * DATABASE_READONLY=1: look at a live database without changing it — for
 * checking a new build locally against production. No schema is created, and
 * the database rejects any INSERT/UPDATE/DELETE. Sign-in is switched off.
 */
export const readOnlyDb = () => process.env.DATABASE_READONLY === '1'

/**
 * RDS terminates TLS with an Amazon-issued cert that isn't in Node's trust store.
 * Supply RDS_CA_CERT to verify it; without one we still encrypt but skip
 * verification. DATABASE_SSL=disable is for a plaintext local Postgres.
 */
function sslConfig() {
  if (process.env.DATABASE_SSL === 'disable') return undefined
  const ca = process.env.RDS_CA_CERT
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }
}

// Survives dev hot-reloads, which would otherwise leak a pool per edit.
const globalForPg = globalThis as unknown as { _pool?: Pool; _schema?: Promise<void> }

export function pool(): Pool {
  globalForPg._pool ??= makePool()
  return globalForPg._pool
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  kind          TEXT NOT NULL DEFAULT 'edition' CHECK (kind IN ('edition','themed','special')),
  edition_date  DATE,
  description   TEXT,
  cover_image   TEXT,
  cover_style   JSONB NOT NULL DEFAULT '{"mode":"auto"}',
  accent_color  TEXT NOT NULL DEFAULT '${DEFAULT_ACCENT}',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled')),
  publish_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id            SERIAL PRIMARY KEY,
  source_url    TEXT UNIQUE,
  wp_id         INTEGER,
  title         TEXT NOT NULL,
  kicker        TEXT,
  dateline      TEXT,
  district      TEXT,
  published_at  TIMESTAMPTZ,
  hero_image    TEXT,
  hero_credit   TEXT,
  content_html  TEXT NOT NULL DEFAULT '',
  excerpt       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chapters (
  id            SERIAL PRIMARY KEY,
  book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  article_id    INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  section_label TEXT
);
CREATE INDEX IF NOT EXISTS chapters_book_idx ON chapters (book_id, position);
CREATE INDEX IF NOT EXISTS articles_published_idx ON articles (published_at DESC);

-- Readers' accounts. A reader signs in with Google or with an email and
-- password. (mobile is kept for accounts made that way earlier, and for admins.)
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  mobile         TEXT UNIQUE,
  email          TEXT UNIQUE,
  password_hash  TEXT,
  name           TEXT,
  district       TEXT,
  interests      TEXT[] NOT NULL DEFAULT '{}',
  notify         BOOLEAN NOT NULL DEFAULT true,
  role           TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader','admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ,
  CHECK (mobile IS NOT NULL OR email IS NOT NULL)
);

-- Only a hash of the session token is stored; the token lives in the cookie.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Google sign-in: the stable Google account id, and the profile photo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Fixed-window counters for rate limits (login attempts).
CREATE TABLE IF NOT EXISTS auth_throttle (
  key           TEXT PRIMARY KEY,
  hits          INTEGER NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL
);

-- Where each reader is in each book. The anchor is the same one the reader
-- uses (chapter, block, offset), so it survives font and screen changes.
CREATE TABLE IF NOT EXISTS reading_progress (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  anchor       JSONB NOT NULL,
  page         INTEGER NOT NULL DEFAULT 1,
  page_count   INTEGER NOT NULL DEFAULT 1,
  percent      REAL NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX IF NOT EXISTS reading_progress_recent_idx ON reading_progress (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  anchor      JSONB NOT NULL,
  label       TEXT NOT NULL DEFAULT '',
  snippet     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookmarks_user_book_idx ON bookmarks (user_id, book_id);

-- Highlights and notes, made in the easy-reading view: characters
-- [start_o, end_o) of block b of chapter c.
CREATE TABLE IF NOT EXISTS highlights (
  id          TEXT NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  c           INTEGER NOT NULL,
  b           INTEGER NOT NULL,
  start_o     INTEGER NOT NULL,
  end_o       INTEGER NOT NULL,
  text        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'yellow',
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id, id)
);

CREATE TABLE IF NOT EXISTS saved_books (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);
`

export function ensureSchema(): Promise<void> {
  if (readOnlyDb()) return Promise.resolve()
  globalForPg._schema ??= pool()
    .query(SCHEMA)
    .then(() => undefined)
    .catch((err) => {
      globalForPg._schema = undefined
      throw err
    })
  return globalForPg._schema
}

type Row = Record<string, unknown>

async function q<T = Row>(text: string, values: unknown[] = []): Promise<T[]> {
  await ensureSchema()
  const res = await pool().query(text, values)
  return res.rows as T[]
}

/** For the account modules (`src/lib/auth`, `src/lib/reading`), which keep their own queries. */
export const query = q
export { toSummary, SUMMARY_SELECT, VISIBLE }

/* ---------------------------------------------------------------- mapping */

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))

/** `DATE` columns come back as local-midnight Dates; read the calendar fields. */
function isoDate(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  return String(v).slice(0, 10)
}

function toBook(r: Row): Book {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    subtitle: (r.subtitle as string) ?? null,
    kind: r.kind as BookKind,
    editionDate: isoDate(r.edition_date),
    description: (r.description as string) ?? null,
    coverImage: (r.cover_image as string) ?? null,
    coverStyle: (r.cover_style as CoverStyle) ?? { mode: 'auto' },
    accentColor: (r.accent_color as string) || DEFAULT_ACCENT,
    status: r.status as BookStatus,
    publishAt: iso(r.publish_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  }
}

function toArticle(r: Row): Article {
  return {
    id: Number(r.id),
    sourceUrl: (r.source_url as string) ?? null,
    wpId: r.wp_id == null ? null : Number(r.wp_id),
    title: String(r.title),
    kicker: (r.kicker as string) ?? null,
    dateline: (r.dateline as string) ?? null,
    district: (r.district as string) ?? null,
    publishedAt: iso(r.published_at),
    heroImage: (r.hero_image as string) ?? null,
    heroCredit: (r.hero_credit as string) ?? null,
    contentHtml: String(r.content_html ?? ''),
    excerpt: (r.excerpt as string) ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  }
}

function toChapter(r: Row): Chapter {
  return {
    id: Number(r.id),
    bookId: Number(r.book_id),
    articleId: Number(r.article_id),
    position: Number(r.position),
    sectionLabel: (r.section_label as string) ?? null,
  }
}

/* ------------------------------------------------------------------ books */

/** Published, or scheduled and due. */
const VISIBLE = `(b.status = 'published' OR (b.status = 'scheduled' AND b.publish_at <= now()))`

const SUMMARY_SELECT = `
  SELECT b.*,
    (SELECT count(*) FROM chapters c WHERE c.book_id = b.id) AS chapter_count,
    (SELECT a.hero_image FROM chapters c JOIN articles a ON a.id = c.article_id
       WHERE c.book_id = b.id AND a.hero_image IS NOT NULL ORDER BY c.position LIMIT 1) AS lead_image,
    (SELECT coalesce(json_agg(t.title), '[]') FROM (
       SELECT a.title FROM chapters c JOIN articles a ON a.id = c.article_id
       WHERE c.book_id = b.id ORDER BY c.position LIMIT 4) t) AS lead_titles,
    (SELECT coalesce(array_agg(DISTINCT a.district) FILTER (WHERE a.district IS NOT NULL), '{}')
       FROM chapters c JOIN articles a ON a.id = c.article_id WHERE c.book_id = b.id) AS districts
  FROM books b`

function toSummary(r: Row): BookSummary {
  return {
    ...toBook(r),
    chapterCount: Number(r.chapter_count ?? 0),
    leadImage: (r.lead_image as string) ?? null,
    leadTitles: (r.lead_titles as string[]) ?? [],
    districts: (r.districts as string[]) ?? [],
  }
}

export async function listBooks(): Promise<BookSummary[]> {
  const rows = await q(`${SUMMARY_SELECT} ORDER BY coalesce(b.edition_date, b.created_at::date) DESC, b.id DESC`)
  return rows.map(toSummary)
}

export async function listPublishedBooks(): Promise<BookSummary[]> {
  const rows = await q(
    `${SUMMARY_SELECT} WHERE ${VISIBLE} ORDER BY coalesce(b.edition_date, b.publish_at::date, b.created_at::date) DESC, b.id DESC`,
  )
  return rows.map(toSummary)
}

export async function getBook(id: number): Promise<Book | null> {
  const [r] = await q('SELECT * FROM books WHERE id = $1', [id])
  return r ? toBook(r) : null
}

export async function getBookBySlug(slug: string): Promise<Book | null> {
  const [r] = await q('SELECT * FROM books WHERE slug = $1', [slug])
  return r ? toBook(r) : null
}

export function isVisible(book: Book): boolean {
  if (book.status === 'published') return true
  return book.status === 'scheduled' && !!book.publishAt && new Date(book.publishAt) <= new Date()
}

export interface BookInput {
  slug?: string
  title?: string
  subtitle?: string | null
  kind?: BookKind
  editionDate?: string | null
  description?: string | null
  coverImage?: string | null
  coverStyle?: CoverStyle
  accentColor?: string
  status?: BookStatus
  publishAt?: string | null
}

const BOOK_COLUMNS: Record<keyof BookInput, string> = {
  slug: 'slug',
  title: 'title',
  subtitle: 'subtitle',
  kind: 'kind',
  editionDate: 'edition_date',
  description: 'description',
  coverImage: 'cover_image',
  coverStyle: 'cover_style',
  accentColor: 'accent_color',
  status: 'status',
  publishAt: 'publish_at',
}

export async function createBook(input: BookInput & { title: string; slug: string }): Promise<Book> {
  const cols: string[] = []
  const vals: unknown[] = []
  for (const [k, col] of Object.entries(BOOK_COLUMNS)) {
    const v = input[k as keyof BookInput]
    if (v === undefined) continue
    cols.push(col)
    vals.push(k === 'coverStyle' ? JSON.stringify(v) : v)
  }
  const [r] = await q(
    `INSERT INTO books (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    vals,
  )
  return toBook(r)
}

export async function updateBook(id: number, input: BookInput): Promise<Book | null> {
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, col] of Object.entries(BOOK_COLUMNS)) {
    const v = input[k as keyof BookInput]
    if (v === undefined) continue
    vals.push(k === 'coverStyle' ? JSON.stringify(v) : v)
    sets.push(`${col} = $${vals.length}`)
  }
  if (!sets.length) return getBook(id)
  vals.push(id)
  const [r] = await q(
    `UPDATE books SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`,
    vals,
  )
  return r ? toBook(r) : null
}

export async function deleteBook(id: number): Promise<void> {
  await q('DELETE FROM books WHERE id = $1', [id])
}

export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  const rows = await q('SELECT 1 FROM books WHERE slug = $1 AND id <> $2', [slug, exceptId ?? -1])
  return rows.length > 0
}

export async function uniqueSlug(base: string, exceptId?: number): Promise<string> {
  let slug = base
  for (let n = 2; await slugExists(slug, exceptId); n++) slug = `${base}-${n}`
  return slug
}

export async function duplicateBook(id: number): Promise<Book | null> {
  const src = await getBook(id)
  if (!src) return null
  const copy = await createBook({
    ...src,
    title: `${src.title} (प्रत)`,
    slug: await uniqueSlug(`${src.slug}-copy`),
    status: 'draft',
    publishAt: null,
  })
  await q(
    `INSERT INTO chapters (book_id, article_id, position, section_label)
     SELECT $1, article_id, position, section_label FROM chapters WHERE book_id = $2`,
    [copy.id, id],
  )
  return copy
}

/* --------------------------------------------------------------- chapters */

export async function listChapters(bookId: number): Promise<ChapterWithArticle[]> {
  const rows = await q(
    `SELECT c.id AS c_id, c.book_id, c.article_id, c.position, c.section_label, a.*
     FROM chapters c JOIN articles a ON a.id = c.article_id
     WHERE c.book_id = $1 ORDER BY c.position, c.id`,
    [bookId],
  )
  return rows.map((r) => ({ ...toChapter({ ...r, id: r.c_id }), article: toArticle(r) }))
}

/** Replace the book's chapter list with this order. */
export async function setChapters(
  bookId: number,
  items: { articleId: number; sectionLabel?: string | null }[],
): Promise<void> {
  await ensureSchema()
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM chapters WHERE book_id = $1', [bookId])
    for (const [i, it] of items.entries()) {
      await client.query(
        'INSERT INTO chapters (book_id, article_id, position, section_label) VALUES ($1, $2, $3, $4)',
        [bookId, it.articleId, i, it.sectionLabel || null],
      )
    }
    await client.query('UPDATE books SET updated_at = now() WHERE id = $1', [bookId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Append articles not already in the book, in the given order. */
export async function appendChapters(bookId: number, articleIds: number[]): Promise<number> {
  let added = 0
  for (const articleId of articleIds) {
    const rows = await q(
      `INSERT INTO chapters (book_id, article_id, position)
       SELECT $1, $2, coalesce(max(position) + 1, 0) FROM chapters WHERE book_id = $1
       AND NOT EXISTS (SELECT 1 FROM chapters WHERE book_id = $1 AND article_id = $2)
       RETURNING id`,
      [bookId, articleId],
    )
    added += rows.length
  }
  if (added) await q('UPDATE books SET updated_at = now() WHERE id = $1', [bookId])
  return added
}

export async function getReaderBook(slug: string): Promise<ReaderBook | null> {
  const book = await getBookBySlug(slug)
  if (!book) return null
  return { book, chapters: await listChapters(book.id) }
}

/* --------------------------------------------------------------- articles */

const ARTICLE_COLUMNS: Record<keyof ArticleInput, string> = {
  sourceUrl: 'source_url',
  wpId: 'wp_id',
  title: 'title',
  kicker: 'kicker',
  dateline: 'dateline',
  district: 'district',
  publishedAt: 'published_at',
  heroImage: 'hero_image',
  heroCredit: 'hero_credit',
  contentHtml: 'content_html',
  excerpt: 'excerpt',
}

export async function listArticles(opts: { search?: string; limit?: number } = {}): Promise<Article[]> {
  const rows = await q(
    `SELECT * FROM articles WHERE ($1::text IS NULL OR title ILIKE '%' || $1 || '%')
     ORDER BY coalesce(published_at, created_at) DESC LIMIT $2`,
    [opts.search?.trim() || null, opts.limit ?? 100],
  )
  return rows.map(toArticle)
}

export async function getArticle(id: number): Promise<Article | null> {
  const [r] = await q('SELECT * FROM articles WHERE id = $1', [id])
  return r ? toArticle(r) : null
}

export async function createArticle(input: ArticleInput): Promise<Article> {
  const cols: string[] = []
  const vals: unknown[] = []
  for (const [k, col] of Object.entries(ARTICLE_COLUMNS)) {
    const v = input[k as keyof ArticleInput]
    if (v === undefined) continue
    cols.push(col)
    vals.push(v)
  }
  const [r] = await q(
    `INSERT INTO articles (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    vals,
  )
  return toArticle(r)
}

export async function updateArticle(id: number, input: Partial<ArticleInput>): Promise<Article | null> {
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, col] of Object.entries(ARTICLE_COLUMNS)) {
    const v = input[k as keyof ArticleInput]
    if (v === undefined) continue
    vals.push(v)
    sets.push(`${col} = $${vals.length}`)
  }
  if (!sets.length) return getArticle(id)
  vals.push(id)
  const [r] = await q(
    `UPDATE articles SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`,
    vals,
  )
  return r ? toArticle(r) : null
}

/** Insert or refresh by `source_url`. */
export async function upsertArticleBySource(input: ArticleInput & { sourceUrl: string }): Promise<Article> {
  const [existing] = await q<{ id: number }>('SELECT id FROM articles WHERE source_url = $1', [input.sourceUrl])
  if (existing) return (await updateArticle(Number(existing.id), input))!
  return createArticle(input)
}

export async function deleteArticle(id: number): Promise<void> {
  await q('DELETE FROM articles WHERE id = $1', [id])
}

export async function booksForArticle(articleId: number): Promise<{ id: number; title: string }[]> {
  const rows = await q<{ id: number; title: string }>(
    'SELECT DISTINCT b.id, b.title FROM chapters c JOIN books b ON b.id = c.book_id WHERE c.article_id = $1',
    [articleId],
  )
  return rows.map((r) => ({ id: Number(r.id), title: r.title }))
}
