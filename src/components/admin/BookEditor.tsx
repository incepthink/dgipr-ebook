'use client'

import { ArrowLeft, BookOpen, ExternalLink, ImagePlus, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Cover } from '@/components/reader/Cover'
import { toDevanagariDigits } from '@/lib/marathi'
import type { Book, BookKind, BookStatus, ChapterWithArticle } from '@/lib/types'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/types'
import { ChapterList } from './ChapterList'
import { ImportPanel } from './ImportPanel'
import { Card, Spinner, StatusBadge, api, useToast } from './ui'

const ACCENTS = ['#A8172C', '#1F5C4A', '#9A5B13', '#1E3A6E', '#5B2A86', '#B4471D', '#0F6B78', '#222222']

type Form = Pick<Book, 'title' | 'subtitle' | 'slug' | 'kind' | 'editionDate' | 'description' | 'accentColor' | 'coverImage' | 'coverStyle' | 'status' | 'publishAt'>

const pick = (b: Book): Form => ({
  title: b.title,
  subtitle: b.subtitle,
  slug: b.slug,
  kind: b.kind,
  editionDate: b.editionDate,
  description: b.description,
  accentColor: b.accentColor,
  coverImage: b.coverImage,
  coverStyle: b.coverStyle,
  status: b.status,
  publishAt: b.publishAt,
})

/** ISO instant ⇄ the local wall time a datetime-local input shows. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function BookEditor({ initialBook, initialChapters }: { initialBook: Book; initialChapters: ChapterWithArticle[] }) {
  const router = useRouter()
  const toast = useToast()
  const [saved, setSaved] = useState<Book>(initialBook)
  const [form, setForm] = useState<Form>(pick(initialBook))
  const [chapters, setChapters] = useState(initialChapters)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(form) !== JSON.stringify(pick(saved))
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = async (override?: Partial<Form>) => {
    const body = { ...form, ...override }
    setSaving(true)
    try {
      const book = await api<Book>(`/api/books/${saved.id}`, { method: 'PATCH', json: body })
      setSaved(book)
      setForm(pick(book))
      toast('जतन केले')
      router.refresh()
      return true
    } catch (e) {
      toast((e as Error).message, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  /** Chapter edits save at once; the list rolls back if the server refuses. */
  const updateChapters = useCallback(
    async (next: ChapterWithArticle[]) => {
      const prev = chapters
      setChapters(next)
      try {
        const fresh = await api<ChapterWithArticle[]>(`/api/books/${saved.id}/chapters`, {
          method: 'PUT',
          json: next.map((c) => ({ articleId: c.articleId, sectionLabel: c.sectionLabel })),
        })
        setChapters(fresh)
      } catch (e) {
        setChapters(prev)
        toast((e as Error).message, 'error')
      }
    },
    [chapters, saved.id, toast],
  )

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { url } = await api<{ url: string }>('/api/uploads', { method: 'POST', body: fd })
      setForm((f) => ({ ...f, coverImage: url, coverStyle: { mode: 'image' } }))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    if (!confirm(`"${saved.title}" हे पुस्तक कायमचे हटवायचे? (लेख संग्रहात राहतील)`)) return
    await api(`/api/books/${saved.id}`, { method: 'DELETE' })
    router.push('/admin')
  }

  const previewBook: Book = { ...saved, ...form }
  const leadImage = chapters.find((c) => c.article.heroImage)?.article.heroImage ?? null

  return (
    <div>
      {/* ---------------------------------------------------------- header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin" className="mb-2 inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
            <ArrowLeft size={15} /> पुस्तके
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[32px] leading-tight text-ink">{saved.title}</h1>
            <StatusBadge status={saved.status} publishAt={saved.publishAt} />
          </div>
          <div className="mt-1 text-[13.5px] text-muted">
            {KIND_LABEL[saved.kind]} · {toDevanagariDigits(chapters.length)} लेख · <span dir="ltr">/read/{saved.slug}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/read/${saved.slug}?preview=1`} target="_blank" rel="noreferrer" className="btn-ghost">
            <BookOpen size={16} /> पूर्वावलोकन
          </a>
          <button className="btn-primary" onClick={() => save()} disabled={!dirty || saving}>
            {saving ? <Spinner /> : <Save size={16} />} जतन करा
          </button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------------ main column */}
        <div className="grid gap-6">
          <Card
            title={`अनुक्रम · ${toDevanagariDigits(chapters.length)} लेख`}
            action={<span className="hidden text-[12.5px] text-muted sm:block">ओढून क्रम बदला · बदल लगेच जतन होतात</span>}
          >
            <ChapterList bookId={saved.id} chapters={chapters} onChange={updateChapters} />
          </Card>
          <Card title="लेख जोडा">
            <ImportPanel bookId={saved.id} chapters={chapters} onChapters={setChapters} />
          </Card>
        </div>

        {/* ---------------------------------------------------------- sidebar */}
        <div className="grid gap-6 lg:sticky lg:top-20">
          <Card title="प्रकाशन">
            <div className="grid gap-3 p-5">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-sunk p-1">
                {(['draft', 'published', 'scheduled'] as BookStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => set('status', s)}
                    className={`rounded-md py-1.5 text-[13.5px] font-semibold transition ${form.status === s ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {form.status === 'scheduled' && (
                <div>
                  <label className="label" htmlFor="publishAt">
                    प्रकाशनाची वेळ
                  </label>
                  <input
                    id="publishAt"
                    type="datetime-local"
                    className="field"
                    value={toLocalInput(form.publishAt)}
                    onChange={(e) => set('publishAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                </div>
              )}
              <p className="text-[12.5px] leading-relaxed text-muted">
                {form.status === 'draft' && 'मसुदा फक्त पूर्वावलोकनात दिसतो.'}
                {form.status === 'published' && 'प्रकाशित पुस्तक ग्रंथालयात सर्वांना दिसते.'}
                {form.status === 'scheduled' && 'ठरलेल्या वेळी पुस्तक आपोआप ग्रंथालयात दिसेल.'}
              </p>
              {saved.status === 'published' && (
                <a href={`/read/${saved.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:underline">
                  वाचकांसाठीची लिंक <ExternalLink size={13} />
                </a>
              )}
            </div>
          </Card>

          <Card title="मुखपृष्ठ">
            <div className="grid gap-4 p-5">
              <div className="mx-auto w-[200px]">
                <div className="book-vars book3d" style={{ '--accent': form.accentColor } as CSSProperties}>
                  <div className="cover-box">
                    <Cover
                      book={previewBook}
                      leadImage={leadImage}
                      lines={chapters.slice(0, 3).map((c) => ({ title: c.article.title, kicker: c.article.kicker }))}
                      imgWidth={640}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-sunk p-1">
                <button
                  onClick={() => set('coverStyle', { mode: 'auto' })}
                  className={`rounded-md py-1.5 text-[13px] font-semibold ${form.coverStyle.mode === 'auto' ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}
                >
                  आपोआप
                </button>
                <button
                  onClick={() => (form.coverImage ? set('coverStyle', { mode: 'image' }) : fileRef.current?.click())}
                  className={`rounded-md py-1.5 text-[13px] font-semibold ${form.coverStyle.mode === 'image' ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}
                >
                  स्वतःची प्रतिमा
                </button>
              </div>
              {form.coverStyle.mode === 'image' && (
                <div className="flex gap-2">
                  <button className="btn-ghost flex-1 text-[13px]" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Spinner /> : <ImagePlus size={15} />} प्रतिमा बदला
                  </button>
                  {form.coverImage && (
                    <button className="btn-danger !px-2.5" onClick={() => setForm((f) => ({ ...f, coverImage: null, coverStyle: { mode: 'auto' } }))} aria-label="प्रतिमा काढा">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void upload(f)
                  e.target.value = ''
                }}
              />
              <div>
                <span className="label">रंग</span>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      onClick={() => set('accentColor', c)}
                      className={`h-7 w-7 rounded-full border-2 transition ${form.accentColor.toLowerCase() === c.toLowerCase() ? 'scale-110 border-ink' : 'border-transparent'}`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.accentColor}
                    onChange={(e) => set('accentColor', e.target.value.toUpperCase())}
                    className="h-7 w-9 cursor-pointer rounded border border-line bg-surface"
                    aria-label="इतर रंग"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card title="माहिती">
            <div className="grid gap-4 p-5">
              <div>
                <label className="label" htmlFor="b-title">
                  शीर्षक
                </label>
                <input id="b-title" className="field font-display !text-[19px]" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="b-sub">
                  उपशीर्षक
                </label>
                <input id="b-sub" className="field" value={form.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value || null)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="b-kind">
                    प्रकार
                  </label>
                  <select id="b-kind" className="field" value={form.kind} onChange={(e) => set('kind', e.target.value as BookKind)}>
                    {(Object.keys(KIND_LABEL) as BookKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="b-date">
                    दिनांक
                  </label>
                  <input id="b-date" type="date" className="field" value={form.editionDate ?? ''} onChange={(e) => set('editionDate', e.target.value || null)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="b-desc">
                  वर्णन
                </label>
                <textarea
                  id="b-desc"
                  className="field min-h-[96px] font-serif !leading-relaxed"
                  value={form.description ?? ''}
                  onChange={(e) => set('description', e.target.value || null)}
                  placeholder="पुस्तकाच्या सुरुवातीला व मागील मुखपृष्ठावर दिसते"
                />
              </div>
              <div>
                <label className="label" htmlFor="b-slug">
                  लिंक (slug)
                </label>
                <div className="flex items-center rounded-md border border-line bg-sunk focus-within:border-ink-2">
                  <span className="pl-3 text-[13px] text-muted" dir="ltr">
                    /read/
                  </span>
                  <input
                    id="b-slug"
                    dir="ltr"
                    className="w-full bg-transparent px-1 py-2 text-[14px] outline-none"
                    value={form.slug}
                    onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  />
                </div>
              </div>
            </div>
          </Card>

          <button onClick={remove} className="btn-danger justify-self-start text-[13px]">
            <Trash2 size={15} /> पुस्तक हटवा
          </button>
        </div>
      </div>

      {/* A save bar that follows the reader while there are unsaved edits. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-lift">
          <div className="mx-auto flex max-w-shell items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <span className="text-[14px] text-ink-2">न जतन केलेले बदल</span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setForm(pick(saved))}>
                रद्द करा
              </button>
              <button className="btn-primary" onClick={() => save()} disabled={saving}>
                {saving ? <Spinner /> : <Save size={16} />} जतन करा
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
