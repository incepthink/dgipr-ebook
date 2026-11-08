import { BookPatch, fail, handle, idParam, json } from '@/lib/api'
import { deleteBook, getBook, listChapters, slugExists, updateBook } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const book = await getBook(id)
  if (!book) return fail('पुस्तक सापडले नाही', 404)
  return json({ book, chapters: await listChapters(id) })
})

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const patch = BookPatch.parse(await req.json())
  if (patch.slug && (await slugExists(patch.slug, id))) return fail('ही लिंक (slug) आधीच वापरात आहे', 409)
  if (patch.status === 'scheduled' && !patch.publishAt) {
    const current = await getBook(id)
    if (!current?.publishAt) return fail('नियोजित प्रकाशनासाठी दिनांक व वेळ द्या')
  }
  const book = await updateBook(id, patch)
  if (!book) return fail('पुस्तक सापडले नाही', 404)
  return json(book)
})

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await deleteBook(await idParam(params))
  return json({ ok: true })
})
