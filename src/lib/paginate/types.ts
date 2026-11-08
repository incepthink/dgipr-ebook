/** A position in the book's text: chapter, block within it, characters into that block. */
export interface Anchor {
  c: number
  b: number
  o: number
}

/** Front matter sorts before every chapter, back matter after. */
export const FRONT = -1
export const BACK = 1_000_000

export type PageKind =
  | 'cover'
  | 'endpaper'
  | 'title'
  | 'imprint'
  | 'toc'
  | 'blank'
  | 'section'
  | 'photo'
  | 'content'
  | 'colophon'
  | 'back'

export type TocItem = { type: 'section'; label: string } | { type: 'entry'; chapter: number }

export interface Page {
  kind: PageKind
  anchor: Anchor
  /** Content pages: the typeset HTML of the page body. */
  html?: string
  chapter?: number
  isOpener?: boolean
  /** Contents pages: what this page lists; `first` carries the heading. */
  toc?: { items: TocItem[]; first: boolean }
  /** Section divider and photo pages: the section that begins here. */
  label?: string
  /** Photo pages: the facing chapter's photograph. */
  image?: string
  credit?: string | null
  hard?: boolean
}

export type Mode = 'spread' | 'single'

export interface Layout {
  mode: Mode
  pageW: number
  pageH: number
}

export interface Geometry {
  fs: number
  padX: number
  padT: number
  padB: number
  bodyW: number
  bodyH: number
}

export interface Pagination {
  key: string
  pages: Page[]
  /** Page index where each chapter's opener is. */
  chapterStart: number[]
  geometry: Geometry
}
