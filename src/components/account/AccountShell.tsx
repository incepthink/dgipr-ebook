import { BookMarked, BookOpen, Home, UserRound } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'

/** Frame for "My Library" and the profile: slim bar, content, phone tab bar. */
export function AccountShell({ active, children }: { active: 'library' | 'profile'; children: ReactNode }) {
  return (
    <div className="acc has-bnav">
      <header className="acc-bar">
        <div className="acc-bar-in">
          <Link href="/" className="lib-brand" style={{ marginRight: 0 }}>
            <span className="lib-brand-mark">
              <BookOpen size={20} strokeWidth={1.8} aria-hidden />
            </span>
            <span className="lib-brand-name">महासंवाद ई-पुस्तके</span>
          </Link>
          <nav className="acc-nav" aria-label="खाते">
            <Link href="/">
              <Home size={18} aria-hidden /> मुख्यपृष्ठ
            </Link>
            <Link href="/my-library" aria-current={active === 'library' ? 'page' : undefined}>
              <BookMarked size={18} aria-hidden /> माझे ग्रंथालय
            </Link>
            <Link href="/profile" aria-current={active === 'profile' ? 'page' : undefined}>
              <UserRound size={18} aria-hidden /> प्रोफाइल
            </Link>
          </nav>
        </div>
      </header>
      <main className="acc-main">{children}</main>
      <footer className="lib-foot">
        <div className="lib-shell lib-foot-in">
          <span>© महाराष्ट्र शासन · माहिती व जनसंपर्क महासंचालनालय</span>
          <a href="https://mahasamvad.in" target="_blank" rel="noreferrer">
            mahasamvad.in
          </a>
        </div>
      </footer>
      <BottomNav signedIn />
    </div>
  )
}
