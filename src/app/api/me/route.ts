import { z } from 'zod'
import { handle, json } from '@/lib/api'
import { endSession, getSessionUser, userRoute } from '@/lib/auth/session'
import { deleteUser, publicUser, updateProfile } from '@/lib/auth/users'
import { DISTRICT_KEYS } from '@/lib/districts'
import { INTEREST_KEYS } from '@/lib/interests'

export const dynamic = 'force-dynamic'

export const GET = handle(async () => {
  const user = await getSessionUser()
  return json({ user: user ? publicUser(user) : null })
})

const Patch = z.object({
  name: z.string().trim().min(2, 'नाव किमान २ अक्षरांचे हवे').max(120).optional(),
  district: z.enum(DISTRICT_KEYS as [string, ...string[]], { message: 'कृपया यादीतील जिल्हा निवडा' }).nullable().optional(),
  interests: z.array(z.enum(INTEREST_KEYS as [string, ...string[]], { message: 'अवैध विषय' })).max(INTEREST_KEYS.length).optional(),
  notify: z.boolean().optional(),
})

export const PATCH = userRoute(async (user, req: Request) => {
  const patch = Patch.parse(await req.json())
  const updated = await updateProfile(user.id, { ...patch, interests: patch.interests && [...new Set(patch.interests)] })
  return json({ user: updated && publicUser(updated) })
})

/** Deletes the account and everything stored for it. */
export const DELETE = userRoute(async (user) => {
  await deleteUser(user.id)
  await endSession()
  return json({ ok: true })
})
