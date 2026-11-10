'use client'

import { Bookmark, BookmarkMinus, BookOpen, CheckCircle2, Clock, Highlighter, Library } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { BookCover } from '@/components/library/BookCover'
import { dateMr, toDevanagariDigits } from '@/lib/marathi'
import { encodeAnchor } from '@/lib/paginate/anchors'
import type { MyLibrary as Data, ShelfItem } from '@/lib/reading'
import { KIND_LABEL } from '@/lib/types'
import { call } from './client'

type Tab = 'reading' | 'saved' | 'finished' | 'marks' | 'hl'

const n = (x: number) => toDevanagariDigits(x)

/** "५ मिनिटांपूर्वी", "काल", or a date. */
function ago(iso: string): string {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'आत्ताच'
  if (s < 3600) return `${n(Math.floor(s / 60))} मिनिटांपूर्वी`
  if (s < 86400) return `${n(Math.floor(s / 3600))} तासांपूर्वी`
  if (s < 172800) return 'काल'
  if (s < 7 * 86400) return `${n(Math.floor(s / 86400))} दिवसांपूर्वी`
  return dateMr(iso)
}

const title = (i: ShelfItem) => (i.book.kind === 'edition' && i.book.editionDate ? `${i.book.title} · ${dateMr(i.book.editionDate)}` : i.book.title)

function Row({ item, tab, onUnsave }: { item: ShelfItem; tab: Tab; onUnsave: (id: number) => void }) {
  const { book, progress } = item
  const pct = progress ? Math.round(progress.percent * 100) : 0
  const href = progress && !progress.finishedAt ? `/read/${book.slug}?at=${encodeAnchor(progress.anchor)}` : `/read/${book.slug}`
  return (
    <div className="ml-row">
      <Link href={href} className="ml-row-cover" tabIndex={-1} aria-hidden>
        <BookCover b={book} width={384} />
      </Link>
      <div className="ml-row-body">
        <span className="ml-row-kind">{KIND_LABEL[book.kind]}</span>
        <Link href={href} className="ml-row-title">
          {title(item)}
        </Link>
        {progress && tab !== 'saved' ? (
          progress.finishedAt ? (
            <span className="ml-done">
              <CheckCircle2 size={16} aria-hidden /> {dateMr(progress.finishedAt)} रोजी पूर्ण
            </span>
          ) : (
            <span className="ml-row-meta">
              पान {n(progress.page)} / {n(progress.pageCount)} · {n(pct)}% · {ago(progress.updatedAt)}
            </span>
          )
        ) : (
          <span className="ml-row-meta">{n(book.chapterCount)} लेख</span>
        )}
        {progress && !progress.finishedAt && (
          <div className="ml-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="वाचन प्रगती">
            <i style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
        )}
        <div className="ml-row-actions">
          <Link href={href} className="acc-btn acc-btn--primary">
            <BookOpen size={18} aria-hidden />
            {progress?.finishedAt ? 'पुन्हा वाचा' : progress ? 'पुढे वाचा' : 'वाचायला सुरुवात करा'}
          </Link>
          {tab === 'saved' && (
            <button type="button" className="ml-icon" aria-label="जतन केलेल्यांतून काढा" title="जतन केलेल्यांतून काढा" onClick={() => onUnsave(book.id)}>
              <BookmarkMinus size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Empty({ icon: Icon, title: t, text }: { icon: typeof Library; title: string; text: string }) {
  return (
    <div className="ml-empty">
      <Icon size={40} strokeWidth={1.5} aria-hidden />
      <h3>{t}</h3>
      <p>{text}</p>
      <Link href="/" className="acc-btn acc-btn--primary">
        पुस्तके पहा
      </Link>
    </div>
  )
}

export function MyLibrary({ data, name }: { data: Data; name: string | null }) {
  const [saved, setSaved] = useState(data.saved)
  const [tab, setTab] = useState<Tab>(data.reading.length ? 'reading' : saved.length ? 'saved' : data.finished.length ? 'finished' : 'reading')
  const [error, setError] = useState<string | null>(null)

  const unsave = async (id: number) => {
    const before = saved
    setSaved((s) => s.filter((i) => i.book.id !== id))
    try {
      await call('/api/me/saved', 'POST', { bookId: id, saved: false })
    } catch (err) {
      setSaved(before)
      setError((err as Error).message)
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'reading', label: 'वाचत आहे', count: data.reading.length },
    { id: 'saved', label: 'जतन केलेली', count: saved.length },
    { id: 'finished', label: 'पूर्ण झालेली', count: data.finished.length },
    { id: 'marks', label: 'खुणा', count: data.stats.bookmarks },
    { id: 'hl', label: 'ठळक व नोंदी', count: data.stats.highlights },
  ]

  const list = tab === 'reading' ? data.reading : tab === 'saved' ? saved : data.finished

  return (
    <>
      <h1 className="acc-h1">माझे ग्रंथालय</h1>
      <p className="acc-sub">{name ? `नमस्कार, ${name}. ` : ''}आपण वाचलेली, जतन केलेली आणि खुणा केलेली पुस्तके.</p>

      <div className="ml-stats">
        <div className="ml-stat">
          <b>{n(data.stats.started)}</b>
          <span>सुरू केलेली पुस्तके</span>
        </div>
        <div className="ml-stat">
          <b>{n(data.stats.finished)}</b>
          <span>पूर्ण वाचलेली</span>
        </div>
        <div className="ml-stat">
          <b>{n(saved.length)}</b>
          <span>जतन केलेली</span>
        </div>
        <div className="ml-stat">
          <b>{n(data.stats.bookmarks)}</b>
          <span>खुणा</span>
        </div>
      </div>

      <div className="ml-tabs" role="tablist" aria-label="माझे ग्रंथालय">
        {tabs.map((t) => (
          <button key={t.id} role="tab" type="button" className="ml-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label} <small>{n(t.count)}</small>
          </button>
        ))}
      </div>

      {error && (
        <div className="acc-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {tab === 'hl' ? (
        data.highlights.length ? (
          data.highlights.map((g) => (
            <section key={g.book.id} className="ml-group">
              <h3>{g.book.title}</h3>
              <span>{n(g.highlights.length)} ठळक ओळी</span>
              {g.highlights.map((h) => (
                <Link key={h.id} href={`/read/${g.book.slug}?at=${h.c}.${h.b}.${h.start}&mode=text`} className="ml-hl">
                  <span className={`ml-hl-bar hlc-${h.color}`} aria-hidden />
                  <div>
                    {g.chapterTitles[h.c] && <b>{g.chapterTitles[h.c]}</b>}
                    <q>{h.text}</q>
                    {h.note && <em>✎ {h.note}</em>}
                  </div>
                </Link>
              ))}
            </section>
          ))
        ) : (
          <Empty icon={Highlighter} title="अजून काहीही ठळक केलेले नाही" text="पुस्तकात 'सोपे वाचन' निवडा, ओळ निवडा आणि रंग द्या. नोंदही लिहिता येते." />
        )
      ) : tab === 'marks' ? (
        data.bookmarks.length ? (
          data.bookmarks.map((g) => (
            <section key={g.book.id} className="ml-group">
              <h3>{g.book.title}</h3>
              <span>{n(g.marks.length)} खुणा</span>
              {g.marks.map((m) => (
                <Link key={m.at} href={`/read/${g.book.slug}?at=${encodeAnchor(m.anchor)}`} className="ml-mark">
                  <Bookmark size={18} aria-hidden />
                  <div>
                    <b>{m.label}</b>
                    <span>{m.snippet}</span>
                  </div>
                </Link>
              ))}
            </section>
          ))
        ) : (
          <Empty icon={Bookmark} title="अजून खुणा नाहीत" text="वाचताना वरच्या पट्टीतील खुणेचे चिन्ह दाबा — ते पान येथे दिसेल." />
        )
      ) : list.length ? (
        <div className="ml-list">
          {list.map((i) => (
            <Row key={i.book.id} item={i} tab={tab} onUnsave={unsave} />
          ))}
        </div>
      ) : tab === 'reading' ? (
        <Empty icon={Clock} title="अजून काही वाचायला सुरुवात केलेली नाही" text="एखादे पुस्तक उघडा. आपण जिथे थांबाल, तिथून पुढे वाचता येईल — कोणत्याही उपकरणावर." />
      ) : tab === 'saved' ? (
        <Empty icon={Library} title="जतन केलेली पुस्तके नाहीत" text="मुख्यपृष्ठावर पुस्तकाच्या नावाशेजारील चिन्ह दाबून ते नंतर वाचण्यासाठी जतन करा." />
      ) : (
        <Empty icon={CheckCircle2} title="अजून एकही पुस्तक पूर्ण नाही" text="पुस्तकाचे शेवटचे पान गाठल्यावर ते येथे दिसेल." />
      )}
    </>
  )
}
