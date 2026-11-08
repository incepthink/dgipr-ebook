import type { Anchor, Page } from './types'

export function compareAnchors(a: Anchor, b: Anchor): number {
  return a.c - b.c || a.b - b.b || a.o - b.o
}

/** The page holding this anchor: the last page that starts at or before it. */
export function pageForAnchor(pages: Page[], a: Anchor): number {
  let lo = 0
  let hi = pages.length - 1
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (compareAnchors(pages[mid].anchor, a) <= 0) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

export function encodeAnchor(a: Anchor): string {
  return `${a.c}.${a.b}.${a.o}`
}

export function decodeAnchor(s: string | null | undefined): Anchor | null {
  if (!s) return null
  const m = s.match(/^(-?\d+)\.(-?\d+)\.(-?\d+)$/)
  return m ? { c: Number(m[1]), b: Number(m[2]), o: Number(m[3]) } : null
}
