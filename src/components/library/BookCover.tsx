import type { CSSProperties } from 'react'
import { Cover } from '@/components/reader/Cover'
import type { BookSummary } from '@/lib/types'

/** A book's cover as the shelves show it: the reader's own cover, framed. */
export function BookCover({ b, width = 640 }: { b: BookSummary; width?: 384 | 640 | 828 | 1080 }) {
  return (
    <div className="book-vars lib-cv" style={{ '--accent': b.accentColor } as CSSProperties}>
      <div className="cover-box">
        <Cover book={b} leadImage={b.leadImage} lines={b.leadTitles.map((t) => ({ title: t, kicker: null }))} imgWidth={width} />
      </div>
    </div>
  )
}
