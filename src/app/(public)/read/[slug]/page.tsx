import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReaderLoader } from '@/components/reader/ReaderLoader'
import { getReaderBook, isVisible } from '@/lib/db'
import { img } from '@/lib/img'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ p?: string; preview?: string }>
}

async function load(slug: string, preview: boolean) {
  const data = await getReaderBook(decodeURIComponent(slug))
  if (!data || (!preview && !isVisible(data.book))) return null
  return data
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const data = await load(slug, sp.preview === '1')
  if (!data) return { title: 'पुस्तक सापडले नाही' }
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
  const preview = sp.preview === '1'
  const data = await load(slug, preview)
  if (!data) notFound()
  const p = Number(sp.p)
  return <ReaderLoader data={data} preview={preview} initialPage={Number.isInteger(p) && p > 0 ? p - 1 : null} />
}
