import { handle, json } from '@/lib/api'
import { assertSameOrigin, endSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req)
  await endSession()
  return json({ ok: true })
})
