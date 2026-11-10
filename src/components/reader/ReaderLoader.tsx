'use client'

import dynamic from 'next/dynamic'
import type { Anchor } from '@/lib/paginate/types'
import type { ReaderBook } from '@/lib/types'
import type { ReaderAccount } from './Reader'

/** The reader measures real layout and drives the DOM directly: browser only. */
const Reader = dynamic(() => import('./Reader'), {
  ssr: false,
  loading: () => <div className="reader" />,
})

export function ReaderLoader(props: {
  data: ReaderBook
  preview: boolean
  initialPage: number | null
  initialAnchor?: Anchor | null
  initialMode?: 'text' | null
  initialFind?: string | null
  account?: ReaderAccount
}) {
  return <Reader {...props} />
}
