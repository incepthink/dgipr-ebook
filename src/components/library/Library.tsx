'use client'

import { ArrowLeft, ArrowRight, BookMarked, BookmarkCheck, BookmarkPlus, BookOpen, Info, LogIn, Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BottomNav } from '@/components/account/BottomNav'
import { call, initial } from '@/components/account/client'
import type { PublicUser } from '@/lib/auth/users'
import { dateMr, todayIso, toDevanagariDigits } from '@/lib/marathi'
import { encodeAnchor } from '@/lib/paginate/anchors'
import type { ShelfItem } from '@/lib/reading'
import type { BookKind, BookSummary } from '@/lib/types'
import { KIND_LABEL } from '@/lib/types'
import { districtName } from '@/lib/districts'
import { INTERESTS } from '@/lib/interests'
import type { ArticleHit } from '@/lib/search'
import { BookCover } from './BookCover'
import { searchTerms } from '@/lib/searchTerms'
import { ArticleRail, ArticleResults, FilterBar, NO_FILTERS, type Filters } from './Discover'

const SHELVES: { kind: BookKind; title: string }[] = [
  { kind: 'edition', title: 'आवृत्त्या' },
  { kind: 'special', title: 'विशेषांक' },
  { kind: 'themed', title: 'विषयवार संग्रह' },
]

type Filter = 'all' | BookKind

const TABS: { id: Filter; label: string }[] = [{ id: 'all', label: 'सर्व' }, ...SHELVES.map((s) => ({ id: s.kind, label: s.title }))]

function LibCover({ b, hero }: { b: BookSummary; hero?: boolean }) {
  return <BookCover b={b} width={hero ? 828 : 640} />
}

/** Save-for-later on a shelf card. Guests are sent to sign in first. */
function SaveButton({ b, saved, signedIn, onToggle }: { b: BookSummary; saved: boolean; signedIn: boolean; onToggle: (id: number, on: boolean) => void }) {
  const router = useRouter()
  return (
    <button
      type="button"
      className="lib-save"
      aria-pressed={saved}
      aria-label={saved ? `${b.title} जतन केलेल्यांतून काढा` : `${b.title} नंतर वाचण्यासाठी जतन करा`}
      title={saved ? 'जतन केले' : 'जतन करा'}
      onClick={() => (signedIn ? onToggle(b.id, !saved) : router.push('/login?next=/'))}
    >
      {saved ? <BookmarkCheck size={22} strokeWidth={2} /> : <BookmarkPlus size={22} strokeWidth={1.8} />}
    </button>
  )
}

function ContinueReading({ items }: { items: ShelfItem[] }) {
  return (
    <section className="cr" aria-labelledby="cr-h">
      <div className="lib-shell">
        <div className="cr-head">
          <h2 id="cr-h">वाचन सुरू ठेवा</h2>
          <Link href="/my-library">
            सर्व पहा <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <div className="cr-rail">
          {items.map(({ book, progress }) => {
            const pct = Math.round((progress?.percent ?? 0) * 100)
            return (
              <Link key={book.id} href={`/read/${book.slug}${progress ? `?at=${encodeAnchor(progress.anchor)}` : ''}`} className="cr-card">
                <div className="cr-cover">
                  <BookCover b={book} width={384} />
                </div>
                <div className="cr-body">
                  <b>{book.kind === 'edition' && book.editionDate ? dateMr(book.editionDate) : book.title}</b>
                  {progress && (
                    <span>
                      पान {toDevanagariDigits(progress.page)} / {toDevanagariDigits(progress.pageCount)} · {toDevanagariDigits(pct)}%
                    </span>
                  )}
                  <div className="ml-bar" aria-hidden>
                    <i style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                  <span className="cr-go">
                    पुढे वाचा <ArrowRight size={16} aria-hidden />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** What a book is called on the shelf: editions all share a masthead, so their date names them. */
function shelfLabel(b: BookSummary) {
  return b.kind === 'edition' && b.editionDate ? dateMr(b.editionDate) : b.title
}

function matches(b: BookSummary, q: string) {
  const hay = [b.title, b.subtitle, b.description, KIND_LABEL[b.kind], b.editionDate && dateMr(b.editionDate), ...b.leadTitles]
  return hay.some((s) => s?.toLowerCase().includes(q))
}

/** Books on the reader's chosen topics, newest first. */
function ForYouShelf({ books, interests, exclude }: { books: BookSummary[]; interests: string[]; exclude: BookSummary | null }) {
  const words = INTERESTS.filter((t) => interests.includes(t.key)).map((t) => t.word.toLowerCase())
  if (!words.length) return null
  const picks = books.filter((b) => b !== exclude && words.some((w) => matches(b, w))).slice(0, 12)
  if (!picks.length) return null
  return (
    <section className="cr" aria-label="तुमच्या आवडीचे">
      <div className="lib-shell">
        <div className="cr-head">
          <h2>तुमच्या आवडीचे</h2>
          <Link href="/profile">आवड बदला</Link>
        </div>
        <div className="lib-rail">
          {picks.map((b) => (
            <Link key={b.id} href={`/read/${b.slug}`} className="lib-card">
              <LibCover b={b} />
              <span className="lib-card-t">{shelfLabel(b)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

interface LibraryProps {
  books: BookSummary[]
  user?: PublicUser | null
  reading?: ShelfItem[]
  savedIds?: number[]
  notice?: string | null
  /** Signed in with a district: its latest articles. */
  fromDistrict?: ArticleHit[]
}

export function Library({ books, user = null, reading = [], savedIds = [], notice = null, fromDistrict = [] }: LibraryProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const topic = INTERESTS.find((t) => t.key === filters.topic) ?? null
  const filtering = !!(q || filters.district || filters.topic || filters.date)

  /* ------------------------------- filters in the address, for "back" */

  // ?q=…&district=…&topic=…&date=…&tab=… — so the phone's back gesture
  // leaves a filtered view, and a filtered view can be reloaded or shared.
  const [urlReady, setUrlReady] = useState(false)
  const readUrl = useCallback(() => {
    const sp = new URLSearchParams(window.location.search)
    const tab = sp.get('tab')
    setFilter(tab === 'edition' || tab === 'special' || tab === 'themed' ? tab : 'all')
    setQuery(sp.get('q') ?? '')
    setFilters({ district: sp.get('district') ?? '', topic: sp.get('topic') ?? '', date: sp.get('date') ?? '' })
    setUrlReady(true)
  }, [])
  useEffect(() => {
    readUrl()
    window.addEventListener('popstate', readUrl)
    return () => window.removeEventListener('popstate', readUrl)
  }, [readUrl])

  const pushedRef = useRef(false)
  useEffect(() => {
    // Not before the address has been read, or the empty first state would erase it.
    if (!urlReady) return
    const sp = new URLSearchParams()
    if (filter !== 'all') sp.set('tab', filter)
    if (query.trim()) sp.set('q', query.trim())
    if (filters.district) sp.set('district', filters.district)
    if (filters.topic) sp.set('topic', filters.topic)
    if (filters.date) sp.set('date', filters.date)
    const next = `${window.location.pathname}${sp.size ? `?${sp}` : ''}`
    if (next === `${window.location.pathname}${window.location.search}`) return
    const wasPlain = !window.location.search
    // Leaving the plain home page adds one history entry; refining a filter replaces it.
    if (wasPlain && sp.size) {
      window.history.pushState({ dgiprHome: true }, '', next)
      pushedRef.current = true
    } else window.history.replaceState(window.history.state, '', next)
  }, [filter, query, filters, urlReady])

  /** "← मागे": back to the plain home page (and out of the history entry the filter made). */
  const goBack = () => {
    if (pushedRef.current && window.history.state?.dgiprHome) {
      pushedRef.current = false
      window.history.back()
      return
    }
    setQuery('')
    setFilter('all')
    setFilters(NO_FILTERS)
  }

  /* ---------------------------------------- article search (all books) */

  // Typed words, else the chosen topic's word; optionally within a district.
  const term = q.length >= 2 ? query.trim() : (topic?.word ?? '')
  const [hits, setHits] = useState<ArticleHit[]>([])
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    if (!term && !filters.district) {
      setHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    const ctl = new AbortController()
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ limit: '40' })
      if (term) qs.set('q', term)
      if (filters.district) qs.set('district', filters.district)
      fetch(`/api/search?${qs}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits: ArticleHit[] }) => setHits(d.hits))
        .catch(() => {})
        .finally(() => !ctl.signal.aborted && setSearching(false))
    }, 300)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [term, filters.district])

  // English typed (or a translated page) still finds Marathi books: "woman" → महिला.
  const qTerms = useMemo(() => (q.length >= 2 ? searchTerms(query).map((t) => t.toLowerCase()) : q ? [q] : []), [q, query])
  const keepBook = (b: BookSummary) =>
    (!qTerms.length || qTerms.some((t) => matches(b, t))) &&
    (!topic || matches(b, topic.word.toLowerCase())) &&
    (!filters.district || b.districts.includes(filters.district)) &&
    (!filters.date || (b.kind === 'edition' && b.editionDate === filters.date))
  const resultsTitle = [q.length >= 2 ? `"${query.trim()}"` : topic?.short, filters.district && districtName(filters.district)].filter(Boolean).join(' · ')
  const [saved, setSaved] = useState(() => new Set(savedIds))

  const toggleSave = async (id: number, on: boolean) => {
    const flip = (v: boolean) =>
      setSaved((s) => {
        const n = new Set(s)
        if (v) n.add(id)
        else n.delete(id)
        return n
      })
    flip(on)
    try {
      await call('/api/me/saved', 'POST', { bookId: id, saved: on })
    } catch {
      flip(!on)
    }
  }

  // The newest daily edition leads the page; other books only lead when there is no edition.
  const lead = books.find((b) => b.kind === 'edition') ?? books[0]
  const showHero = !!lead && !filtering && (filter === 'all' || filter === lead.kind)

  const shelves = SHELVES.filter((s) => filter === 'all' || filter === s.kind)
    .map((s) => ({
      ...s,
      items: books.filter((b) => b.kind === s.kind && keepBook(b) && !(showHero && b === lead)),
    }))
    .filter((s) => s.items.length > 0)

  const leadBadge =
    lead?.kind === 'edition' && lead.editionDate
      ? `${lead.editionDate === todayIso() ? 'आजची आवृत्ती' : 'नवी आवृत्ती'} · ${dateMr(lead.editionDate)}`
      : lead && `नवीन · ${KIND_LABEL[lead.kind]}`

  return (
    <div className="lib has-bnav">
      <header className="lib-bar">
        <div className="lib-shell lib-bar-in">
          <div className="lib-bar-row">
            <Link href="/" className="lib-brand">
              <span className="lib-brand-mark">
                <BookOpen size={22} strokeWidth={1.8} aria-hidden />
              </span>
              <span className="lib-brand-name">महासंवाद ई-पुस्तके</span>
            </Link>
            <label className="lib-search">
              <Search size={20} strokeWidth={2} aria-hidden />
              <span className="sr-only">शोधा</span>
              <input
                type="search"
                placeholder="पुस्तक किंवा बातमी शोधा"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {user?.role === 'admin' && (
              <Link href="/admin" className="lib-iconbtn acct-desktop" aria-label="व्यवस्थापन" title="व्यवस्थापन">
                <SlidersHorizontal size={22} strokeWidth={1.8} aria-hidden />
              </Link>
            )}
            {user ? (
              <>
                <Link href="/my-library" className="acct-lib">
                  <BookMarked size={20} strokeWidth={1.8} aria-hidden /> माझे ग्रंथालय
                </Link>
                <Link href="/profile" className="acct-avatar acct-desktop" aria-label="प्रोफाइल" title={user.name ?? 'प्रोफाइल'}>
                  {initial(user.name ?? user.email ?? user.mobile)}
                </Link>
              </>
            ) : (
              <Link href="/login" className="acct-btn acct-desktop">
                <LogIn size={18} strokeWidth={2} aria-hidden /> प्रवेश करा
              </Link>
            )}
          </div>
          <nav className="lib-tabs" aria-label="प्रकार">
            {TABS.map((t) => (
              <button key={t.id} type="button" className="lib-tab" aria-pressed={t.id === filter} onClick={() => setFilter(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="lib-shell">
        <FilterBar
          value={filters}
          showDate={filter === 'edition'}
          onChange={(f) => {
            setFilters(f)
            if (f.date) setFilter('edition')
          }}
        />
      </div>

      {notice && (
        <div className="lib-shell">
          <div className="lib-notice" role="status">
            <Info size={18} aria-hidden /> {notice}
          </div>
        </div>
      )}

      {(filtering || filter !== 'all') && (
        <div className="lib-shell">
          <div className="back-bar">
            <button type="button" className="back-btn" onClick={goBack}>
              <ArrowLeft size={20} strokeWidth={2.2} aria-hidden /> मागे
            </button>
            <span className="back-what">{[filter !== 'all' ? TABS.find((t) => t.id === filter)?.label : null, resultsTitle].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
      )}

      {reading.length > 0 && !filtering && filter === 'all' && <ContinueReading items={reading} />}

      {(term || filters.district) && (
        <ArticleResults title={`लेख · ${resultsTitle}`} hits={hits} loading={searching} onExample={(w) => setQuery(w)} />
      )}

      {!lead ? (
        <div className="lib-empty mx-auto max-w-xl px-6">
          <BookOpen size={44} strokeWidth={1.4} aria-hidden />
          <h2>अजून एकही पुस्तक प्रकाशित झालेले नाही</h2>
          {user?.role === 'admin' ? (
            <>
              <p className="-mt-2 text-muted">व्यवस्थापन विभागात नवे पुस्तक तयार करून प्रकाशित करा.</p>
              <Link href="/admin" className="lib-tab inline-flex items-center gap-2">
                व्यवस्थापनाकडे जा <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <p className="-mt-2 text-muted">लवकरच नवीन पुस्तके येथे उपलब्ध होतील.</p>
          )}
        </div>
      ) : (
        <>
          {showHero && (
            <section className="lib-hero">
              <span className="lib-hero-mark" aria-hidden>
                महासंवाद
              </span>
              <div className="lib-shell lib-hero-in">
                <Link href={`/read/${lead.slug}`} className="lib-hero-cover" aria-label={`${lead.title} वाचा`}>
                  <LibCover b={lead} hero />
                </Link>
                <div className="lib-hero-text">
                  <span className="lib-badge">{leadBadge}</span>
                  <h1 className="lib-hero-title">{lead.title}</h1>
                  {lead.subtitle && <p className="lib-hero-sub">{lead.subtitle}</p>}
                  {lead.leadTitles.length > 0 && (
                    <div className="lib-heads">
                      {lead.leadTitles.slice(0, 3).map((t, i) => (
                        <Link key={i} href={`/read/${lead.slug}`} className="lib-head">
                          <span className="lib-head-n">{toDevanagariDigits(i + 1)}</span>
                          <span className="lib-head-t">{t}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="lib-hero-actions">
                    <Link href={`/read/${lead.slug}`} className="lib-cta">
                      <BookOpen size={20} strokeWidth={2} aria-hidden />
                      वाचायला सुरुवात करा
                    </Link>
                    <span className="lib-hero-count">{toDevanagariDigits(lead.chapterCount)} लेख</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {!filtering && filter === 'all' && user?.district && (
            <ArticleRail title={`तुमच्या जिल्ह्यातून · ${districtName(user.district)}`} hits={fromDistrict} />
          )}
          {!filtering && filter === 'all' && <ForYouShelf books={books} interests={user?.interests ?? []} exclude={showHero ? lead : null} />}

          <main className="pb-10">
            {shelves.map((s, i) => (
              <section key={s.kind} className={`lib-band${i % 2 === 1 ? ' lib-band--paper' : ''}`}>
                <div className="lib-shell">
                  <div className="lib-shelf-head">
                    <h2 className="lib-shelf-title">{s.title}</h2>
                    <span className="lib-count">{toDevanagariDigits(s.items.length)}</span>
                    {filter === 'all' && (
                      <button type="button" className="lib-more" onClick={() => setFilter(s.kind)}>
                        सर्व पहा <ArrowRight size={18} aria-hidden />
                      </button>
                    )}
                  </div>
                  <div className={filter === 'all' ? 'lib-rail' : 'lib-grid'}>
                    {s.items.map((b) => (
                      <div key={b.id} className="lib-card">
                        <Link href={`/read/${b.slug}`} className="lib-card-link" tabIndex={-1} aria-hidden>
                          <LibCover b={b} />
                        </Link>
                        <div className="lib-card-row">
                          <Link href={`/read/${b.slug}`} className="lib-card-text">
                            <span className="lib-card-t">{shelfLabel(b)}</span>
                            {b.kind !== 'edition' && b.subtitle && <span className="lib-card-sub line-clamp-1">{b.subtitle}</span>}
                          </Link>
                          <SaveButton b={b} saved={saved.has(b.id)} signedIn={!!user} onToggle={toggleSave} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}

            {shelves.length === 0 && !showHero && !hits.length && !searching && (
              <div className="lib-empty">
                <Search size={44} strokeWidth={1.5} aria-hidden />
                <h2>काहीही सापडले नाही</h2>
                <button
                  type="button"
                  className="lib-tab"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                    setFilters(NO_FILTERS)
                  }}
                >
                  सर्व पुस्तके दाखवा
                </button>
              </div>
            )}
          </main>
        </>
      )}

      <footer className="lib-foot">
        <div className="lib-shell lib-foot-in">
          <span>© महाराष्ट्र शासन · माहिती व जनसंपर्क महासंचालनालय</span>
          <a href="https://mahasamvad.in" target="_blank" rel="noreferrer">
            mahasamvad.in
          </a>
        </div>
      </footer>
      <BottomNav signedIn={!!user} />
    </div>
  )
}
