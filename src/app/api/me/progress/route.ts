import { z } from 'zod'
import { json } from '@/lib/api'
import { userRoute } from '@/lib/auth/session'
import { saveProgress } from '@/lib/reading'

export const dynamic = 'force-dynamic'

const AnchorSchema = z.object({ c: z.number().int(), b: z.number().int(), o: z.number().int() })

const Body = z.object({
  bookId: z.number().int().positive(),
  anchor: AnchorSchema,
  page: z.number().int().min(1).max(100_000),
  pageCount: z.number().int().min(1).max(100_000),
  finished: z.boolean().default(false),
})

/** Called by the reader as pages turn (debounced) and when the tab is hidden. */
export const POST = userRoute(async (user, req: Request) => {
  const b = Body.parse(await req.json())
  await saveProgress(user.id, b.bookId, b)
  return json({ ok: true })
})
