import { NextResponse } from 'next/server'
import { z } from 'zod'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/** Route handler wrapper: zod errors become 400s, anything else a logged 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status)
      if (err instanceof z.ZodError) {
        return fail(err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
      }
      console.error('[api]', err)
      return fail((err as Error).message || 'सर्व्हर त्रुटी', 500)
    }
  }
}

export async function idParam(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new HttpError('अवैध id', 404)
  return n
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableText = z.string().trim().max(5000).nullable().optional().transform((v) => (v === '' ? null : v))

export const BookPatch = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,79}$/, 'फक्त इंग्रजी अक्षरे, अंक आणि -')
    .optional(),
  subtitle: nullableText,
  kind: z.enum(['edition', 'themed', 'special']).optional(),
  editionDate: date.nullable().optional(),
  description: nullableText,
  coverImage: nullableText,
  coverStyle: z.object({ mode: z.enum(['auto', 'image']) }).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  publishAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export const ArticlePatch = z.object({
  title: z.string().trim().min(1).max(400).optional(),
  kicker: nullableText,
  dateline: nullableText,
  district: nullableText,
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  heroImage: nullableText,
  heroCredit: nullableText,
  contentHtml: z.string().max(400_000).optional(),
})
