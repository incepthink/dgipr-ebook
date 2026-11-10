'use client'

import type { Anchor } from '@/lib/paginate/types'
import type { Bookmark, Highlight } from './storage'

/**
 * Sends a signed-in reader's place and bookmarks to their account, so they
 * follow them to other devices. Debounced: page turns come quickly. Failures
 * are quiet; localStorage still has everything, and the next turn retries.
 */
export function createSync(bookId: number) {
  let progressTimer: ReturnType<typeof setTimeout> | undefined
  let marksTimer: ReturnType<typeof setTimeout> | undefined
  let hlTimer: ReturnType<typeof setTimeout> | undefined
  let pending: string | null = null

  const post = (url: string, method: string, body: string, keepalive = false) =>
    fetch(url, { method, headers: { 'content-type': 'application/json' }, body, keepalive, credentials: 'same-origin' }).catch(() => {})

  function flush(keepalive = false) {
    clearTimeout(progressTimer)
    if (!pending) return
    const body = pending
    pending = null
    void post('/api/me/progress', 'POST', body, keepalive)
  }

  return {
    progress(p: { anchor: Anchor; page: number; pageCount: number; finished: boolean }) {
      pending = JSON.stringify({ bookId, ...p })
      clearTimeout(progressTimer)
      progressTimer = setTimeout(() => flush(), 1500)
    },
    bookmarks(marks: Bookmark[]) {
      clearTimeout(marksTimer)
      const body = JSON.stringify({ bookId, marks: marks.map(({ anchor, label, snippet, at }) => ({ anchor, label, snippet, at })) })
      marksTimer = setTimeout(() => void post('/api/me/bookmarks', 'PUT', body), 600)
    },
    highlights(list: Highlight[]) {
      clearTimeout(hlTimer)
      const body = JSON.stringify({ bookId, highlights: list })
      hlTimer = setTimeout(() => void post('/api/me/highlights', 'PUT', body), 800)
    },
    /** On tab hide or leaving the book: send the last place now. */
    flush,
  }
}

/** Highlights made on this device as a guest join the account's own. */
export function mergeHighlights(local: Highlight[], server: Highlight[]): Highlight[] {
  const byId = new Map<string, Highlight>()
  for (const h of [...local, ...server]) byId.set(h.id, h)
  return [...byId.values()].sort((a, b) => a.at - b.at)
}

const key = (a: Anchor) => `${a.c}.${a.b}.${a.o}`

/** Bookmarks made on this device as a guest join the account's own, without doubles. */
export function mergeBookmarks(local: Bookmark[], server: Bookmark[]): Bookmark[] {
  const seen = new Set<string>()
  const out: Bookmark[] = []
  for (const b of [...server, ...local]) {
    const k = key(b.anchor)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(b)
  }
  return out.sort((a, b) => a.at - b.at)
}
