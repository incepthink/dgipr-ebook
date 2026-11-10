import { Plus } from 'lucide-react'
import Link from 'next/link'
import { BooksTable } from '@/components/admin/BooksTable'
import { requireAdminPage } from '@/lib/auth/guard'
import { listBooks } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  await requireAdminPage('/admin')
  const books = await listBooks()
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-tight text-ink">पुस्तके</h1>
          <p className="mt-1 text-[14px] text-muted">आवृत्त्या, विशेषांक आणि विषयवार संग्रह — तयार करा, लेख जोडा, प्रकाशित करा.</p>
        </div>
        <Link href="/admin/books/new" className="btn-primary">
          <Plus size={16} /> नवे पुस्तक
        </Link>
      </div>
      <BooksTable initial={books} />
    </>
  )
}
