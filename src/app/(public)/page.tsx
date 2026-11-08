import { Library } from '@/components/library/Library'
import { listPublishedBooks } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const books = await listPublishedBooks()
  return <Library books={books} />
}
