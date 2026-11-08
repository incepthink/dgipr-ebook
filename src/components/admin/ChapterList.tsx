'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImageOff, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { img } from '@/lib/img'
import { dateMr, toDevanagariDigits } from '@/lib/marathi'
import type { ChapterWithArticle } from '@/lib/types'

interface Props {
  bookId: number
  chapters: ChapterWithArticle[]
  onChange: (next: ChapterWithArticle[]) => void
}

/** The book's running order: drag to reorder, label sections, remove. */
export function ChapterList({ bookId, chapters, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = chapters.findIndex((c) => c.id === active.id)
    const to = chapters.findIndex((c) => c.id === over.id)
    onChange(arrayMove(chapters, from, to))
  }

  if (!chapters.length) {
    return (
      <div className="px-6 py-14 text-center text-[14px] text-muted">
        या पुस्तकात अजून लेख नाहीत. खालील पर्यायांतून महासंवादवरील बातम्या आयात करा किंवा नवा लेख लिहा.
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ol className="divide-y divide-line">
          {chapters.map((c, i) => (
            <Row
              key={c.id}
              index={i}
              chapter={c}
              bookId={bookId}
              onLabel={(label) => onChange(chapters.map((x) => (x.id === c.id ? { ...x, sectionLabel: label } : x)))}
              onRemove={() => onChange(chapters.filter((x) => x.id !== c.id))}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function Row({
  chapter,
  index,
  bookId,
  onLabel,
  onRemove,
}: {
  chapter: ChapterWithArticle
  index: number
  bookId: number
  onLabel: (label: string | null) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id })
  const [label, setLabel] = useState(chapter.sectionLabel ?? '')
  const a = chapter.article
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center gap-3 bg-surface px-3 py-3 sm:px-4 ${isDragging ? 'z-10 shadow-lift' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-faint hover:bg-sunk hover:text-ink active:cursor-grabbing"
        aria-label={`लेख ${index + 1} हलवा`}
      >
        <GripVertical size={18} />
      </button>
      <span className="w-6 shrink-0 text-center font-display text-[18px] text-muted">{toDevanagariDigits(index + 1)}</span>
      <div className="hidden h-12 w-16 shrink-0 overflow-hidden rounded bg-sunk sm:block">
        {a.heroImage ? (
          <img src={img(a.heroImage, 384)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-faint">
            <ImageOff size={16} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
          {a.kicker && <span className="font-semibold text-ink-2">{a.kicker}</span>}
          {a.publishedAt && <span>{dateMr(a.publishedAt)}</span>}
          {!a.sourceUrl && <span className="chip bg-sunk text-muted">स्वतंत्र लेख</span>}
        </div>
        <Link href={`/admin/articles/${a.id}?book=${bookId}`} className="line-clamp-2 font-serif text-[15px] leading-snug text-ink hover:underline">
          {a.title}
        </Link>
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label.trim() !== (chapter.sectionLabel ?? '') && onLabel(label.trim() || null)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="विभाग"
        title="विभागाचे नाव (उदा. जिल्हा). सलग लेखांना एकच विभाग दिल्यास अनुक्रमणिकेत गट दिसतो."
        className="field hidden !w-32 !py-1.5 !text-[13px] md:block"
      />
      <Link href={`/admin/articles/${a.id}?book=${bookId}`} className="rounded p-1.5 text-muted hover:bg-sunk hover:text-ink" aria-label="लेख संपादित करा">
        <Pencil size={16} />
      </Link>
      <button onClick={onRemove} className="rounded p-1.5 text-muted hover:bg-brand-soft hover:text-brand" aria-label="पुस्तकातून काढा">
        <X size={17} />
      </button>
    </li>
  )
}
