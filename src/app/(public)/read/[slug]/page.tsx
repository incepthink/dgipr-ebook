import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReaderLoader } from '@/components/reader/ReaderLoader'
import { getSessionUser } from '@/lib/auth/session'
import { getReaderBook, isVisible } from '@/lib/db'
import { img } from '@/lib/img'
import { decodeAnchor } from '@/lib/paginate/anchors'
import { readerState } from '@/lib/reading'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ p?: string; preview?: string; at?: string; mode?: string; find?: string }>
}

/** Drafts can only be previewed by the admin console's users. */
async function canPreview(sp: { preview?: string }) {
  if (sp.preview !== '1') return false
  return (await getSessionUser())?.role === 'admin'
}

async function load(slug: string, preview: boolean) {
  const data = await getReaderBook(decodeURIComponent(slug))
  if (!data || (!preview && !isVisible(data.book))) return null
  return data
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const data = await load(slug, await canPreview(sp))
  if (!data) return { title: 'पुस्तक सापडले नाही' }
  // A shared article link previews that article: its headline, summary and photo.
  const at = decodeAnchor(sp.at)
  const article = at && at.c >= 0 ? data.chapters[at.c]?.article : null
  if (article) {
    const photo = article.heroImage ?? data.book.coverImage
    return {
      title: article.title,
      description: article.excerpt ?? undefined,
      openGraph: {
        title: article.title,
        description: article.excerpt ?? `${data.book.title} · महासंवाद ई-पुस्तके`,
        images: photo ? [{ url: img(photo, 1200) }] : undefined,
        type: 'article',
      },
    }
  }
  const lead = data.book.coverImage ?? data.chapters.find((c) => c.article.heroImage)?.article.heroImage
  return {
    title: data.book.subtitle ? `${data.book.title} — ${data.book.subtitle}` : data.book.title,
    description: data.book.description ?? undefined,
    openGraph: {
      title: data.book.title,
      description: data.book.description ?? undefined,
      images: lead ? [{ url: img(lead, 1200) }] : undefined,
      type: 'book',
    },
  }
}

export default async function ReadPage({ params, searchParams }: Params) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const preview = await canPreview(sp)
  const data = await load(slug, preview)
  if (!data) notFound()

  const user = await getSessionUser()
  const state = user && !preview ? await readerState(user.id, data.book.id) : null
  const p = Number(sp.p)

  return (
    <ReaderLoader
      data={data}
      preview={preview}
      initialPage={Number.isInteger(p) && p > 0 ? p - 1 : null}
      initialAnchor={decodeAnchor(sp.at)}
      initialMode={sp.mode === 'text' ? 'text' : null}
      initialFind={sp.find?.slice(0, 100) || null}
      account={{
        signedIn: !!user,
        progress: state?.progress ? { anchor: state.progress.anchor } : null,
        bookmarks: state?.bookmarks ?? [],
        highlights: state?.highlights ?? [],
      }}
    />
  )
}
