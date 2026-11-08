# महासंवाद ई-पुस्तके — DGIPR flipbook e-books (POC)

Marathi news from [mahasamvad.in](https://mahasamvad.in), bound into books that read like the real thing: page-curl flips, two-page spreads, real pagination of Devanagari text.

- **`/`** — the library: the newest book up front, then shelves of editions, special issues and themed collections.
- **`/read/<slug>`** — the flipbook reader. `?p=12` opens on page 12; `?preview=1` shows drafts.
- **`/admin`** — create books, import articles from Mahasamvad or write them, order chapters, publish.

## Run it

```bash
npm install
cp .env.example .env.local     # defaults match the local database below
npm run db:start               # project-local Postgres in ./.pgdata on port 5435
npm run seed                   # imports ~36 recent posts, builds 3 sample books
npm run dev                    # http://localhost:3000
```

`db:start` needs PostgreSQL's binaries. It finds them under `C:\Program Files\PostgreSQL\<version>\bin` or on `PATH`, or you can set `PG_BIN`. To use any other Postgres (RDS included), point `DATABASE_URL` at it and drop `DATABASE_SSL=disable`. The schema is created on first query.

No auth: this is a POC, and `/admin` is open.

## How the reader works

**Pagination happens in the browser** (`src/lib/paginate/`). Each article becomes blocks: an opener (photo, kicker, headline, deck, byline), then paragraphs, subheads, lists, quotes and figures. These are poured into an off-screen page styled exactly like the visible one:

- Paragraphs are cut at the last word boundary that fits. Devanagari only breaks at spaces, so a conjunct is never split. Inline markup survives the cut (DOM `Range`).
- Lists and quotes are cut between items. Photos shrink (cropping slightly) into the space left, or move to the next page.
- Subheads never end a page. Each side of a page break keeps at least two lines (widows and orphans).
- In spreads, chapters open on a right-hand page. The facing left page carries the chapter's photo full-bleed, or a section divider.
- Each page records an anchor (chapter, block, character offset). When the font size or window size changes, the book re-flows and returns to the *same words*, not the same page number. Bookmarks and the resume position are anchors too.

**The page curl** is [StPageFlip](https://github.com/Nodlik/StPageFlip) (`page-flip`), wrapped in `src/components/reader/FlipBook.tsx`. The library moves page elements into its own DOM, so the wrapper creates the page shells itself and React renders into them through portals. Only pages near the open spread get content.

**Reader features:** contents and bookmarks drawer, thumbnail strip, page slider, keyboard (←/→, PgUp/PgDn, Home/End, +/−, Esc), swipe, edge taps, zoom (buttons, Ctrl+wheel, pinch) with panning, font size (re-flows), day/sepia/night, fullscreen, synthesized page-turn sound (off by default on touch devices), bookmarks with ribbons, a "continue where you left off" prompt, and a share sheet (WhatsApp, copy link, native share) that links to the current page. A plain-text version of the whole book is available to screen readers.

## Content

The importer (`src/lib/mahasamvad/wp.ts`) uses the WordPress REST API. Article bodies are kept as HTML, sanitized to a fixed allow-list (`src/lib/sanitize.ts`) and normalized on the way in:

- Photos sharing a paragraph with text become figures.
- Bold-only paragraphs become subheads.
- The `मुंबई, दि. १५ :` dateline gets its own style.
- The closing `०००` and sign-off are marked.
- Mahasamvad's placeholder logo isn't treated as a photo.

Imports upsert by URL, so re-importing a post refreshes it. Photos are served through Next's image optimizer.

Uploads (covers, article photos) go to `./uploads` on local disk. On a serverless host, swap this for object storage.

## Layout

```
src/app/(public)/page.tsx           library
src/app/(public)/read/[slug]/       reader route (server loads the book, client renders)
src/app/admin/                      books list, book editor, article editor, articles
src/app/api/                        books, chapters, articles, import (+browse, categories), uploads
src/components/reader/              Reader, FlipBook, PageView, Cover, Panels, ThumbStrip
src/components/admin/               BookEditor, ChapterList (dnd-kit), ImportPanel, ArticleEditor (Tiptap)
src/lib/paginate/                   layout, blocks, paginate, anchors
src/styles/reader.css               the book: page typography, covers, chrome
scripts/seed.ts, scripts/pg.mjs
```
