'use client'

import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageView, folio, type PageContext } from './PageView'

const THUMB_H = 112

/** Spreads as the reader sees them: the cover alone, then pairs; or single pages. */
export function spreadsOf(count: number, spread: boolean): number[][] {
  if (!spread) return Array.from({ length: count }, (_, i) => [i])
  const out: number[][] = [[0]]
  for (let i = 1; i < count; i += 2) out.push(i + 1 < count ? [i, i + 1] : [i])
  return out
}

/**
 * Miniatures of every spread, drawn from the real page components scaled
 * down. Each renders only once it scrolls into view.
 */
export function ThumbStrip({ ctx, visible, onGo }: { ctx: PageContext; visible: number[]; onGo: (i: number) => void }) {
  const { layout, pag } = ctx
  const spreads = useMemo(() => spreadsOf(pag.pages.length, layout.mode === 'spread'), [pag.pages.length, layout.mode])
  const scale = THUMB_H / layout.pageH
  const w = Math.round(layout.pageW * scale)
  const scroller = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        setShown((prev) => {
          let next: Set<number> | null = null
          for (const e of entries) {
            const s = Number((e.target as HTMLElement).dataset.s)
            if (e.isIntersecting && !prev.has(s)) (next ??= new Set(prev)).add(s)
          }
          return next ?? prev
        })
      },
      { root, rootMargin: '0px 400px' },
    )
    root.querySelectorAll('[data-s]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [spreads])

  // Keep the open spread in view.
  useEffect(() => {
    const el = scroller.current?.querySelector('[aria-current="true"]') as HTMLElement | null
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [visible])

  return (
    <motion.div
      ref={scroller}
      className="thumbs"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.22 }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY
      }}
      role="listbox"
      aria-label="पानांचे लघुरूप"
    >
      {spreads.map((s, si) => {
        const current = s.some((i) => visible.includes(i))
        return (
          // Not a <button>: the miniature pages contain buttons of their own.
          <div
            key={si}
            data-s={si}
            className="thumb"
            aria-current={current}
            role="option"
            aria-selected={current}
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={() => onGo(s[0])}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onGo(s[0])
              }
            }}
          >
            <div className="thumb-spread">
              {s.map((i) => (
                <div key={i} className="thumb-page" style={{ width: w, height: THUMB_H }}>
                  {shown.has(si) && (
                    <div className="thumb-scale" inert style={{ width: layout.pageW, height: layout.pageH, transform: `scale(${scale})` }}>
                      <PageView ctx={ctx} index={i} page={pag.pages[i]} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span>{s.length === 2 ? `${folio(s[0])}–${folio(s[1])}` : folio(s[0])}</span>
          </div>
        )
      })}
    </motion.div>
  )
}
