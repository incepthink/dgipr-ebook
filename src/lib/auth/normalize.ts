/** Input clean-up shared by the browser and the server. */

const DEVANAGARI = '०१२३४५६७८९'

/** "+९१ ९८७६५ ४३२१०" → "9876543210". Null unless it is a valid Indian mobile number. */
export function normalizeMobile(input: string): string | null {
  const ascii = input.replace(/[०-९]/g, (d) => String(DEVANAGARI.indexOf(d)))
  let digits = ascii.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null
}

/** "98765 43210", for showing a number back to its owner. */
export const formatMobile = (m: string) => `${m.slice(0, 5)} ${m.slice(5)}`

/** Only same-site paths: never let `?next=` bounce a reader to another site. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (next.startsWith('/login') || next.startsWith('/api/')) return fallback
  return next
}
