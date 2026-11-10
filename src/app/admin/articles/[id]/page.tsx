import { notFound } from 'next/navigation'
import { ArticleEditor } from '@/components/admin/ArticleEditor'
import { requireAdminPage } from '@/lib/auth/guard'
import { booksForArticle, getArticle } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function EditArticle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ book?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  await requireAdminPage(`/admin/articles/${id}`)
  const n = Number(id)
  const article = Number.isInteger(n) ? await getArticle(n) : null
  if (!article) notFound()
  const bookId = Number(sp.book)
  return (
    <ArticleEditor
      key={article.id}
      initial={article}
      books={await booksForArticle(n)}
      bookId={Number.isInteger(bookId) && bookId > 0 ? bookId : null}
    />
  )
}
