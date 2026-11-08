'use client'

import { BookOpen, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Cover } from '@/components/reader/Cover'
import { dateMr, toDevanagariDigits } from '@/lib/marathi'
import type { BookKind, BookSummary } from '@/lib/types'
import { KIND_LABEL } from '@/lib/types'
import { StatusBadge, api, useToast } from './ui'

const FILTERS: { id: 'all' | BookKind; label: string }[] = [
  { id: 'all', label: 'सर्व' },
  { id: 'edition', label: KIND_LABEL.edition },
  { id: 'special', label: KIND_LABEL.special },
  { id: 'themed', label: KIND_LABEL.themed },
]

export function BooksTable({ initial }: { initial: BookSummary[] }) {
  const [books, setBooks] = useState(initial)
  const [filter, setFilter] = useState<'all' | BookKind>('all')
  const toast = useToast()
  const router = useRouter()

  const shown = filter === 'all' ? books : books.filter((b) => b.kind === filter)

  const togglePublish = async (b: BookSummary) => {
    const status = b.status === 'published' ? 'draft' : 'published'
    try {
      await api(`/api/books/${b.id}`, { method: 'PATCH', json: { status } })
      setBooks((all) => all.map((x) => (x.id === b.id ? { ...x, status } : x)))
      toast(status === 'published' ? 'पुस्तक प्रकाशित झाले' : 'पुस्तक मसुद्यात परत गेले')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const duplicate = async (b: BookSummary) => {
    try {
      const copy = await api<{ id: number }>(`/api/books/${b.id}/duplicate`, { method: 'POST' })
      router.push(`/admin/books/${copy.id}`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const remove = async (b: BookSummary) => {
    if (!confirm(`"${b.title}" हे पुस्तक कायमचे हटवायचे? (लेख संग्रहात राहतील)`)) return
    try {
      await api(`/api/books/${b.id}`, { method: 'DELETE' })
      setBooks((all) => all.filter((x) => x.id !== b.id))
      toast('पुस्तक हटवले')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  if (!books.length) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-paper px-6 py-20 text-center">
        <BookOpen className="mx-auto mb-3 text-faint" size={36} strokeWidth={1.4} />
        <p className="text-[15px] text-ink-2">अद्याप एकही पुस्तक नाही.</p>
        <Link href="/admin/books/new" className="btn-primary mt-5">
          पहिले पुस्तक तयार करा
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist">
        {FILTERS.map((f) => {
          const n = f.id === 'all' ? books.length : books.filter((b) => b.kind === f.id).length
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition ${filter === f.id ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-line-strong'}`}
            >
              {f.label} <span className="ml-1 opacity-60">{toDevanagariDigits(n)}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((b) => (
          <article key={b.id} className="group flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-card transition hover:shadow-lift">
            <Link href={`/admin/books/${b.id}`} className="w-[92px] shrink-0">
              <div className="book-vars cover-box rounded-[3px] shadow-md" style={{ '--accent': b.accentColor } as CSSProperties}>
                <Cover book={b} leadImage={b.leadImage} lines={b.leadTitles.map((t) => ({ title: t, kicker: null }))} imgWidth={640} />
              </div>
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold" style={{ color: b.accentColor }}>
                    {KIND_LABEL[b.kind]}
                  </div>
                  <Link href={`/admin/books/${b.id}`} className="block truncate font-display text-[20px] leading-snug text-ink hover:underline">
                    {b.title}
                  </Link>
                  {b.subtitle && <div className="truncate text-[13px] text-muted">{b.subtitle}</div>}
                </div>
                <RowMenu
                  items={[
                    { icon: <Pencil size={15} />, label: 'संपादन', onClick: () => router.push(`/admin/books/${b.id}`) },
                    { icon: <Copy size={15} />, label: 'प्रत तयार करा', onClick: () => duplicate(b) },
                    { icon: <Trash2 size={15} />, label: 'हटवा', onClick: () => remove(b), danger: true },
                  ]}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                <StatusBadge status={b.status} publishAt={b.publishAt} />
                {b.editionDate && <span>{dateMr(b.editionDate)}</span>}
                <span>{toDevanagariDigits(b.chapterCount)} लेख</span>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                <Link href={`/read/${b.slug}?preview=1`} target="_blank" className="btn-ghost !px-2.5 !py-1.5 text-[13px]">
                  <BookOpen size={14} /> पूर्वावलोकन
                </Link>
                <button onClick={() => togglePublish(b)} className={`${b.status === 'published' ? 'btn-ghost' : 'btn-brand'} !px-2.5 !py-1.5 text-[13px]`}>
                  {b.status === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                  {b.status === 'published' ? 'अप्रकाशित करा' : 'प्रकाशित करा'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function RowMenu({ items }: { items: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md p-1.5 text-muted hover:bg-sunk hover:text-ink" aria-label="अधिक पर्याय" aria-expanded={open}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lift">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] hover:bg-sunk ${it.danger ? 'text-brand' : 'text-ink'}`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
