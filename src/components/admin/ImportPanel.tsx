'use client'

import { Check, ExternalLink, FilePlus2, Library, Link2, Newspaper, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { img } from '@/lib/img'
import { dateMr, toDevanagariDigits } from '@/lib/marathi'
import type { Article, ChapterWithArticle } from '@/lib/types'
import { Spinner, api, useToast } from './ui'

type Tab = 'browse' | 'urls' | 'library' | 'new'

interface Props {
  bookId: number
  chapters: ChapterWithArticle[]
  onChapters: (c: ChapterWithArticle[]) => void
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'browse', label: 'महासंवादवरून निवडा', icon: <Newspaper size={15} /> },
  { id: 'urls', label: 'लिंक पेस्ट करा', icon: <Link2 size={15} /> },
  { id: 'library', label: 'संग्रहातून', icon: <Library size={15} /> },
  { id: 'new', label: 'नवा लेख', icon: <FilePlus2 size={15} /> },
]

/** Ways to put articles into a book. */
export function ImportPanel({ bookId, chapters, onChapters }: Props) {
  const [tab, setTab] = useState<Tab>('browse')
  const refresh = useCallback(async () => {
    const data = await api<{ chapters: ChapterWithArticle[] }>(`/api/books/${bookId}`)
    onChapters(data.chapters)
  }, [bookId, onChapters])

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[14px] font-semibold transition ${tab === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-5">
        {tab === 'browse' && <Browse bookId={bookId} chapters={chapters} onDone={refresh} />}
        {tab === 'urls' && <PasteUrls bookId={bookId} onDone={refresh} />}
        {tab === 'library' && <FromLibrary bookId={bookId} chapters={chapters} onDone={refresh} />}
        {tab === 'new' && <NewArticle bookId={bookId} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- browse */

interface BrowsePost {
  id: number
  title: string
  date: string
  link: string
  image: string | null
  kicker: string | null
  excerpt: string
}

function Browse({ bookId, chapters, onDone }: { bookId: number; chapters: ChapterWithArticle[]; onDone: () => Promise<void> }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [cats, setCats] = useState<{ id: number; name: string; count: number }[]>([])
  const [posts, setPosts] = useState<BrowsePost[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [adding, setAdding] = useState(false)
  const inBook = new Set(chapters.map((c) => c.article.wpId).filter(Boolean))

  useEffect(() => {
    api<typeof cats>('/api/import/categories')
      .then(setCats)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page) })
    if (search) qs.set('search', search)
    if (category) qs.set('category', category)
    api<{ posts: BrowsePost[]; total: number }>(`/api/import/browse?${qs}`)
      .then((d) => {
        if (cancelled) return
        setPosts((prev) => (page === 1 ? d.posts : [...prev, ...d.posts]))
        setTotal(d.total)
      })
      .catch((e) => !cancelled && toast(`महासंवाद: ${(e as Error).message}`, 'error'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [search, category, page, toast])

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const add = async () => {
    setAdding(true)
    try {
      const r = await api<{ imported: Article[]; errors: { label: string; error: string }[]; added: number }>('/api/import', {
        method: 'POST',
        json: { ids: picked, bookId },
      })
      await onDone()
      setPicked([])
      toast(`${toDevanagariDigits(r.added)} लेख जोडले${r.errors.length ? ` · ${toDevanagariDigits(r.errors.length)} अयशस्वी` : ''}`, r.errors.length ? 'error' : 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setSearch(query.trim())
        }}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="field !pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="महासंवादवर शोधा…" />
        </div>
        <select
          className="field !w-auto max-w-[220px]"
          value={category}
          onChange={(e) => {
            setPage(1)
            setCategory(e.target.value)
          }}
          aria-label="वर्ग"
        >
          <option value="">सर्व वर्ग</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn-ghost">शोधा</button>
      </form>

      <ul className="mt-4 max-h-[460px] divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {posts.map((p) => {
          const already = inBook.has(p.id)
          const on = picked.includes(p.id)
          return (
            <li key={p.id}>
              <label className={`flex cursor-pointer items-start gap-3 px-3 py-3 transition ${on ? 'bg-sunk' : 'hover:bg-canvas'} ${already ? 'cursor-default opacity-55' : ''}`}>
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--ink)]" checked={on || already} disabled={already} onChange={() => toggle(p.id)} />
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-sunk">
                  {p.image && <img src={img(p.image, 384)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-2 text-[12px] text-muted">
                    {p.kicker && <span className="font-semibold text-ink-2">{p.kicker}</span>}
                    <span>{dateMr(p.date)}</span>
                    {already && <span className="font-semibold text-ok">· पुस्तकात आहे</span>}
                  </div>
                  <div className="font-serif text-[14.5px] leading-snug text-ink">{p.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{p.excerpt}</div>
                </div>
                <a href={p.link} target="_blank" rel="noreferrer" className="rounded p-1 text-faint hover:text-ink" onClick={(e) => e.stopPropagation()} aria-label="महासंवादवर पाहा">
                  <ExternalLink size={14} />
                </a>
              </label>
            </li>
          )
        })}
        {loading && (
          <li className="px-3 py-6 text-center text-[14px] text-muted">
            <Spinner /> आणत आहोत…
          </li>
        )}
        {!loading && !posts.length && <li className="px-3 py-8 text-center text-[14px] text-muted">काहीही सापडले नाही.</li>}
        {!loading && posts.length < total && (
          <li>
            <button onClick={() => setPage((p) => p + 1)} className="w-full py-3 text-[14px] font-semibold text-ink-2 hover:bg-canvas">
              आणखी दाखवा ({toDevanagariDigits(total - posts.length)})
            </button>
          </li>
        )}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{picked.length ? `${toDevanagariDigits(picked.length)} निवडले — निवडीच्या क्रमाने जोडले जातील` : 'बातम्या निवडा'}</span>
        <button className="btn-primary" disabled={!picked.length || adding} onClick={add}>
          {adding ? <Spinner /> : <Plus size={16} />} पुस्तकात जोडा
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ paste URLs */

function PasteUrls({ bookId, onDone }: { bookId: number; onDone: () => Promise<void> }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<{ label: string; error: string }[]>([])
  const urls = text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /mahasamvad\.in|^\d{4,}$/.test(s))

  const go = async () => {
    setBusy(true)
    setErrors([])
    try {
      const r = await api<{ imported: Article[]; errors: { label: string; error: string }[]; added: number }>('/api/import', {
        method: 'POST',
        json: { urls, bookId },
      })
      await onDone()
      setErrors(r.errors)
      if (!r.errors.length) setText('')
      toast(`${toDevanagariDigits(r.imported.length)} आयात, ${toDevanagariDigits(r.added)} नवे लेख पुस्तकात`, r.errors.length ? 'error' : 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="label" htmlFor="urls">
        महासंवाद बातम्यांच्या लिंक — प्रत्येक ओळीत एक
      </label>
      <textarea
        id="urls"
        className="field min-h-[150px] font-mono !text-[13px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'https://mahasamvad.in/218916/\nhttps://mahasamvad.in/218923/'}
        dir="ltr"
      />
      {errors.length > 0 && (
        <ul className="mt-3 rounded-lg bg-brand-soft p-3 text-[13px] text-brand">
          {errors.map((e) => (
            <li key={e.label} dir="auto">
              <b>{e.label}</b> — {e.error}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{toDevanagariDigits(urls.length)} लिंक ओळखल्या · आधी आयात झालेल्या बातम्या अद्ययावत होतील</span>
        <button className="btn-primary" disabled={!urls.length || busy} onClick={go}>
          {busy ? <Spinner /> : <Plus size={16} />} आयात करून जोडा
        </button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- from library */

function FromLibrary({ bookId, chapters, onDone }: { bookId: number; chapters: ChapterWithArticle[]; onDone: () => Promise<void> }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Article[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const inBook = new Set(chapters.map((c) => c.articleId))

  useEffect(() => {
    const t = setTimeout(() => {
      api<Article[]>(`/api/articles?search=${encodeURIComponent(q)}`)
        .then(setItems)
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const add = async (id: number) => {
    setBusyId(id)
    try {
      await api(`/api/books/${bookId}/chapters`, { method: 'POST', json: { articleIds: [id] } })
      await onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="field !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="आधी आयात केलेल्या किंवा लिहिलेल्या लेखांमध्ये शोधा…" />
      </div>
      <ul className="mt-4 max-h-[420px] divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-muted">
                {a.kicker && <span className="font-semibold text-ink-2">{a.kicker} · </span>}
                {a.publishedAt && dateMr(a.publishedAt)}
              </div>
              <div className="truncate font-serif text-[14.5px] text-ink">{a.title}</div>
            </div>
            {inBook.has(a.id) ? (
              <span className="flex items-center gap-1 text-[13px] font-semibold text-ok">
                <Check size={15} /> पुस्तकात
              </span>
            ) : (
              <button className="btn-ghost !px-2.5 !py-1 text-[13px]" onClick={() => add(a.id)} disabled={busyId === a.id}>
                {busyId === a.id ? <Spinner size={13} /> : <Plus size={14} />} जोडा
              </button>
            )}
          </li>
        ))}
        {!items.length && <li className="px-3 py-8 text-center text-[14px] text-muted">लेख सापडले नाहीत.</li>}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------ new article */

function NewArticle({ bookId }: { bookId: number }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const create = async () => {
    setBusy(true)
    try {
      const a = await api<{ id: number }>('/api/articles', {
        method: 'POST',
        json: { title: 'नवा लेख', bookId, contentHtml: '<p></p>' },
      })
      router.push(`/admin/articles/${a.id}?book=${bookId}`)
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="max-w-md text-[14px] text-muted">
        संपादकीय, मुलाखत किंवा महासंवादवर नसलेला मजकूर थेट लिहा. लेख या पुस्तकाच्या शेवटी जोडला जाईल.
      </p>
      <button className="btn-primary" onClick={create} disabled={busy}>
        {busy ? <Spinner /> : <FilePlus2 size={16} />} नवा लेख लिहा
      </button>
    </div>
  )
}
