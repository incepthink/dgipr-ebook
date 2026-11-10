import { cookies } from 'next/headers'
import { cache } from 'react'
import { handle, HttpError } from '@/lib/api'
import { query, readOnlyDb } from '@/lib/db'
import { newToken, sha256 } from './crypto'
import { toUser, type User } from './users'

const COOKIE = 'dgipr_session'
const MAX_AGE_DAYS = 60

/** The signed-in reader, or null. Cached per request, so pages and layouts can all ask. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  if (readOnlyDb()) return null
  const token = (await cookies()).get(COOKIE)?.value
  if (!token || token.length > 100) return null
  try {
    const [r] = await query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > now()`,
      [sha256(token)],
    )
    return r ? toUser(r) : null
  } catch (err) {
    // A database hiccup must not take the public library down: read as a guest.
    console.error('[auth] session lookup failed', err)
    return null
  }
})

export async function startSession(userId: number, req: Request): Promise<void> {
  const token = newToken()
  await query(
    `INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES ($1, $2, now() + make_interval(days => $3), $4)`,
    [sha256(token), userId, MAX_AGE_DAYS, (req.headers.get('user-agent') ?? '').slice(0, 300)],
  )
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId])
  await query(`DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()`, [userId])
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 3600,
  })
}

export async function endSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await query('DELETE FROM sessions WHERE id = $1', [sha256(token)])
  jar.delete(COOKIE)
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new HttpError('कृपया आधी प्रवेश करा', 401)
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (user.role !== 'admin') throw new HttpError('ही कृती फक्त व्यवस्थापकांसाठी आहे', 403)
  return user
}

/**
 * Cookies are SameSite=Lax, which already stops cross-site POSTs carrying the
 * session. This is the second lock: a state-changing request must come from
 * this site's own pages.
 */
export function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return
  // Every state-changing route passes through here; none may run read-only.
  if (readOnlyDb()) throw new HttpError('केवळ-वाचन मोड: हा बदल करता येणार नाही', 503)
  const origin = req.headers.get('origin')
  if (!origin) return // same-origin fetches from older browsers, curl from the server itself
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    if (new URL(origin).host === host) return
  } catch {
    /* fall through */
  }
  throw new HttpError('अवैध विनंती', 403)
}

/** `handle`, for routes any signed-in reader may call. */
export function userRoute<A extends [Request, ...unknown[]]>(fn: (user: User, ...args: A) => Promise<Response>) {
  return handle(async (...args: A) => {
    assertSameOrigin(args[0])
    return fn(await requireUser(), ...args)
  })
}

/** `handle`, for the admin console's routes. */
export function adminRoute<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return handle(async (...args: A) => {
    if (args[0] instanceof Request) assertSameOrigin(args[0])
    await requireAdmin()
    return fn(...args)
  })
}
