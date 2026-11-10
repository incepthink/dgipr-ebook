import { z } from 'zod'
import { ArticlePatch, json } from '@/lib/api'
import { adminRoute } from '@/lib/auth/session'
import { appendChapters, createArticle, listArticles } from '@/lib/db'
import { excerptOf, sanitizeArticleHtml } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

export const GET = adminRoute(async (req: Request) => {
  const url = new URL(req.url)
  return json(await listArticles({ search: url.searchParams.get('search') ?? undefined, limit: 200 }))
})

/** A manual article; with `bookId` it is also appended to that book. */
export const POST = adminRoute(async (req: Request) => {
  const body = ArticlePatch.extend({
    title: z.string().trim().min(1).max(400),
    bookId: z.number().int().positive().optional(),
  }).parse(await req.json())
  const { bookId, ...input } = body
  const contentHtml = sanitizeArticleHtml(input.contentHtml ?? '')
  const article = await createArticle({ ...input, contentHtml, excerpt: excerptOf(contentHtml) })
  if (bookId) await appendChapters(bookId, [article.id])
  return json(article, 201)
})
