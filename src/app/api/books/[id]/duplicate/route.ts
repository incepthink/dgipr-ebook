import { fail, handle, idParam, json } from '@/lib/api'
import { duplicateBook } from '@/lib/db'

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const copy = await duplicateBook(await idParam(params))
  return copy ? json(copy, 201) : fail('पुस्तक सापडले नाही', 404)
})
