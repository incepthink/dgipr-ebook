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

## Reading features

- **सोपे वाचन (easy reading):** a scrolling single-column view of the same book, with large text, made for phones. The reader switches with the book icon in the top bar. Paragraphs are numbered exactly as the paginator numbers blocks (`src/components/reader/bookText.ts`), so switching views, bookmarks, search hits and highlights keep the exact paragraph.
- **ऐका (read aloud):** the device's own speech engine (Marathi voice, falling back to Hindi). It's free, and nothing is sent to a server. It follows along by scrolling or turning pages, with speed control (`useReadAloud.ts`).
- **Search:** inside a book (the reader's search panel), and across all published articles on the home page (`/api/search`, `src/lib/search.ts`). Results open the reader at the paragraph containing the word (`?at=…&find=…`).
- **Filters on the home page:** district (each book lists its articles' districts), topic and edition date.
- **For you:** for signed-in readers, articles from their district and books on their chosen interests.
- **Highlights & notes:** select text in easy-reading mode, pick a colour, and add a note. They're stored on the device for guests and synced to the account (`highlights` table) for signed-in readers. They're listed in the reader's contents panel and in My Library.
- **Share:** shares a link to the current article (`/read/<slug>?at=<chapter>.0.0`), which previews with that article's headline, summary and photo. Only the link is shared; the book is never sent as a file.
- On phones the reader's top bar shows four icons (easy reading, contents, bookmark, ⋮). Search, listen, text settings, share and thumbnails live under ⋮.

Locally on PGlite, use `PG_POOL_MAX=1`: PGlite serves one connection at a time, and a larger pool makes pages that run parallel queries wait on idle connections. Real Postgres doesn't need this.

## Demo library

`npm run seed:demo` builds about 20 published books from real Mahasamvad news: one daily edition per recent day (up to 6), the district round-up, and special issues and themed collections by topic (health, education, women, industry, tourism, sport, schemes, cabinet decisions, infrastructure, environment, rural development, social justice, …). It is safe to re-run: articles are upserted by URL and books by slug. It refuses to run against any database that isn't on this machine unless `--allow-remote` is passed, and it refuses read-only mode.

## Looking at the live database safely

Set `DATABASE_READONLY=1` (with the production `DATABASE_URL`) to browse the real books with a new build without changing anything. Every connection is opened read-only, so Postgres itself rejects any INSERT, UPDATE or DELETE. No tables are created, and sign-in and other changes are switched off.

## Accounts

- **`/login`** — sign in with Google, or with an email and password. Guests can still read; their place and bookmarks stay in that browser only.
- **`/my-library`** — books in progress (with page and %), saved, finished, and every bookmark, each opening the reader at that exact spot (`/read/<slug>?at=c.b.o`).
- **`/profile`** — name, district, interests, notifications, sign out, delete account (removes all the reader's data).

For a signed-in reader, the reader saves the place (debounced, and on leaving the tab) and the bookmarks to the account, so they follow the reader across devices. Tables: `users`, `sessions`, `auth_throttle`, `reading_progress`, `bookmarks`, `saved_books`. They are created on first query, next to the existing ones. Sessions are random tokens in an httpOnly cookie, stored hashed. Passwords use scrypt. Google sign-in uses the OAuth code flow with PKCE and a state check. A Google sign-in with the same email as an existing account links to it and removes that account’s old password, since the email was never verified at sign-up.

**Google sign-in needs a Google OAuth client.** In Google Cloud Console → APIs & Services: set up the OAuth consent screen (External; app name, support email, the email and profile scopes), then Credentials → Create credentials → OAuth client ID → Web application. Add an authorised redirect URI for every address the site runs at:

```
https://dgipr-ebook.vercel.app/api/auth/google/callback
http://localhost:3000/api/auth/google/callback
```

Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Vercel: Production; locally: `.env`). Without them the Google button is hidden and email sign-in is offered alone. Google does not allow private network addresses (e.g. `http://192.168.x.x:3000`) as redirect URIs, so on a phone over local Wi-Fi only email sign-in works; on the deployed site Google works everywhere.

**Admin console.** `/admin`, its APIs and `?preview=1` drafts need an admin account. Nobody can become an admin from the website. The person signs in once, then someone with `DATABASE_URL` runs:

```bash
npm run make-admin -- officer@example.gov.in      # or a mobile number; --revoke to undo
```

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
