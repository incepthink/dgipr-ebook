'use client'

import { ArrowRight, BookOpen, Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import { Cover } from '@/components/reader/Cover'
import { dateMr, todayIso, toDevanagariDigits } from '@/lib/marathi'
import type { BookKind, BookSummary } from '@/lib/types'
import { KIND_LABEL } from '@/lib/types'

const SHELVES: { kind: BookKind; title: string }[] = [
  { kind: 'edition', title: 'आवृत्त्या' },
  { kind: 'special', title: 'विशेषांक' },
  { kind: 'themed', title: 'विषयवार संग्रह' },
]

type Filter = 'all' | BookKind

const TABS: { id: Filter; label: string }[] = [{ id: 'all', label: 'सर्व' }, ...SHELVES.map((s) => ({ id: s.kind, label: s.title }))]

function LibCover({ b, hero }: { b: BookSummary; hero?: boolean }) {
  return (
    <div className="book-vars lib-cv" style={{ '--accent': b.accentColor } as CSSProperties}>
      <div className="cover-box">
        <Cover
          book={b}
          leadImage={b.leadImage}
          lines={b.leadTitles.map((t) => ({ title: t, kicker: null }))}
          imgWidth={hero ? 828 : 640}
        />
      </div>
    </div>
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

export function Library({ books }: { books: BookSummary[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // The newest daily edition leads the page; other books only lead when there is no edition.
  const lead = books.find((b) => b.kind === 'edition') ?? books[0]
  const showHero = !!lead && !q && (filter === 'all' || filter === lead.kind)

  const shelves = SHELVES.filter((s) => filter === 'all' || filter === s.kind)
    .map((s) => ({
      ...s,
      items: books.filter((b) => b.kind === s.kind && (!q || matches(b, q)) && !(showHero && b === lead)),
    }))
    .filter((s) => s.items.length > 0)

  const leadBadge =
    lead?.kind === 'edition' && lead.editionDate
      ? `${lead.editionDate === todayIso() ? 'आजची आवृत्ती' : 'नवी आवृत्ती'} · ${dateMr(lead.editionDate)}`
      : lead && `नवीन · ${KIND_LABEL[lead.kind]}`

  return (
    <div className="lib">
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
            <Link href="/admin" className="lib-iconbtn" aria-label="व्यवस्थापन" title="व्यवस्थापन">
              <SlidersHorizontal size={22} strokeWidth={1.8} aria-hidden />
            </Link>
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

      {!lead ? (
        <div className="lib-empty mx-auto max-w-xl px-6">
          <BookOpen size={44} strokeWidth={1.4} aria-hidden />
          <h2>अजून एकही पुस्तक प्रकाशित झालेले नाही</h2>
          <p className="-mt-2 text-muted">व्यवस्थापन विभागात नवे पुस्तक तयार करून प्रकाशित करा.</p>
          <Link href="/admin" className="lib-tab inline-flex items-center gap-2">
            व्यवस्थापनाकडे जा <ArrowRight size={18} />
          </Link>
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
                      <Link key={b.id} href={`/read/${b.slug}`} className="lib-card">
                        <LibCover b={b} />
                        <span className="lib-card-t">{shelfLabel(b)}</span>
                        {b.kind !== 'edition' && b.subtitle && <span className="lib-card-sub line-clamp-1">{b.subtitle}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            ))}

            {shelves.length === 0 && !showHero && (
              <div className="lib-empty">
                <Search size={44} strokeWidth={1.5} aria-hidden />
                <h2>काहीही सापडले नाही</h2>
                <button
                  type="button"
                  className="lib-tab"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
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
    </div>
  )
}
