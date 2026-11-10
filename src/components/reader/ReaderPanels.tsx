'use client'

import {
  BookOpenText,
  GalleryHorizontal,
  Headphones,
  Pause,
  Play,
  Search,
  Share2,
  SkipBack,
  SkipForward,
  Type,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toDevanagariDigits } from '@/lib/marathi'
import type { Anchor } from '@/lib/paginate/types'
import type { TextBlock } from './bookText'
import { Panel } from './Panels'
import type { Highlight } from './storage'
import type { SpeechStatus } from './useReadAloud'

/* --------------------------------------------------------- search in book */

const SNIP = 60

export function SearchPanel({
  blocks,
  titles,
  onGo,
  onClose,
}: {
  blocks: TextBlock[]
  titles: string[]
  onGo: (a: Anchor) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const hits = useMemo(() => {
    if (needle.length < 2) return []
    const out: { a: Anchor; before: string; match: string; after: string; c: number }[] = []
    for (const bl of blocks) {
      const hay = bl.text.toLowerCase()
      let from = 0
      for (let i = hay.indexOf(needle, from); i !== -1 && out.length < 80; i = hay.indexOf(needle, from)) {
        out.push({
          a: { c: bl.c, b: bl.b, o: i },
          c: bl.c,
          before: (i > SNIP ? '…' : '') + bl.text.slice(Math.max(0, i - SNIP), i),
          match: bl.text.slice(i, i + needle.length),
          after: bl.text.slice(i + needle.length, i + needle.length + SNIP) + (i + needle.length + SNIP < bl.text.length ? '…' : ''),
        })
        from = i + needle.length
      }
    }
    return out
  }, [blocks, needle])

  return (
    <Panel title="पुस्तकात शोधा" onClose={onClose} label="पुस्तकात शोधा">
      <div style={{ padding: '0 12px 10px' }}>
        <label className="rp-search">
          <Search size={18} aria-hidden />
          <span className="sr-only">शब्द</span>
          <input autoFocus type="search" placeholder="शब्द लिहा…" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
        </label>
        {needle.length >= 2 && (
          <p className="rp-count">{hits.length ? `${toDevanagariDigits(hits.length)}${hits.length >= 80 ? '+' : ''} ठिकाणी सापडले` : 'काहीही सापडले नाही'}</p>
        )}
      </div>
      <div className="panel-body">
        {hits.map((h, i) => (
          <button key={i} className="rp-hit" onClick={() => onGo(h.a)}>
            <small>{titles[h.c]}</small>
            <span>
              {h.before}
              <mark>{h.match}</mark>
              {h.after}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------- note editor */

export function NotePanel({
  highlight,
  onSave,
  onRemove,
  onClose,
}: {
  highlight: Highlight
  onSave: (note: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [note, setNote] = useState(highlight.note)
  return (
    <Panel title="नोंद" onClose={onClose} pop label="नोंद">
      <div style={{ padding: '0 16px 18px', display: 'grid', gap: 12 }}>
        <blockquote className={`rp-quote hl--${highlight.color}`}>{highlight.text}</blockquote>
        <textarea
          className="rp-note"
          autoFocus
          rows={4}
          maxLength={2000}
          placeholder="या ओळीबद्दल आपली नोंद…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="rp-btn rp-btn--primary" onClick={() => onSave(note.trim())}>
            जतन करा
          </button>
          <button className="rp-btn" onClick={onRemove}>
            ठळक काढा
          </button>
        </div>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------- phone overflow menu */

export function MorePanel({
  textMode,
  canListen,
  onPick,
  onClose,
}: {
  textMode: boolean
  canListen: boolean
  onPick: (what: 'settings' | 'search' | 'listen' | 'share' | 'thumbs' | 'mode') => void
  onClose: () => void
}) {
  const items = [
    { id: 'mode' as const, icon: <BookOpenText size={20} />, label: textMode ? 'पुस्तक रूपात वाचा' : 'सोपे वाचन (मोठी अक्षरे, स्क्रोल)' },
    { id: 'search' as const, icon: <Search size={20} />, label: 'पुस्तकात शोधा' },
    ...(canListen ? [{ id: 'listen' as const, icon: <Headphones size={20} />, label: 'ऐका (मोठ्याने वाचून दाखवा)' }] : []),
    { id: 'settings' as const, icon: <Type size={20} />, label: 'अक्षरांचा आकार व रंग' },
    { id: 'share' as const, icon: <Share2 size={20} />, label: 'हा लेख शेअर करा' },
    ...(!textMode ? [{ id: 'thumbs' as const, icon: <GalleryHorizontal size={20} />, label: 'पानांचे लघुरूप' }] : []),
  ]
  return (
    <Panel title="अधिक पर्याय" onClose={onClose} pop label="अधिक पर्याय">
      <div className="rp-menu">
        {items.map((it) => (
          <button key={it.id} onClick={() => onPick(it.id)}>
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------ read-aloud player */

const RATES = [0.8, 1, 1.25, 1.5]

export function ListenBar({
  status,
  title,
  rate,
  voiceLang,
  onPlay,
  onPause,
  onSkip,
  onRate,
  onClose,
  raised,
}: {
  status: SpeechStatus
  title: string
  rate: number
  voiceLang: 'mr' | 'hi' | 'other' | null
  onPlay: () => void
  onPause: () => void
  onSkip: (dir: 1 | -1) => void
  onRate: (r: number) => void
  onClose: () => void
  /** Sit above the book's page slider. */
  raised: boolean
}) {
  const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1
  return (
    <div className="listen" data-raised={raised} role="region" aria-label="ऐका" onPointerDown={(e) => e.stopPropagation()}>
      <div className="listen-meta">
        <b>{status === 'playing' ? 'वाचून दाखवत आहे' : 'थांबवले'}</b>
        <span>{title}</span>
        {voiceLang && voiceLang !== 'mr' && <em>मराठी आवाज नसल्याने {voiceLang === 'hi' ? 'हिंदी' : 'उपलब्ध'} आवाजात वाचले जाईल</em>}
        {voiceLang === null && <em>या उपकरणावर आवाज सापडला नाही</em>}
      </div>
      <div className="listen-ctl">
        <button className="ibtn" aria-label="मागील परिच्छेद" onClick={() => onSkip(-1)}>
          <SkipBack />
        </button>
        <button className="listen-main" aria-label={status === 'playing' ? 'थांबवा' : 'सुरू करा'} onClick={status === 'playing' ? onPause : onPlay}>
          {status === 'playing' ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button className="ibtn" aria-label="पुढील परिच्छेद" onClick={() => onSkip(1)}>
          <SkipForward />
        </button>
        <button className="listen-rate" aria-label={`वेग ${next}x करा`} onClick={() => onRate(next)}>
          {toDevanagariDigits(rate)}x
        </button>
        <button className="ibtn" aria-label="ऐकणे बंद करा" onClick={onClose}>
          <X />
        </button>
      </div>
    </div>
  )
}
