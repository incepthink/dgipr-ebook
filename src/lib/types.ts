export type BookKind = 'edition' | 'themed' | 'special'
export type BookStatus = 'draft' | 'published' | 'scheduled'

export interface CoverStyle {
  /** 'auto' builds an editorial cover from the lead story; 'image' uses `cover_image` full-bleed. */
  mode: 'auto' | 'image'
}

export interface Book {
  id: number
  slug: string
  title: string
  subtitle: string | null
  kind: BookKind
  editionDate: string | null // YYYY-MM-DD
  description: string | null
  coverImage: string | null
  coverStyle: CoverStyle
  accentColor: string
  status: BookStatus
  publishAt: string | null // ISO
  createdAt: string
  updatedAt: string
}

export interface BookSummary extends Book {
  chapterCount: number
  leadImage: string | null
  leadTitles: string[]
  /** Districts its articles are from: for the district filter. */
  districts: string[]
}

export interface Article {
  id: number
  sourceUrl: string | null
  wpId: number | null
  title: string
  kicker: string | null
  dateline: string | null
  district: string | null
  publishedAt: string | null
  heroImage: string | null
  heroCredit: string | null
  contentHtml: string
  excerpt: string | null
  createdAt: string
  updatedAt: string
}

export type ArticleInput = Partial<Omit<Article, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }

export interface Chapter {
  id: number
  bookId: number
  articleId: number
  position: number
  sectionLabel: string | null
}

export interface ChapterWithArticle extends Chapter {
  article: Article
}

/** Everything the reader needs, serialisable from server to client. */
export interface ReaderBook {
  book: Book
  chapters: ChapterWithArticle[]
}

export const KIND_LABEL: Record<BookKind, string> = {
  edition: 'आवृत्ती',
  themed: 'विषयवार संग्रह',
  special: 'विशेषांक',
}

export const STATUS_LABEL: Record<BookStatus, string> = {
  draft: 'मसुदा',
  published: 'प्रकाशित',
  scheduled: 'नियोजित',
}

export const DEFAULT_ACCENT = '#A8172C'
