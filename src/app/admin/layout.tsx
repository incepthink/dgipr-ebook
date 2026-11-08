import Link from 'next/link'
import { AdminNav } from '@/components/admin/AdminNav'
import { ToastProvider } from '@/components/admin/ui'

export const metadata = { title: 'व्यवस्थापन' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-shell items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <img src="/emblem.png" alt="" className="h-8 w-8" />
            <div className="leading-tight">
              <div className="font-display text-[17px] text-ink">ई-पुस्तक व्यवस्थापन</div>
              <div className="hidden text-[11.5px] text-muted sm:block">माहिती व जनसंपर्क महासंचालनालय</div>
            </div>
          </Link>
          <AdminNav />
        </div>
      </header>
      <div className="mx-auto max-w-shell px-4 py-8 sm:px-6">
        <ToastProvider>{children}</ToastProvider>
      </div>
    </div>
  )
}
