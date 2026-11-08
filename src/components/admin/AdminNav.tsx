'use client'

import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'पुस्तके', match: (p: string) => p === '/admin' || p.startsWith('/admin/books') },
  { href: '/admin/articles', label: 'लेख', match: (p: string) => p.startsWith('/admin/articles') },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <nav className="ml-auto flex items-center gap-1 text-[14px]">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-md px-3 py-1.5 font-semibold transition ${l.match(path) ? 'bg-ink text-white' : 'text-ink-2 hover:bg-sunk'}`}
        >
          {l.label}
        </Link>
      ))}
      <Link href="/" className="ml-1 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted hover:bg-sunk hover:text-ink" target="_blank">
        <span className="hidden sm:inline">ग्रंथालय</span>
        <ExternalLink size={14} />
      </Link>
    </nav>
  )
}
