import { z } from 'zod'
import { handle, HttpError, json } from '@/lib/api'
import { hashPassword, verifyPassword } from '@/lib/auth/crypto'
import { normalizeEmail } from '@/lib/auth/normalize'
import { assertSameOrigin, startSession } from '@/lib/auth/session'
import { clientIp, throttle } from '@/lib/auth/throttle'
import { createUser, findUserByEmailWithHash, publicUser } from '@/lib/auth/users'

export const dynamic = 'force-dynamic'

// Verifying against this when the email is unknown keeps both answers equally slow.
let dummyHash: Promise<string> | null = null

const Body = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('login'), email: z.string().max(300), password: z.string().min(1).max(200) }),
  z.object({
    mode: z.literal('register'),
    name: z.string().trim().min(2, 'नाव किमान २ अक्षरांचे हवे').max(120),
    email: z.string().max(300),
    password: z.string().min(8, 'पासवर्ड किमान ८ अक्षरांचा हवा').max(200),
  }),
])

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req)
  const body = Body.parse(await req.json())
  const email = normalizeEmail(body.email)
  if (!email) throw new HttpError('कृपया वैध ईमेल लिहा', 400)
  const ip = clientIp(req)

  if (body.mode === 'register') {
    await throttle(`register:ip:${ip}`, 10, 3600)
    if (await findUserByEmailWithHash(email)) throw new HttpError('हा ईमेल आधीच नोंदणीकृत आहे — कृपया प्रवेश करा', 409)
    const user = await createUser({ email, name: body.name, passwordHash: await hashPassword(body.password) })
    await startSession(user.id, req)
    return json({ user: publicUser(user), needsProfile: true }, 201)
  }

  await throttle(`login:e:${email}`, 10, 900)
  await throttle(`login:ip:${ip}`, 40, 900)
  const found = await findUserByEmailWithHash(email)
  dummyHash ??= hashPassword('not-a-real-password')
  const ok = await verifyPassword(body.password, found?.hash ?? (await dummyHash))
  if (!found || !ok) throw new HttpError('ईमेल किंवा पासवर्ड चुकीचा आहे', 401)
  await startSession(found.user.id, req)
  return json({ user: publicUser(found.user), needsProfile: !found.user.name })
})
