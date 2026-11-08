'use client'

import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  ArrowLeft,
  Bold,
  ExternalLink,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { DISTRICTS } from '@/lib/districts'
import { img } from '@/lib/img'
import type { Article } from '@/lib/types'
import { Card, Spinner, api, useToast } from './ui'

/** Stored figures become captioned images for editing, and back on save. */
function toEditorHtml(html: string): string {
  return html.replace(/<figure>\s*(<img [^>]*?)\s*\/?>\s*(?:<figcaption>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/g, (_m, tag: string, cap?: string) => {
    const title = cap ? ` title="${cap.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;')}"` : ''
    return `${tag}${title}>`
  })
}

function fromEditorHtml(html: string): string {
  return html.replace(/<img ([^>]*?)\/?>/g, (_m, attrs: string) => {
    const t = attrs.match(/title="([^"]*)"/)
    const rest = attrs.replace(/\s*title="[^"]*"/, '')
    return `<figure><img ${rest.trim()}>${t && t[1] ? `<figcaption>${t[1]}</figcaption>` : ''}</figure>`
  })
}

const isoDay = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10) : '')

export function ArticleEditor({ initial, books, bookId }: { initial: Article; books: { id: number; title: string }[]; bookId: number | null }) {
  const router = useRouter()
  const toast = useToast()
  const [meta, setMeta] = useState({
    title: initial.title,
    kicker: initial.kicker ?? '',
    dateline: initial.dateline ?? '',
    district: initial.district ?? '',
    date: isoDay(initial.publishedAt),
    heroImage: initial.heroImage ?? '',
    heroCredit: initial.heroCredit ?? '',
  })
  const [bodyDirty, setBodyDirty] = useState(false)
  const [metaDirty, setMetaDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'hero' | 'body' | null>(null)
  const heroFile = useRef<HTMLInputElement>(null)
  const bodyFile = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        underline: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'लेख येथे लिहा…' }),
    ],
    content: toEditorHtml(initial.contentHtml),
    editorProps: { attributes: { class: 'article-prose focus:outline-none' } },
    onUpdate: () => setBodyDirty(true),
  })

  const dirty = bodyDirty || metaDirty
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setM = (k: keyof typeof meta, v: string) => {
    setMeta((m) => ({ ...m, [k]: v }))
    setMetaDirty(true)
  }

  const save = async () => {
    if (!editor) return
    setSaving(true)
    try {
      await api(`/api/articles/${initial.id}`, {
        method: 'PATCH',
        json: {
          title: meta.title,
          kicker: meta.kicker || null,
          dateline: meta.dateline || null,
          district: meta.district || null,
          publishedAt: meta.date ? new Date(`${meta.date}T12:00:00+05:30`).toISOString() : null,
          heroImage: meta.heroImage || null,
          heroCredit: meta.heroCredit || null,
          contentHtml: fromEditorHtml(editor.getHTML()),
        },
      })
      setBodyDirty(false)
      setMetaDirty(false)
      toast('लेख जतन झाला')
      router.refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const upload = async (file: File, target: 'hero' | 'body') => {
    setUploading(target)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { url } = await api<{ url: string }>('/api/uploads', { method: 'POST', body: fd })
      if (target === 'hero') setM('heroImage', url)
      else {
        const caption = window.prompt('छायाचित्राखालील ओळ (ऐच्छिक)') ?? ''
        editor?.chain().focus().setImage({ src: url, title: caption || undefined }).run()
      }
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setUploading(null)
    }
  }

  const remove = async () => {
    if (!confirm('हा लेख कायमचा हटवायचा? तो सर्व पुस्तकांतून निघून जाईल.')) return
    await api(`/api/articles/${initial.id}`, { method: 'DELETE' })
    router.push(bookId ? `/admin/books/${bookId}` : '/admin/articles')
  }

  const back = bookId ? `/admin/books/${bookId}` : '/admin/articles'
  const backBook = books.find((b) => b.id === bookId)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={back} className="mb-2 inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
            <ArrowLeft size={15} /> {backBook ? backBook.title : 'लेख'}
          </Link>
          <div className="text-[13px] text-muted">
            {initial.sourceUrl ? (
              <a href={initial.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                महासंवादवरून आयात <ExternalLink size={12} />
              </a>
            ) : (
              'स्वतंत्र लेख'
            )}
            {books.length > 0 && <> · {books.map((b) => b.title).join(', ')} मध्ये</>}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-danger" onClick={remove} aria-label="लेख हटवा">
            <Trash2 size={16} />
          </button>
          <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? <Spinner /> : <Save size={16} />} जतन करा
          </button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div className="px-5 pt-5 sm:px-10 sm:pt-8">
            <input
              value={meta.kicker}
              onChange={(e) => setM('kicker', e.target.value)}
              placeholder="वर्ग / किकर (उदा. जिल्हा वार्ता)"
              className="w-full bg-transparent text-[13px] font-bold tracking-wide text-brand outline-none placeholder:font-normal placeholder:text-faint"
            />
            <textarea
              value={meta.title}
              onChange={(e) => setM('title', e.target.value)}
              rows={2}
              placeholder="शीर्षक"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
              className="mt-2 w-full resize-none bg-transparent font-display text-[30px] leading-[1.3] text-ink outline-none placeholder:text-faint sm:text-[34px]"
            />
          </div>
          {editor && <Toolbar editor={editor} onImage={() => bodyFile.current?.click()} uploading={uploading === 'body'} />}
          <div className="px-5 pb-10 pt-4 sm:px-10">
            <EditorContent editor={editor} />
          </div>
          <input
            ref={bodyFile}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f, 'body')
              e.target.value = ''
            }}
          />
        </Card>

        <div className="grid gap-6 lg:sticky lg:top-20">
          <Card title="मुख्य छायाचित्र">
            <div className="grid gap-3 p-5">
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-sunk">
                {meta.heroImage ? (
                  <img src={img(meta.heroImage, 640)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <button onClick={() => heroFile.current?.click()} className="grid h-full w-full place-items-center text-[13px] text-muted hover:text-ink">
                    <span className="flex flex-col items-center gap-2">
                      <ImagePlus size={24} /> छायाचित्र निवडा
                    </span>
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1 text-[13px]" onClick={() => heroFile.current?.click()} disabled={uploading === 'hero'}>
                  {uploading === 'hero' ? <Spinner /> : <ImagePlus size={15} />} अपलोड
                </button>
                {meta.heroImage && (
                  <button className="btn-danger !px-2.5" onClick={() => setM('heroImage', '')} aria-label="छायाचित्र काढा">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <input
                className="field !text-[13px]"
                dir="ltr"
                value={meta.heroImage}
                onChange={(e) => setM('heroImage', e.target.value)}
                placeholder="किंवा प्रतिमेची लिंक"
              />
              <input className="field !text-[13px]" value={meta.heroCredit} onChange={(e) => setM('heroCredit', e.target.value)} placeholder="छायाचित्र श्रेय (ऐच्छिक)" />
              <input
                ref={heroFile}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void upload(f, 'hero')
                  e.target.value = ''
                }}
              />
            </div>
          </Card>
          <Card title="तपशील">
            <div className="grid gap-4 p-5">
              <div>
                <label className="label" htmlFor="a-dateline">
                  स्थळ (डेटलाइन)
                </label>
                <input id="a-dateline" className="field" value={meta.dateline} onChange={(e) => setM('dateline', e.target.value)} placeholder="उदा. मुंबई, दि. १५" />
              </div>
              <div>
                <label className="label" htmlFor="a-district">
                  जिल्हा
                </label>
                <select id="a-district" className="field" value={meta.district} onChange={(e) => setM('district', e.target.value)}>
                  <option value="">—</option>
                  {DISTRICTS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.mr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="a-date">
                  दिनांक
                </label>
                <input id="a-date" type="date" className="field" value={meta.date} onChange={(e) => setM('date', e.target.value)} />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-lift">
          <div className="mx-auto flex max-w-shell items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <span className="text-[14px] text-ink-2">न जतन केलेले बदल</span>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : <Save size={16} />} जतन करा
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: () => void; uploading: boolean }) {
  // Re-render on selection changes so active states stay current.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      ul: e.isActive('bulletList'),
      ol: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  })
  const B = ({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={`grid h-8 w-8 place-items-center rounded-md transition disabled:opacity-30 ${on ? 'bg-ink text-white' : 'text-ink-2 hover:bg-sunk'}`}
    >
      {children}
    </button>
  )
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('लिंक (URL)', prev ?? 'https://')
    if (url === null) return
    if (!url || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  return (
    <div className="sticky top-14 z-10 mx-3 mt-4 flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-card sm:mx-8">
      <B label="उपशीर्षक" on={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={17} />
      </B>
      <B label="लहान उपशीर्षक" on={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={17} />
      </B>
      <span className="mx-1 h-5 w-px bg-line" />
      <B label="ठळक" on={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={16} />
      </B>
      <B label="तिरपे" on={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={16} />
      </B>
      <B label="लिंक" on={s.link} onClick={setLink}>
        <Link2 size={16} />
      </B>
      <span className="mx-1 h-5 w-px bg-line" />
      <B label="बुलेट यादी" on={s.ul} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={17} />
      </B>
      <B label="क्रमांकित यादी" on={s.ol} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={17} />
      </B>
      <B label="अवतरण" on={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={16} />
      </B>
      <B label="छायाचित्र" onClick={onImage} disabled={uploading}>
        {uploading ? <Spinner size={14} /> : <ImagePlus size={16} />}
      </B>
      <span className="ml-auto" />
      <B label="पूर्ववत" onClick={() => editor.chain().focus().undo().run()} disabled={!s.undo}>
        <Undo2 size={16} />
      </B>
      <B label="पुन्हा" onClick={() => editor.chain().focus().redo().run()} disabled={!s.redo}>
        <Redo2 size={16} />
      </B>
    </div>
  )
}
