import { z } from 'zod'
import { json } from '@/lib/api'
import { userRoute } from '@/lib/auth/session'
import { replaceBookmarks } from '@/lib/reading'

export const dynamic = 'force-dynamic'

const Mark = z.object({
  anchor: z.object({ c: z.number().int(), b: z.number().int(), o: z.number().int() }),
  label: z.string().max(400).default(''),
  snippet: z.string().max(400).default(''),
  at: z.number().int().positive(),
})

const Body = z.object({ bookId: z.number().int().positive(), marks: z.array(Mark).max(500) })

export const PUT = userRoute(async (user, req: Request) => {
  const b = Body.parse(await req.json())
  await replaceBookmarks(user.id, b.bookId, b.marks)
  return json({ ok: true })
})
