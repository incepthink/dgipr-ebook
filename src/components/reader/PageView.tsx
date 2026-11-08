'use client'

import { memo, useMemo } from 'react'
import { img } from '@/lib/img'
import { hydrateImages } from '@/lib/paginate/blocks'
import { pageVars } from '@/lib/paginate/paginate'
import type { Layout, Page, Pagination } from '@/lib/paginate/types'
import { dateMr, dateWithWeekdayMr, toDevanagariDigits } from '@/lib/marathi'
import type { ReaderBook } from '@/lib/types'
import { KIND_LABEL } from '@/lib/types'
import { Cover, type CoverData } from './Cover'

export interface PageContext {
  data: ReaderBook
  pag: Pagination
  layout: Layout
  cover: CoverData
}

export function sideClass(i: number, layout: Layout): string {
  if (layout.mode === 'single') return 'page--single'
  if (i === 0) return 'page--recto'
  return i % 2 === 1 ? 'page--verso' : 'page--recto'
}

export const folio = (i: number) => toDevanagariDigits(i + 1)

interface Props {
  ctx: PageContext
  index: number
  page: Page
  /** Far from the open spread: paper only, no content. */
  dormant?: boolean
  bookmarked?: boolean
}

function PageViewInner({ ctx, index, page, dormant, bookmarked }: Props) {
  const { data, pag, layout } = ctx
  const side = sideClass(index, layout)
  const vars = useMemo(() => pageVars(layout, pag.geometry), [layout, pag.geometry])
  const ribbon = bookmarked ? <div className="ribbon" aria-hidden /> : null

  if (dormant && page.kind !== 'cover' && page.kind !== 'back' && page.kind !== 'endpaper') {
    return <div className={`page ${side}`} style={vars} />
  }

  switch (page.kind) {
    case 'cover':
      return (
        <div className="page page--cover page--hard" style={vars}>
          <Cover {...ctx.cover} />
        </div>
      )
    case 'endpaper':
      return (
        <div className={`page page--hard ${side}`} style={vars}>
          <div className="endpaper" />
        </div>
      )
    case 'title':
      return (
        <div className={`page ${side}`} style={vars}>
          <TitlePage data={data} />
          {ribbon}
        </div>
      )
    case 'imprint':
      return (
        <div className={`page ${side}`} style={vars}>
          <Imprint data={data} pages={pag.pages.length} />
          {ribbon}
        </div>
      )
    case 'toc':
      return (
        <div className={`page ${side}`} style={vars}>
          <TocPage ctx={ctx} page={page} />
          {ribbon}
        </div>
      )
    case 'blank':
      return (
        <div className={`page ${side}`} style={vars}>
          <div className="ornament-page" aria-hidden>
            <svg viewBox="0 0 120 24" fill="currentColor">
              <path d="M60 4l5 8-5 8-5-8z" />
              <circle cx="40" cy="12" r="2.2" />
              <circle cx="80" cy="12" r="2.2" />
              <path d="M6 12h26M88 12h26" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        </div>
      )
    case 'section':
      return (
        <div className={`page ${side}`} style={vars}>
          <div className="section-page">
            <small>विभाग</small>
            <h2>{page.label}</h2>
            <i />
          </div>
          {ribbon}
        </div>
      )
    case 'photo': {
      const ch = page.chapter != null ? data.chapters[page.chapter] : null
      return (
        <div className={`page ${side}`} style={vars}>
          <div className="photo-page">
            {page.image && <img src={img(page.image, 1080)} alt="" decoding="async" />}
            {page.label && (
              <div className="pp-section">
                <small>विभाग</small>
                <b>{page.label}</b>
              </div>
            )}
            <div className="pp-credit">
              {ch?.article.kicker && <b>{ch.article.kicker}</b>}
              {page.credit && <span>{page.credit}</span>}
            </div>
          </div>
          {ribbon}
        </div>
      )
    }
    case 'content':
      return <ContentPage ctx={ctx} index={index} page={page} side={side} vars={vars} ribbon={ribbon} />
    case 'colophon':
      return (
        <div className={`page ${side}`} style={vars}>
          <div className="colophon">
            <div className="end">समाप्त</div>
            <div className="mark">०००</div>
            <img src="/emblem.png" alt="" />
            <p>
              माहिती व जनसंपर्क महासंचालनालय
              <br />
              महाराष्ट्र शासन
            </p>
            <a href="https://mahasamvad.in" target="_blank" rel="noreferrer">
              mahasamvad.in
            </a>
          </div>
          {ribbon}
        </div>
      )
    case 'back':
      return (
        <div className="page page--hard" style={vars}>
          <div className="backcover">
            <div className="bc-title">{data.book.title}</div>
            {data.book.description && <p className="bc-desc">{data.book.description}</p>}
            <div className="bc-foot">
              <img src="/emblem.png" alt="" />
              <div>
                माहिती व जनसंपर्क महासंचालनालय, महाराष्ट्र शासन
                <div className="bc-url">mahasamvad.in</div>
              </div>
            </div>
          </div>
        </div>
      )
  }
}

export const PageView = memo(PageViewInner)

function ContentPage({
  ctx,
  index,
  page,
  side,
  vars,
  ribbon,
}: {
  ctx: PageContext
  index: number
  page: Page
  side: string
  vars: Record<string, string>
  ribbon: React.ReactNode
}) {
  const html = useMemo(() => hydrateImages(page.html ?? ''), [page.html])
  const ch = page.chapter != null ? ctx.data.chapters[page.chapter] : null
  const verso = side === 'page--verso'
  const head = verso || !ch ? ctx.data.book.title : ch.article.kicker ?? ch.article.title
  return (
    <div className={`page page--content ${side}`} style={vars}>
      {!page.isOpener && (
        <header className="run-head">
          <span>{verso ? <b>{head}</b> : ch ? ch.article.title : head}</span>
        </header>
      )}
      <div className="page-body">
        <div className="flow" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <footer className="folio">
        {side !== 'page--recto' && side !== 'page--single' ? (
          <>
            {folio(index)}
            <i />
          </>
        ) : side === 'page--recto' ? (
          <>
            <i />
            {folio(index)}
          </>
        ) : (
          folio(index)
        )}
      </footer>
      {ribbon}
    </div>
  )
}

function TitlePage({ data }: { data: ReaderBook }) {
  const { book } = data
  return (
    <div className="fm">
      <div className="fm-kind">{KIND_LABEL[book.kind]}</div>
      <div className={`fm-title${[...book.title].length > 9 ? ' is-long' : ''}`}>{book.title}</div>
      {book.subtitle && <div className="fm-sub">{book.subtitle}</div>}
      <div className="fm-rule" />
      {book.editionDate && <div className="fm-date">{dateWithWeekdayMr(book.editionDate)}</div>}
      <div className="fm-imprint">
        <img src="/emblem.png" alt="" />
        <div>
          <b>माहिती व जनसंपर्क महासंचालनालय</b>
          महाराष्ट्र शासन, मंत्रालय, मुंबई
        </div>
      </div>
    </div>
  )
}

function Imprint({ data, pages }: { data: ReaderBook; pages: number }) {
  const { book, chapters } = data
  const words = useMemo(
    () =>
      chapters.reduce((n, c) => n + c.article.contentHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, 0),
    [chapters],
  )
  const minutes = Math.max(1, Math.round(words / 180))
  return (
    <div className="fm">
      <div className="fm-about">
        <h3>या अंकाविषयी</h3>
        <p>{book.description ?? `${book.title} — महासंवादवरील निवडक बातम्या व लेख.`}</p>
      </div>
      <div className="fm-stats">
        <div>
          <b>{toDevanagariDigits(chapters.length)}</b>
          <span>लेख</span>
        </div>
        <div>
          <b>{toDevanagariDigits(pages)}</b>
          <span>पाने</span>
        </div>
        <div>
          <b>{toDevanagariDigits(minutes)}</b>
          <span>मिनिटे वाचन</span>
        </div>
      </div>
      <div className="fm-small">
        प्रकाशक : माहिती व जनसंपर्क महासंचालनालय, महाराष्ट्र शासन, मंत्रालय, मुंबई — ४०० ०३२.
        <br />
        मजकूर व छायाचित्रे : महासंवाद (mahasamvad.in){book.editionDate ? ` · ${dateMr(book.editionDate)}` : ''}.
      </div>
    </div>
  )
}

function TocPage({ ctx, page }: { ctx: PageContext; page: Page }) {
  const { data, pag } = ctx
  const toc = page.toc!
  return (
    <div className="toc">
      {toc.first && (
        <div className="toc-head">
          <h2>अनुक्रमणिका</h2>
          <span>पान</span>
        </div>
      )}
      {toc.items.map((it, i) =>
        it.type === 'section' ? (
          <div className="toc-section" key={`s${i}`}>
            {it.label}
          </div>
        ) : (
          <button type="button" className="toc-entry" key={`e${it.chapter}`} data-goto={pag.chapterStart[it.chapter]}>
            <span className="toc-num">{toDevanagariDigits(it.chapter + 1)}</span>
            <span className="toc-title">
              {data.chapters[it.chapter].article.kicker && <small>{data.chapters[it.chapter].article.kicker}</small>}
              {data.chapters[it.chapter].article.title}
            </span>
            <span className="toc-pg">{folio(pag.chapterStart[it.chapter])}</span>
          </button>
        ),
      )}
    </div>
  )
}
