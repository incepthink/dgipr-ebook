import { BookPatch, handle, json } from '@/lib/api'
import { createBook, listBooks, uniqueSlug } from '@/lib/db'
import { slugify } from '@/lib/slug'
import { todayIso } from '@/lib/marathi'
import { DEFAULT_ACCENT } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const GET = handle(async () => json(await listBooks()))

export const POST = handle(async (req: Request) => {
  const body = BookPatch.extend({ title: BookPatch.shape.title.unwrap() }).parse(await req.json())
  const kind = body.kind ?? 'edition'
  const editionDate = body.editionDate ?? todayIso()
  const slug = await uniqueSlug(body.slug || slugify(body.title, { kind, date: editionDate }))
  const book = await createBook({
    ...body,
    kind,
    editionDate,
    slug,
    accentColor: body.accentColor ?? DEFAULT_ACCENT,
    status: body.status ?? 'draft',
  })
  return json(book, 201)
})
