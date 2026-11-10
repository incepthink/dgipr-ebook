import { redirect } from 'next/navigation'
import { getSessionUser } from './session'
import type { User } from './users'

/** For server pages: send guests to sign in, then back here. */
export async function requireUserPage(next: string): Promise<User> {
  const user = await getSessionUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  return user
}

/**
 * For the admin console's server pages. Each page calls this itself: a layout
 * is not re-rendered on client navigation, so it cannot be the only lock.
 */
export async function requireAdminPage(next = '/admin'): Promise<User> {
  const user = await requireUserPage(next)
  if (user.role !== 'admin') redirect('/?denied=admin')
  return user
}
