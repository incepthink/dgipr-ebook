'use client'

import { Check, Copy, Minus, Moon, Plus, Share2, Sun, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { FONT_STEPS } from '@/lib/paginate/layout'
import { pageForAnchor } from '@/lib/paginate/anchors'
import type { Pagination } from '@/lib/paginate/types'
import { toDevanagariDigits } from '@/lib/marathi'
import type { ReaderBook } from '@/lib/types'
import { folio } from './PageView'
import type { Bookmark, Prefs, Theme } from './storage'

function Panel({
  title,
  onClose,
  children,
  pop,
  label,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  pop?: boolean
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className={`panel${pop ? ' panel--pop' : ''}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ outline: 'none' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel-head">
        <h3>{title}</h3>
        <button className="ibtn" onClick={onClose} aria-label="बंद करा">
          <X />
        </button>
      </div>
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------ contents & marks */

export function ContentsPanel({
  data,
  pag,
  current,
  visible,
  bookmarks,
  initialTab,
  onGo,
  onRemoveBookmark,
  onClose,
}: {
  data: ReaderBook
  pag: Pagination
  current: number
  visible: number[]
  bookmarks: Bookmark[]
  initialTab: 'toc' | 'marks'
  onGo: (page: number) => void
  onRemoveBookmark: (b: Bookmark) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState(initialTab)
  // The chapter being read: the last one starting at or before this spread.
  const reading = pag.chapterStart.reduce((acc, start, c) => (start <= Math.max(...visible) ? c : acc), -1)
  let lastSection: string | null = null

  return (
    <Panel title={data.book.title} onClose={onClose} label="अनुक्रमणिका व खुणा">
      <div className="panel-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'toc'} onClick={() => setTab('toc')}>
          अनुक्रमणिका
        </button>
        <button role="tab" aria-selected={tab === 'marks'} onClick={() => setTab('marks')}>
          खुणा {bookmarks.length ? `(${toDevanagariDigits(bookmarks.length)})` : ''}
        </button>
      </div>
      <div className="panel-body">
        {tab === 'toc' ? (
          <>
            <button className="tocl-item" onClick={() => onGo(0)} aria-current={current === 0}>
              <span className="n">◆</span>
              <span className="t">मुखपृष्ठ</span>
              <span className="p" />
            </button>
            {data.chapters.map((ch, c) => {
              const section = ch.sectionLabel && ch.sectionLabel !== lastSection ? ch.sectionLabel : null
              lastSection = ch.sectionLabel
              return (
                <div key={ch.id}>
                  {section && <div className="tocl-section">{section}</div>}
                  <button className="tocl-item" onClick={() => onGo(pag.chapterStart[c])} aria-current={reading === c}>
                    <span className="n">{toDevanagariDigits(c + 1)}</span>
                    <span className="t">
                      {ch.article.kicker && <small>{ch.article.kicker}</small>}
                      {ch.article.title}
                    </span>
                    <span className="p">{folio(pag.chapterStart[c])}</span>
                  </button>
                </div>
              )
            })}
          </>
        ) : bookmarks.length ? (
          [...bookmarks]
            .sort((a, b) => pageForAnchor(pag.pages, a.anchor) - pageForAnchor(pag.pages, b.anchor))
            .map((b) => {
              const p = pageForAnchor(pag.pages, b.anchor)
              return (
                <div key={b.at} style={{ display: 'flex', alignItems: 'start' }}>
                  <button className="tocl-item" onClick={() => onGo(p)} aria-current={visible.includes(p)}>
                    <span className="n" style={{ fontSize: 14 }}>
                      ▮
                    </span>
                    <span className="t">
                      <small>{b.label}</small>
                      {b.snippet}
                    </span>
                    <span className="p">{folio(p)}</span>
                  </button>
                  <button className="ibtn" style={{ marginTop: 4 }} onClick={() => onRemoveBookmark(b)} aria-label="खूण काढा">
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })
        ) : (
          <p className="empty-note">
            अद्याप एकही खूण नाही.
            <br />
            वरच्या पट्टीतील खुणेच्या चिन्हाने हे पान जतन करा.
          </p>
        )}
      </div>
    </Panel>
  )
}

/* -------------------------------------------------------------- settings */

const THEMES: { id: Theme; label: string; swatch: string; icon?: ReactNode }[] = [
  { id: 'day', label: 'दिवस', swatch: '#fbfaf7', icon: <Sun size={15} /> },
  { id: 'sepia', label: 'सेपिया', swatch: '#f5ecd7' },
  { id: 'night', label: 'रात्र', swatch: '#1d1c1a', icon: <Moon size={15} /> },
]

export function SettingsPanel({
  prefs,
  onChange,
  onClose,
  busy,
}: {
  prefs: Prefs
  onChange: (p: Partial<Prefs>) => void
  onClose: () => void
  busy: boolean
}) {
  const pct = Math.round(FONT_STEPS[prefs.fontStep] * 100)
  return (
    <Panel title="वाचन सेटिंग्ज" onClose={onClose} pop label="वाचन सेटिंग्ज">
      <div style={{ padding: '4px 18px 20px', display: 'grid', gap: 20 }}>
        <section>
          <div className="slider-meta" style={{ marginBottom: 8 }}>
            <b>अक्षरांचा आकार</b>
            <span>{busy ? 'पाने जुळवत आहोत…' : `${toDevanagariDigits(pct)}%`}</span>
          </div>
          <div className="seg">
            <button
              onClick={() => onChange({ fontStep: prefs.fontStep - 1 })}
              disabled={prefs.fontStep <= 0}
              aria-label="अक्षरे लहान करा"
              style={{ fontSize: 14 }}
            >
              अ<Minus size={13} />
            </button>
            <button
              onClick={() => onChange({ fontStep: prefs.fontStep + 1 })}
              disabled={prefs.fontStep >= FONT_STEPS.length - 1}
              aria-label="अक्षरे मोठी करा"
              style={{ fontSize: 19 }}
            >
              अ<Plus size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }} aria-hidden>
            {FONT_STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === prefs.fontStep ? 'var(--accent)' : 'var(--chrome-line)',
                }}
              />
            ))}
          </div>
        </section>
        <section>
          <div className="slider-meta" style={{ marginBottom: 8 }}>
            <b>पानाचा रंग</b>
          </div>
          <div className="seg">
            {THEMES.map((t) => (
              <button key={t.id} aria-pressed={prefs.theme === t.id} onClick={() => onChange({ theme: t.id })}>
                <span className="swatch" style={{ background: t.swatch }} />
                {t.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="seg">
            <button aria-pressed={prefs.sound} onClick={() => onChange({ sound: !prefs.sound })}>
              {prefs.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
              पान उलटण्याचा आवाज {prefs.sound ? 'चालू' : 'बंद'}
            </button>
          </div>
        </section>
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------------- share */

export function SharePanel({
  url,
  title,
  pageLabel,
  onClose,
}: {
  url: string
  title: string
  pageLabel: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const text = `${title} — ${pageLabel}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <Panel title="शेअर करा" onClose={onClose} pop label="शेअर करा">
      <div style={{ padding: '0 18px 20px', display: 'grid', gap: 12 }}>
        <p style={{ fontSize: 13.5, color: 'var(--chrome-muted)', lineHeight: 1.5 }}>
          ही लिंक उघडणाऱ्याला थेट <b style={{ color: 'var(--chrome-ink)' }}>{pageLabel}</b> दिसेल.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 8px 8px 12px',
            borderRadius: 10,
            background: 'var(--chrome-hover)',
            fontSize: 13,
            userSelect: 'all',
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>{url}</span>
          <button className="ibtn" onClick={copy} aria-label="लिंक कॉपी करा" style={{ width: 34, height: 34 }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: canShare ? '1fr 1fr' : '1fr', gap: 8 }}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 12px',
              borderRadius: 10,
              background: '#1f9d55',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14.5,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
            </svg>
            WhatsApp
          </a>
          {canShare && (
            <button
              onClick={() => navigator.share({ title, text, url }).catch(() => {})}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 12px',
                borderRadius: 10,
                background: 'var(--chrome-ink)',
                color: 'var(--chrome-bg)',
                fontWeight: 700,
                fontSize: 14.5,
              }}
            >
              <Share2 size={17} /> इतर ॲप्स
            </button>
          )}
        </div>
      </div>
    </Panel>
  )
}
