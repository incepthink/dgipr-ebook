import { notFound } from 'next/navigation'
import { BookEditor } from '@/components/admin/BookEditor'
import { getBook, listChapters } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function EditBook({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const book = Number.isInteger(id) ? await getBook(id) : null
  if (!book) notFound()
  return <BookEditor initialBook={book} initialChapters={await listChapters(id)} />
}
