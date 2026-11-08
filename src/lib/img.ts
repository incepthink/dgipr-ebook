/**
 * Photos come from mahasamvad.in at camera resolution. Route them through
 * Next's optimiser: smaller, cached, same-origin (no hotlink or mixed-content
 * surprises). Local uploads are served as they are.
 */
export function img(url: string | null | undefined, width: 384 | 640 | 828 | 1080 | 1200 | 1920 = 1080): string {
  if (!url) return ''
  if (url.startsWith('/')) return url
  return `/_next/image?url=${encodeURIComponent(url.replace(/^http:\/\//, 'https://'))}&w=${width}&q=74`
}
