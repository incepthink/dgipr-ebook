import { z } from 'zod'
import { handle, idParam, json } from '@/lib/api'
import { appendChapters, listChapters, setChapters } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

/** Replace the chapter list: the new order and section labels. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const items = z
    .array(z.object({ articleId: z.number().int().positive(), sectionLabel: z.string().trim().max(120).nullable().optional() }))
    .max(500)
    .parse(await req.json())
  await setChapters(id, items)
  return json(await listChapters(id))
})

/** Append articles to the end of the book. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const { articleIds } = z.object({ articleIds: z.array(z.number().int().positive()).max(200) }).parse(await req.json())
  const added = await appendChapters(id, articleIds)
  return json({ added, chapters: await listChapters(id) })
})
