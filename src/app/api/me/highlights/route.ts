import { z } from 'zod'
import { json } from '@/lib/api'
import { userRoute } from '@/lib/auth/session'
import { replaceHighlights } from '@/lib/reading'

export const dynamic = 'force-dynamic'

const Highlight = z
  .object({
    id: z.string().regex(/^[a-z0-9]{4,40}$/),
    c: z.number().int().min(0).max(10_000),
    b: z.number().int().min(0).max(100_000),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    text: z.string().max(4000),
    color: z.enum(['yellow', 'green', 'blue', 'pink']),
    note: z.string().max(2000).default(''),
    at: z.number().int().positive(),
  })
  .refine((h) => h.end > h.start, 'end must be after start')

const Body = z.object({ bookId: z.number().int().positive(), highlights: z.array(Highlight).max(1000) })

export const PUT = userRoute(async (user, req: Request) => {
  const b = Body.parse(await req.json())
  await replaceHighlights(user.id, b.bookId, b.highlights)
  return json({ ok: true })
})
