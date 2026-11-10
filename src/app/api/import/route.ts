import { z } from 'zod'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/auth/session'
import { appendChapters, upsertArticleBySource } from '@/lib/db'
import { fetchPost, fetchPostByUrl, mapPost } from '@/lib/mahasamvad/wp'
import type { Article } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Import Mahasamvad posts — by pasted URL or by WordPress id — upserting by
 * URL, and optionally append them to a book in the given order.
 */
export const POST = adminRoute(async (req: Request) => {
  const body = z
    .object({
      urls: z.array(z.string().trim().min(1)).max(50).optional(),
      ids: z.array(z.number().int().positive()).max(50).optional(),
      bookId: z.number().int().positive().optional(),
    })
    .parse(await req.json())

  const jobs: { label: string; run: () => ReturnType<typeof fetchPost> }[] = [
    ...(body.urls ?? []).map((u) => ({ label: u, run: () => fetchPostByUrl(u) })),
    ...(body.ids ?? []).map((id) => ({ label: String(id), run: () => fetchPost(id) })),
  ]

  // A few at a time: polite to the site, quick enough for a dozen links.
  const results: ({ ok: true; article: Article } | { ok: false; label: string; error: string })[] = new Array(jobs.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++
        try {
          const post = await jobs[i].run()
          results[i] = { ok: true, article: await upsertArticleBySource(mapPost(post)) }
        } catch (err) {
          results[i] = { ok: false, label: jobs[i].label, error: (err as Error).message }
        }
      }
    }),
  )

  const imported = results.filter((r): r is { ok: true; article: Article } => r.ok).map((r) => r.article)
  const errors = results.filter((r) => !r.ok)
  let added = 0
  if (body.bookId && imported.length) added = await appendChapters(body.bookId, imported.map((a) => a.id))
  return json({ imported, errors, added })
})
