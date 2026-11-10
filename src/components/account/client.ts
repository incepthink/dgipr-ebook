'use client'

/** JSON fetch for the account routes. Throws the server's Marathi message on failure. */
export async function call<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new Error('इंटरनेट जोडणी तपासा आणि पुन्हा प्रयत्न करा')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || 'काहीतरी चुकले. पुन्हा प्रयत्न करा.')
  return data as T
}

/** The first letter of a name, for the avatar circle (handles Devanagari clusters). */
export function initial(name: string | null | undefined): string {
  const s = (name ?? '').trim()
  if (!s) return '?'
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('mr', { granularity: 'grapheme' }) : null
  return seg ? ([...seg.segment(s)][0]?.segment ?? '?') : s[0]
}
