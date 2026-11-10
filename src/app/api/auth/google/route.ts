import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { baseUrl, googleConfigured, OAUTH_COOKIE, startGoogle } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/normalize'
import { readOnlyDb } from '@/lib/db'

export const dynamic = 'force-dynamic'


/** "Google ने सुरू ठेवा": remember state + PKCE verifier for 10 minutes, then go to Google. */
export async function GET(req: Request) {
  const next = safeNext(new URL(req.url).searchParams.get('next'))
  const back = (error: string) => NextResponse.redirect(`${baseUrl(req)}/login?error=${error}&next=${encodeURIComponent(next)}`)
  if (readOnlyDb()) return back('readonly')
  if (!googleConfigured()) return back('google_unavailable')

  const { url, state, verifier } = startGoogle(req)
  ;(await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the top-level redirect back from Google
    path: '/api/auth/google',
    maxAge: 600,
  })
  return NextResponse.redirect(url)
}
