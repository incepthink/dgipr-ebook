import { handle, json } from '@/lib/api'
import { browsePosts } from '@/lib/mahasamvad/wp'

export const dynamic = 'force-dynamic'

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const category = Number(sp.get('category')) || undefined
  const search = sp.get('search')?.trim() || undefined
  return json({ ...(await browsePosts({ page, category, search, perPage: 20 })), page })
})
