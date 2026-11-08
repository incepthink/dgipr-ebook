'use client'

import { PageFlip, type FlippingState } from 'page-flip'
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Layout } from '@/lib/paginate/types'

interface Props {
  /** Remounts the book when it changes (new pagination). */
  instanceKey: string
  layout: Layout
  count: number
  startPage: number
  isHard: (i: number) => boolean
  renderPage: (i: number) => ReactNode
  onFlip: (i: number) => void
  onState?: (s: FlippingState) => void
  apiRef: RefObject<PageFlip | null>
  reducedMotion: boolean
}

/**
 * StPageFlip in HTML mode, driven from React.
 *
 * The library moves its page elements into its own DOM, which React must not
 * own. So the page shells are created here, handed to the library, and React
 * renders each page's content into its shell through a portal — wherever the
 * library has put it.
 */
export function FlipBook({ instanceKey, layout, count, startPage, isHard, renderPage, onFlip, onState, apiRef, reducedMotion }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [shells, setShells] = useState<HTMLElement[]>([])
  const handlers = useRef({ onFlip, onState })
  handlers.current = { onFlip, onState }

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const book = document.createElement('div')
    book.className = 'flip-book'
    host.appendChild(book)

    const items = Array.from({ length: count }, (_, i) => {
      const d = document.createElement('div')
      d.className = 'page-shell'
      if (isHard(i)) d.dataset.density = 'hard'
      return d
    })

    const { pageW, pageH, mode } = layout
    const pf = new PageFlip(book, {
      width: pageW,
      height: pageH,
      size: 'stretch',
      minWidth: pageW,
      maxWidth: pageW,
      minHeight: pageH,
      maxHeight: pageH,
      autoSize: true,
      showCover: true,
      usePortrait: mode === 'single',
      startPage: Math.max(0, Math.min(startPage, count - 1)),
      drawShadow: true,
      maxShadowOpacity: 0.45,
      flippingTime: reducedMotion ? 1 : 820,
      mobileScrollSupport: false,
      disableFlipByClick: true,
      showPageCorners: true,
      swipeDistance: 28,
      clickEventForward: true,
    })
    pf.loadFromHTML(items)
    pf.on('flip', (e) => handlers.current.onFlip(e.data))
    pf.on('changeState', (e) => handlers.current.onState?.(e.data))
    apiRef.current = pf
    setShells(items)

    return () => {
      apiRef.current = null
      setShells([])
      try {
        pf.destroy()
      } catch {
        book.remove()
      }
    }
    // A new pagination is a new book; everything else flows through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey])

  const width = layout.mode === 'spread' ? layout.pageW * 2 : layout.pageW
  return (
    <div ref={hostRef} style={{ width, height: layout.pageH }}>
      {shells.map((el, i) => createPortal(renderPage(i), el, `p${i}`))}
    </div>
  )
}
