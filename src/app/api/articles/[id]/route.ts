import { ArticlePatch, fail, idParam, json } from '@/lib/api'
import { adminRoute } from '@/lib/auth/session'
import { booksForArticle, deleteArticle, getArticle, updateArticle } from '@/lib/db'
import { excerptOf, sanitizeArticleHtml } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export const GET = adminRoute(async (_req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const article = await getArticle(id)
  if (!article) return fail('लेख सापडला नाही', 404)
  return json({ article, books: await booksForArticle(id) })
})

export const PATCH = adminRoute(async (req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const patch = ArticlePatch.parse(await req.json())
  const extra: { contentHtml?: string; excerpt?: string } = {}
  if (patch.contentHtml != null) {
    extra.contentHtml = sanitizeArticleHtml(patch.contentHtml)
    extra.excerpt = excerptOf(extra.contentHtml)
  }
  const article = await updateArticle(id, { ...patch, ...extra })
  return article ? json(article) : fail('लेख सापडला नाही', 404)
})

export const DELETE = adminRoute(async (_req: Request, { params }: Ctx) => {
  await deleteArticle(await idParam(params))
  return json({ ok: true })
})
