'use client'

import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { BookStatus } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'

export function StatusBadge({ status, publishAt }: { status: BookStatus; publishAt?: string | null }) {
  const due = status === 'scheduled' && publishAt && new Date(publishAt) <= new Date()
  const cls =
    status === 'published' || due
      ? 'bg-ok-soft text-ok'
      : status === 'scheduled'
        ? 'bg-warn-soft text-warn'
        : 'bg-sunk text-muted'
  return (
    <span className={`chip ${cls}`}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {due ? STATUS_LABEL.published : STATUS_LABEL[status]}
    </span>
  )
}

/** Fetch JSON; a non-2xx response throws its `error` message. */
export async function api<T = unknown>(url: string, init?: RequestInit & { body?: BodyInit | null; json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data as T
}

/* ---------------------------------------------------------------- toasts */

type Toast = { id: number; text: string; tone: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={`pointer-events-auto max-w-[90vw] rounded-lg px-4 py-2.5 text-[14px] font-semibold shadow-lift ${t.tone === 'error' ? 'bg-brand text-white' : 'bg-ink text-white'}`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface shadow-card ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}
