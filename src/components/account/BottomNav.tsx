'use client'

import { BookMarked, Home, LogIn, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Phone-only tab bar (hidden above 640px by CSS). Three tabs, so labels never crowd. */
export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname()
  const items = [
    { href: '/', label: 'मुख्यपृष्ठ', icon: Home, on: path === '/' },
    { href: '/my-library', label: 'माझे ग्रंथालय', icon: BookMarked, on: path.startsWith('/my-library') },
    signedIn
      ? { href: '/profile', label: 'प्रोफाइल', icon: UserRound, on: path.startsWith('/profile') }
      : { href: `/login?next=${encodeURIComponent(path)}`, label: 'प्रवेश करा', icon: LogIn, on: false },
  ]
  return (
    <nav className="bnav" aria-label="मुख्य दिशादर्शन">
      {items.map(({ href, label, icon: Icon, on }) => (
        <Link key={label} href={href} aria-current={on ? 'page' : undefined}>
          <Icon size={24} strokeWidth={1.8} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  )
}
