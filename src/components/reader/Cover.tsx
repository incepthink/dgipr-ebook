import { img } from '@/lib/img'
import { dateMr, monthYearMr } from '@/lib/marathi'
import type { Book } from '@/lib/types'
import { KIND_LABEL } from '@/lib/types'

export interface CoverData {
  book: Book
  leadImage: string | null
  lines: { title: string; kicker: string | null }[]
}

const GOV = 'महाराष्ट्र शासन · माहिती व जनसंपर्क महासंचालनालय'

/**
 * The front cover, drawn from the book itself: masthead, edition line, the
 * lead story's photograph and three cover lines. It scales with its box
 * (container units), so the same component serves the reader and the shelf.
 */
export function Cover({ book, leadImage, lines, imgWidth = 1080 }: CoverData & { imgWidth?: 640 | 828 | 1080 }) {
  const when = book.editionDate
    ? book.kind === 'edition'
      ? dateMr(book.editionDate)
      : monthYearMr(book.editionDate)
    : null
  const longTitle = [...book.title].length > 9

  if (book.coverStyle?.mode === 'image' && book.coverImage) {
    return (
      <div className="cover cover--image">
        <div className="cover-photo">
          <img src={img(book.coverImage, imgWidth)} alt="" />
        </div>
      </div>
    )
  }

  if (book.kind === 'themed') {
    return (
      <div className="cover cover--block">
        <div className="cover-band">
          <div className="cover-top">
            <div className="cover-gov">
              <img src="/emblem.png" alt="" />
              <span>{GOV}</span>
            </div>
            <div className={`cover-mast${longTitle ? ' is-long' : ''}`}>{book.title}</div>
            <div className="cover-meta">
              <span>{book.subtitle ?? KIND_LABEL[book.kind]}</span>
              {when && <span>{when}</span>}
            </div>
          </div>
        </div>
        {leadImage ? (
          <>
            <div className="cover-photo">
              <img src={img(leadImage, imgWidth)} alt="" />
            </div>
            <div className="cover-lines">
              {lines.slice(0, 2).map((l, i) => (
                <div className="cover-line" key={i}>
                  {l.kicker && <small>{l.kicker}</small>}
                  <span>{l.title}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          book.description && <p className="cover-desc">{book.description}</p>
        )}
      </div>
    )
  }

  return (
    <div className={`cover${leadImage ? '' : ' cover--plain'}`}>
      {leadImage && (
        <div className="cover-photo">
          <img src={img(leadImage, imgWidth)} alt="" />
        </div>
      )}
      <div className="cover-top">
        <div className="cover-gov">
          <img src="/emblem.png" alt="" />
          <span>{GOV}</span>
        </div>
        <div className={`cover-mast${longTitle ? ' is-long' : ''}`}>{book.title}</div>
        <div className="cover-meta">
          <span>{book.subtitle ?? KIND_LABEL[book.kind]}</span>
          {when && <span>{when}</span>}
        </div>
      </div>
      <div className="cover-lines">
        {lines.slice(0, 3).map((l, i) => (
          <div className="cover-line" key={i}>
            {l.kicker && <small>{l.kicker}</small>}
            <span>{l.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
