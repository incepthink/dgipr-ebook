import { z } from 'zod'
import { HttpError, json } from '@/lib/api'
import { userRoute } from '@/lib/auth/session'
import { bookIsVisible, setSaved } from '@/lib/reading'

export const dynamic = 'force-dynamic'

const Body = z.object({ bookId: z.number().int().positive(), saved: z.boolean() })

export const POST = userRoute(async (user, req: Request) => {
  const b = Body.parse(await req.json())
  if (b.saved && !(await bookIsVisible(b.bookId))) throw new HttpError('पुस्तक सापडले नाही', 404)
  await setSaved(user.id, b.bookId, b.saved)
  return json({ ok: true, saved: b.saved })
})
