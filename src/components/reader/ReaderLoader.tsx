'use client'

import dynamic from 'next/dynamic'
import type { ReaderBook } from '@/lib/types'

/** The reader measures real layout and drives the DOM directly: browser only. */
const Reader = dynamic(() => import('./Reader'), {
  ssr: false,
  loading: () => <div className="reader" />,
})

export function ReaderLoader(props: { data: ReaderBook; preview: boolean; initialPage: number | null }) {
  return <Reader {...props} />
}
