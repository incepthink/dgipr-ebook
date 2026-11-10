import { z } from 'zod'
import { idParam, json } from '@/lib/api'
import { adminRoute } from '@/lib/auth/session'
import { appendChapters, listChapters, setChapters } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

/** Replace the chapter list: the new order and section labels. */
export const PUT = adminRoute(async (req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const items = z
    .array(z.object({ articleId: z.number().int().positive(), sectionLabel: z.string().trim().max(120).nullable().optional() }))
    .max(500)
    .parse(await req.json())
  await setChapters(id, items)
  return json(await listChapters(id))
})

/** Append articles to the end of the book. */
export const POST = adminRoute(async (req: Request, { params }: Ctx) => {
  const id = await idParam(params)
  const { articleIds } = z.object({ articleIds: z.array(z.number().int().positive()).max(200) }).parse(await req.json())
  const added = await appendChapters(id, articleIds)
  return json({ added, chapters: await listChapters(id) })
})
