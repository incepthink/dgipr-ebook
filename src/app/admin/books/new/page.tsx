'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, Spinner, api, useToast } from '@/components/admin/ui'
import { todayIso } from '@/lib/marathi'
import type { BookKind } from '@/lib/types'
import { KIND_LABEL } from '@/lib/types'

const KIND_HELP: Record<BookKind, string> = {
  edition: 'एका दिवसाच्या किंवा आठवड्याच्या निवडक बातम्या',
  special: 'एखाद्या प्रसंगावर किंवा विषयावरचा खास अंक',
  themed: 'जिल्हा, योजना किंवा विभागानुसार संकलन',
}

export default function NewBook() {
  const router = useRouter()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [kind, setKind] = useState<BookKind>('edition')
  const [date, setDate] = useState(todayIso())
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      const book = await api<{ id: number }>('/api/books', {
        method: 'POST',
        json: { title, subtitle: subtitle || null, kind, editionDate: date || null },
      })
      router.push(`/admin/books/${book.id}`)
    } catch (err) {
      toast((err as Error).message, 'error')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
        <ArrowLeft size={15} /> पुस्तके
      </Link>
      <h1 className="mb-6 font-display text-[32px] text-ink">नवे पुस्तक</h1>
      <Card>
        <form onSubmit={submit} className="grid gap-5 p-6">
          <div>
            <span className="label">प्रकार</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(KIND_LABEL) as BookKind[]).map((k) => (
                <label
                  key={k}
                  className={`cursor-pointer rounded-lg border p-3 transition ${kind === k ? 'border-ink bg-sunk' : 'border-line hover:border-line-strong'}`}
                >
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                  <div className="text-[15px] font-bold text-ink">{KIND_LABEL[k]}</div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{KIND_HELP[k]}</div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="title">
              शीर्षक
            </label>
            <input
              id="title"
              className="field font-display !text-[22px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="उदा. महासंवाद"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="subtitle">
              उपशीर्षक
            </label>
            <input id="subtitle" className="field" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="उदा. दैनिक आवृत्ती" />
          </div>
          <div className="max-w-xs">
            <label className="label" htmlFor="date">
              {kind === 'edition' ? 'आवृत्तीचा दिनांक' : 'दिनांक'}
            </label>
            <input id="date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <Link href="/admin" className="btn-ghost">
              रद्द करा
            </Link>
            <button className="btn-primary" disabled={busy || !title.trim()}>
              {busy && <Spinner />} पुस्तक तयार करा
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
