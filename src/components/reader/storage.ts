'use client'

import type { Anchor } from '@/lib/paginate/types'
import { DEFAULT_FONT_STEP, FONT_STEPS } from '@/lib/paginate/layout'

export type Theme = 'day' | 'sepia' | 'night'

export interface Prefs {
  fontStep: number
  theme: Theme
  sound: boolean
  /** 'book' is the flipbook; 'text' the scrolling easy-reading view. */
  mode: 'book' | 'text'
  /** Read-aloud speed. */
  rate: number
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

/** A highlight sits inside one block: characters [start, end) of its text. */
export interface Highlight {
  id: string
  c: number
  b: number
  start: number
  end: number
  text: string
  color: HighlightColor
  note: string
  at: number
}

export interface Bookmark {
  anchor: Anchor
  label: string
  snippet: string
  at: number
}

/** Storage can be missing or throw (private mode, blocked site data). */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* not persisted, still works for this visit */
  }
}

export function loadPrefs(): Prefs {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  const p = read<Partial<Prefs>>('dgipr:prefs', {})
  const fontStep = Number.isInteger(p.fontStep) && p.fontStep! >= 0 && p.fontStep! < FONT_STEPS.length ? p.fontStep! : DEFAULT_FONT_STEP
  return {
    fontStep,
    theme: p.theme === 'sepia' || p.theme === 'night' ? p.theme : 'day',
    sound: typeof p.sound === 'boolean' ? p.sound : !coarse,
    mode: p.mode === 'text' ? 'text' : 'book',
    rate: typeof p.rate === 'number' && p.rate >= 0.6 && p.rate <= 1.6 ? p.rate : 1,
  }
}

export const savePrefs = (p: Prefs) => write('dgipr:prefs', p)

export const loadPosition = (slug: string) => read<Anchor | null>(`dgipr:pos:${slug}`, null)
export const savePosition = (slug: string, a: Anchor) => write(`dgipr:pos:${slug}`, a)

export const loadBookmarks = (slug: string) => read<Bookmark[]>(`dgipr:bm:${slug}`, [])
export const saveBookmarks = (slug: string, b: Bookmark[]) => write(`dgipr:bm:${slug}`, b)

export const loadHighlights = (slug: string) => read<Highlight[]>(`dgipr:hl:${slug}`, [])
export const saveHighlights = (slug: string, h: Highlight[]) => write(`dgipr:hl:${slug}`, h)
