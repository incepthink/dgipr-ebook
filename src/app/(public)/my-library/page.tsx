import type { Metadata } from 'next'
import { AccountShell } from '@/components/account/AccountShell'
import { MyLibrary } from '@/components/account/MyLibrary'
import { requireUserPage } from '@/lib/auth/guard'
import { myLibrary } from '@/lib/reading'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'माझे ग्रंथालय' }

export default async function MyLibraryPage() {
  const user = await requireUserPage('/my-library')
  const data = await myLibrary(user.id)
  return (
    <AccountShell active="library">
      <MyLibrary data={data} name={user.name} />
    </AccountShell>
  )
}
