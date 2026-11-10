import { query } from '@/lib/db'
import { HttpError } from '@/lib/api'

/**
 * Fixed-window rate limit kept in Postgres, so it holds across serverless
 * instances. Counts this hit and throws 429 once `limit` is passed.
 */
export async function throttle(key: string, limit: number, windowSec: number, message = 'खूप प्रयत्न झाले. थोड्या वेळाने पुन्हा प्रयत्न करा.') {
  const [row] = await query<{ hits: number }>(
    `INSERT INTO auth_throttle (key, hits, window_start) VALUES ($1, 1, now())
     ON CONFLICT (key) DO UPDATE SET
       hits = CASE WHEN auth_throttle.window_start < now() - make_interval(secs => $2) THEN 1 ELSE auth_throttle.hits + 1 END,
       window_start = CASE WHEN auth_throttle.window_start < now() - make_interval(secs => $2) THEN now() ELSE auth_throttle.window_start END
     RETURNING hits`,
    [key, windowSec],
  )
  if (row.hits > limit) throw new HttpError(message, 429)
}

/** The caller's IP as Vercel (or any proxy) reports it. Only used to key rate limits. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim()
}
