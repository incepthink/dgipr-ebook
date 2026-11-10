import type { Metadata } from 'next'
import { AccountShell } from '@/components/account/AccountShell'
import { ProfileForm } from '@/components/account/ProfileForm'
import { requireUserPage } from '@/lib/auth/guard'
import { publicUser } from '@/lib/auth/users'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'प्रोफाइल' }

export default async function ProfilePage() {
  const user = await requireUserPage('/profile')
  return (
    <AccountShell active="profile">
      <h1 className="acc-h1">प्रोफाइल</h1>
      <p className="acc-sub">आपली माहिती आणि आवडीनिवडी.</p>
      <ProfileForm user={publicUser(user)} />
    </AccountShell>
  )
}
