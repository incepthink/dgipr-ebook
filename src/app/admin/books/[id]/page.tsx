import { notFound } from 'next/navigation'
import { BookEditor } from '@/components/admin/BookEditor'
import { requireAdminPage } from '@/lib/auth/guard'
import { getBook, listChapters } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function EditBook({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id
  await requireAdminPage(`/admin/books/${raw}`)
  const id = Number(raw)
  const book = Number.isInteger(id) ? await getBook(id) : null
  if (!book) notFound()
  return <BookEditor initialBook={book} initialChapters={await listChapters(id)} />
}
