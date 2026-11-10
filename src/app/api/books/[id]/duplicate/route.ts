import { fail, idParam, json } from '@/lib/api'
import { adminRoute } from '@/lib/auth/session'
import { duplicateBook } from '@/lib/db'

export const POST = adminRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const copy = await duplicateBook(await idParam(params))
  return copy ? json(copy, 201) : fail('पुस्तक सापडले नाही', 404)
})
