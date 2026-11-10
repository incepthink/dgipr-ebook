/**
 * "Sign in with Google": the OAuth 2.0 authorization-code flow with PKCE,
 * done with plain fetch (no SDK to install).
 *
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from a Google Cloud
 * "OAuth client ID" (type: Web application), with this authorised redirect URI
 * for every address the site is opened at:
 *   <base URL>/api/auth/google/callback
 * e.g. https://dgipr-ebook.vercel.app/api/auth/google/callback and
 *      http://localhost:3000/api/auth/google/callback
 */
import { createHash, randomBytes } from 'node:crypto'
import type { GoogleProfile } from './users'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export const OAUTH_COOKIE = 'dgipr_g_oauth'

export const googleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET

/** The site's own address. Fixed by NEXT_PUBLIC_BASE_URL so start and callback always agree. */
export function baseUrl(req: Request): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/+$/, '')
}

export const callbackUrl = (req: Request) => `${baseUrl(req)}/api/auth/google/callback`

export interface OAuthStart {
  url: string
  state: string
  verifier: string
}

export function startGoogle(req: Request): OAuthStart {
  const state = randomBytes(24).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return { url: `${AUTH_URL}?${q}`, state, verifier }
}

/**
 * Trades Google's one-time code for the person's profile. The profile comes
 * straight from Google over TLS with the access token we just received, so it
 * needs no further signature check.
 */
export async function finishGoogle(req: Request, code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(req),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!tokenRes.ok || !token.access_token) throw new Error(`google token: ${token.error ?? tokenRes.status}`)

  const infoRes = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15_000),
  })
  const info = (await infoRes.json().catch(() => ({}))) as {
    sub?: string
    email?: string
    email_verified?: boolean
    name?: string
    picture?: string
  }
  if (!infoRes.ok || !info.sub || !info.email) throw new Error(`google userinfo: ${infoRes.status}`)
  if (info.email_verified !== true) throw new UnverifiedEmail()
  return {
    sub: info.sub,
    email: info.email.trim().toLowerCase(),
    name: info.name?.trim().slice(0, 120) || null,
    picture: info.picture?.startsWith('https://') ? info.picture.slice(0, 500) : null,
  }
}

export class UnverifiedEmail extends Error {}
