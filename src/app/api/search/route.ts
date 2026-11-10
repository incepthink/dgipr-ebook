import { handle, json } from '@/lib/api'
import { clientIp, throttle } from '@/lib/auth/throttle'
import { readOnlyDb } from '@/lib/db'
import { DISTRICT_KEYS } from '@/lib/districts'
import { searchArticles } from '@/lib/search'

export const dynamic = 'force-dynamic'

/** Public: search published articles by words and/or district. */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams
  const q = (sp.get('q') ?? '').trim().slice(0, 100)
  const d = sp.get('district')
  const district = d && DISTRICT_KEYS.includes(d) ? d : null
  if (q.length < 2 && !district) return json({ hits: [] })
  // Generous: one per keystroke pause. The counter needs a write, so read-only mode skips it.
  if (!readOnlyDb()) await throttle(`search:ip:${clientIp(req)}`, 120, 60)
  const hits = await searchArticles({ q: q.length >= 2 ? q : null, district, limit: Number(sp.get('limit')) || 30 })
  return json({ hits })
})
