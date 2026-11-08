import type { Geometry, Layout } from './types'

/** Font size multipliers for A− / A+. Index 2 is the default. */
export const FONT_STEPS = [0.86, 0.93, 1, 1.09, 1.19, 1.3]
export const DEFAULT_FONT_STEP = 2

/** Chrome height reserved on desktop; on phones the bars overlay the page and auto-hide. */
const BAR_TOP = 56
const BAR_BOTTOM = 64

/**
 * The book's page size for this viewport. Two-page spreads need room for two
 * readable pages side by side; otherwise one page fills the screen.
 */
export function computeLayout(vw: number, vh: number): Layout {
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2)
  const wide = vw >= 900
  if (wide) {
    const availW = vw - 72
    const availH = vh - BAR_TOP - BAR_BOTTOM - 40
    const ratio = 0.7
    let pageH = Math.min(availH, availW / 2 / ratio, 1180)
    let pageW = pageH * ratio
    if (pageW >= 330) {
      pageW = even(pageW)
      pageH = even(pageW / ratio)
      return { mode: 'spread', pageW, pageH }
    }
  }
  const small = vw < 640
  const availW = vw - (small ? 12 : 48)
  const availH = vh - (small ? 16 : BAR_TOP + BAR_BOTTOM + 32)
  const ratio = Math.min(0.76, Math.max(0.56, availW / availH))
  let pageW = Math.min(availW, availH * ratio, 760)
  let pageH = pageW / ratio
  pageW = even(pageW)
  pageH = even(Math.min(pageH, availH))
  return { mode: 'single', pageW, pageH }
}

export function computeGeometry(layout: Layout, fontStep: number): Geometry {
  const { pageW, pageH, mode } = layout
  const base = Math.min(19.5, Math.max(14.5, pageW / (mode === 'spread' ? 27.5 : 24)))
  const fs = Math.round(base * (FONT_STEPS[fontStep] ?? 1) * 10) / 10
  const padX = Math.round(Math.max(18, pageW * (pageW < 420 ? 0.075 : 0.095)))
  const padT = Math.round(Math.max(34, pageH * 0.072))
  const padB = Math.round(Math.max(34, pageH * 0.07))
  return { fs, padX, padT, padB, bodyW: pageW - 2 * padX, bodyH: pageH - padT - padB }
}

export function layoutKey(l: Layout): string {
  return `${l.mode}:${l.pageW}x${l.pageH}`
}
