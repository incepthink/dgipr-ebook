'use client'

import { CalendarDays, MapPin, Newspaper, X } from 'lucide-react'
import Link from 'next/link'
import { DISTRICTS, districtName } from '@/lib/districts'
import { img } from '@/lib/img'
import { INTERESTS } from '@/lib/interests'
import { dateMr, toDevanagariDigits } from '@/lib/marathi'
import type { ArticleHit } from '@/lib/search'
import { SEARCH_EXAMPLES } from '@/lib/searchTerms'
import { KIND_LABEL } from '@/lib/types'

export interface Filters {
  district: string
  topic: string
  date: string
}

export const NO_FILTERS: Filters = { district: '', topic: '', date: '' }

/** District, topic and (for editions) date: one scrolling row of pills. */
export function FilterBar({
  value,
  onChange,
  showDate,
}: {
  value: Filters
  onChange: (f: Filters) => void
  showDate: boolean
}) {
  const any = value.district || value.topic || value.date
  return (
    <div className="flt" role="group" aria-label="गाळणी">
      <label className={`flt-pill flt-select${value.district ? ' is-on' : ''}`}>
        <MapPin size={16} aria-hidden />
        <span className="sr-only">जिल्हा</span>
        <select value={value.district} onChange={(e) => onChange({ ...value, district: e.target.value })}>
          <option value="">सर्व जिल्हे</option>
          {[...DISTRICTS]
            .sort((a, b) => a.mr.localeCompare(b.mr, 'mr'))
            .map((d) => (
              <option key={d.key} value={d.key}>
                {d.mr}
              </option>
            ))}
        </select>
      </label>
      {showDate && (
        <label className={`flt-pill flt-select${value.date ? ' is-on' : ''}`}>
          <CalendarDays size={16} aria-hidden />
          <span className="sr-only">आवृत्तीची तारीख</span>
          <input type="date" value={value.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => onChange({ ...value, date: e.target.value })} />
        </label>
      )}
      {INTERESTS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`flt-pill${value.topic === t.key ? ' is-on' : ''}`}
          aria-pressed={value.topic === t.key}
          onClick={() => onChange({ ...value, topic: value.topic === t.key ? '' : t.key })}
        >
          {t.short}
        </button>
      ))}
      {any && (
        <button type="button" className="flt-pill flt-clear" onClick={() => onChange(NO_FILTERS)}>
          <X size={16} aria-hidden /> काढा
        </button>
      )}
    </div>
  )
}

/** One article: from search, a district, or "for you". */
export function ArticleCard({ hit, compact }: { hit: ArticleHit; compact?: boolean }) {
  const place = hit.district ? districtName(hit.district) : hit.kicker
  return (
    <Link href={hit.href} className={`art${compact ? ' art--rail' : ''}`}>
      <span className="art-img" aria-hidden>
        {hit.image ? <img src={img(hit.image, 384)} alt="" loading="lazy" decoding="async" /> : <Newspaper size={26} />}
      </span>
      <span className="art-body">
        <span className="art-meta">
          {place && <b>{place}</b>}
          {hit.publishedAt && <span>{dateMr(hit.publishedAt)}</span>}
        </span>
        <span className="art-title">{hit.title}</span>
        {!compact && hit.snippet && (
          <span className="art-snip">
            {hit.snippet.before}
            <mark>{hit.snippet.match}</mark>
            {hit.snippet.after}
          </span>
        )}
        <span className="art-book">
          {KIND_LABEL[hit.book.kind]} · {hit.book.kind === 'edition' && hit.book.editionDate ? dateMr(hit.book.editionDate) : hit.book.title}
        </span>
      </span>
    </Link>
  )
}

export function ArticleResults({
  title,
  hits,
  loading,
  onExample,
}: {
  title: string
  hits: ArticleHit[]
  loading: boolean
  onExample?: (word: string) => void
}) {
  return (
    <section className="lib-band lib-band--paper" aria-live="polite">
      <div className="lib-shell">
        <div className="lib-shelf-head">
          <h2 className="lib-shelf-title">{title}</h2>
          <span className="lib-count">{loading ? '…' : toDevanagariDigits(hits.length)}</span>
        </div>
        {loading && !hits.length ? (
          <div className="art-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="art art--skeleton" aria-hidden />
            ))}
          </div>
        ) : hits.length ? (
          <div className="art-list">
            {hits.map((h) => (
              <ArticleCard key={h.articleId} hit={h} />
            ))}
          </div>
        ) : (
          <div className="art-empty">
            <p>या शोधासाठी लेख सापडले नाहीत. लेख मराठीत आहेत — मराठी शब्द वापरून पाहा:</p>
            {onExample && (
              <div className="art-examples">
                {SEARCH_EXAMPLES.map((w) => (
                  <button key={w} type="button" className="flt-pill" onClick={() => onExample(w)}>
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export function ArticleRail({ title, hits }: { title: string; hits: ArticleHit[] }) {
  if (!hits.length) return null
  return (
    <section className="cr" aria-label={title}>
      <div className="lib-shell">
        <div className="cr-head">
          <h2>{title}</h2>
        </div>
        <div className="cr-rail">
          {hits.map((h) => (
            <ArticleCard key={h.articleId} hit={h} compact />
          ))}
        </div>
      </div>
    </section>
  )
}
