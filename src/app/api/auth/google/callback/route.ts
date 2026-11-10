import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { baseUrl, finishGoogle, googleConfigured, OAUTH_COOKIE, UnverifiedEmail } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/normalize'
import { startSession } from '@/lib/auth/session'
import { clientIp, throttle } from '@/lib/auth/throttle'
import { signInWithGoogle } from '@/lib/auth/users'
import { readOnlyDb } from '@/lib/db'
import { safeEqualHex, sha256 } from '@/lib/auth/crypto'

export const dynamic = 'force-dynamic'

/** Google sends the reader back here with a one-time code. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const jar = await cookies()
  const raw = jar.get(OAUTH_COOKIE)?.value
  jar.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' })

  let saved: { state?: string; verifier?: string; next?: string } = {}
  try {
    saved = raw ? JSON.parse(raw) : {}
  } catch {
    /* treated as missing */
  }
  const next = safeNext(saved.next)
  const back = (error: string) => NextResponse.redirect(`${baseUrl(req)}/login?error=${error}&next=${encodeURIComponent(next)}`)

  if (readOnlyDb()) return back('readonly')
  if (!googleConfigured()) return back('google_unavailable')
  // The reader pressed "Cancel" on Google's screen.
  if (params.get('error')) return back('google_cancelled')

  const code = params.get('code')
  const state = params.get('state')
  // The state must be the one this browser was given: stops a forged callback
  // from signing someone into an attacker's account.
  if (!code || !state || !saved.state || !saved.verifier || !safeEqualHex(sha256(state), sha256(saved.state))) {
    return back('google_expired')
  }

  try {
    await throttle(`google:ip:${clientIp(req)}`, 30, 900)
    const profile = await finishGoogle(req, code, saved.verifier)
    const { user, isNew } = await signInWithGoogle(profile)
    await startSession(user.id, req)
    // A new account gets one short, skippable step to pick district and interests.
    const dest = isNew ? `/login?onboard=1&next=${encodeURIComponent(next)}` : next
    return NextResponse.redirect(`${baseUrl(req)}${dest}`)
  } catch (err) {
    if (err instanceof UnverifiedEmail) return back('google_unverified')
    console.error('[google] sign-in failed', err)
    return back('google_failed')
  }
}
