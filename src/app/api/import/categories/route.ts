import { json } from '@/lib/api'
import { adminRoute } from '@/lib/auth/session'
import { listCategories } from '@/lib/mahasamvad/wp'

export const GET = adminRoute(async () => json(await listCategories()))
