import { handle, json } from '@/lib/api'
import { listCategories } from '@/lib/mahasamvad/wp'

export const GET = handle(async () => json(await listCategories()))
