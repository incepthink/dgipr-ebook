'use client'

import { FilePlus2, ImageOff, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { districtName } from '@/lib/districts'
import { img } from '@/lib/img'
import { dateMr, toDevanagariDigits } from '@/lib/marathi'
import type { Article } from '@/lib/types'
import { Spinner, api, useToast } from './ui'

export function ArticlesList({ initial }: { initial: Article[] }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const toast = useToast()
  const shown = useMemo(() => {
    const s = q.trim()
    return s ? initial.filter((a) => a.title.includes(s) || a.kicker?.includes(s)) : initial
  }, [q, initial])

  const create = async () => {
    setBusy(true)
    try {
      const a = await api<{ id: number }>('/api/articles', { method: 'POST', json: { title: 'नवा लेख', contentHtml: '<p></p>' } })
      router.push(`/admin/articles/${a.id}`)
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="field !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="शीर्षकाने शोधा…" />
        </div>
        <button className="btn-primary" onClick={create} disabled={busy}>
          {busy ? <Spinner /> : <FilePlus2 size={16} />} नवा लेख
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-4 py-2.5 text-[12.5px] text-muted">{toDevanagariDigits(shown.length)} लेख</div>
        <ul className="divide-y divide-line">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/articles/${a.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-canvas">
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-sunk">
                  {a.heroImage ? (
                    <img src={img(a.heroImage, 384)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center text-faint">
                      <ImageOff size={15} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-2 text-[12px] text-muted">
                    {a.kicker && <span className="font-semibold text-ink-2">{a.kicker}</span>}
                    {a.district && <span>{districtName(a.district)}</span>}
                    {a.publishedAt && <span>{dateMr(a.publishedAt)}</span>}
                    {!a.sourceUrl && <span className="chip bg-sunk">स्वतंत्र</span>}
                  </div>
                  <div className="truncate font-serif text-[15px] text-ink">{a.title}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
