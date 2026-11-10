import { query } from '@/lib/db'

export type Role = 'reader' | 'admin'

export interface User {
  id: number
  mobile: string | null
  email: string | null
  name: string | null
  district: string | null
  interests: string[]
  notify: boolean
  role: Role
  hasPassword: boolean
  avatarUrl: string | null
  viaGoogle: boolean
  createdAt: string
}

/** What the browser may see about the signed-in reader. */
export type PublicUser = Omit<User, 'hasPassword'>

type Row = Record<string, unknown>

export function toUser(r: Row): User {
  return {
    id: Number(r.id),
    mobile: (r.mobile as string) ?? null,
    email: (r.email as string) ?? null,
    name: (r.name as string) ?? null,
    district: (r.district as string) ?? null,
    interests: (r.interests as string[]) ?? [],
    notify: r.notify !== false,
    role: r.role === 'admin' ? 'admin' : 'reader',
    hasPassword: !!r.password_hash,
    avatarUrl: (r.avatar_url as string) ?? null,
    viaGoogle: !!r.google_sub,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }
}

export function publicUser(u: User): PublicUser {
  const { hasPassword: _drop, ...rest } = u
  void _drop
  return rest
}

export async function findUserByMobile(mobile: string): Promise<User | null> {
  const [r] = await query('SELECT * FROM users WHERE mobile = $1', [mobile])
  return r ? toUser(r) : null
}

/** Includes the password hash, for the email sign-in check only. */
export async function findUserByEmailWithHash(email: string): Promise<{ user: User; hash: string | null } | null> {
  const [r] = await query('SELECT * FROM users WHERE email = $1', [email])
  return r ? { user: toUser(r), hash: (r.password_hash as string) ?? null } : null
}

export async function createUser(input: { mobile?: string; email?: string; passwordHash?: string; name?: string }): Promise<User> {
  const [r] = await query(
    `INSERT INTO users (mobile, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.mobile ?? null, input.email ?? null, input.passwordHash ?? null, input.name ?? null],
  )
  return toUser(r)
}

export interface GoogleProfile {
  sub: string
  email: string
  name: string | null
  picture: string | null
}

/**
 * The account for a Google sign-in: the one already linked to this Google id,
 * else the one with the same email (now linked), else a new one. Google has
 * verified the email, so the caller must only pass verified addresses.
 */
export async function signInWithGoogle(g: GoogleProfile): Promise<{ user: User; isNew: boolean }> {
  const [linked] = await query('SELECT * FROM users WHERE google_sub = $1', [g.sub])
  if (linked) {
    const [r] = await query(
      `UPDATE users SET avatar_url = coalesce($2, avatar_url), name = coalesce(name, $3), updated_at = now() WHERE id = $1 RETURNING *`,
      [linked.id, g.picture, g.name],
    )
    return { user: toUser(r), isNew: false }
  }
  const [byEmail] = await query('SELECT * FROM users WHERE email = $1', [g.email])
  if (byEmail) {
    // Email sign-up never proved the address belonged to whoever chose that
    // password; Google just proved it belongs to this person. Drop the old
    // password so a squatter who registered the address first is locked out.
    const [r] = await query(
      `UPDATE users SET google_sub = $2, avatar_url = $3, name = coalesce(name, $4), password_hash = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [byEmail.id, g.sub, g.picture, g.name],
    )
    return { user: toUser(r), isNew: false }
  }
  const [r] = await query(`INSERT INTO users (email, google_sub, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *`, [
    g.email,
    g.sub,
    g.name,
    g.picture,
  ])
  return { user: toUser(r), isNew: true }
}

export interface ProfilePatch {
  name?: string
  district?: string | null
  interests?: string[]
  notify?: boolean
}

export async function updateProfile(id: number, p: ProfilePatch): Promise<User | null> {
  const sets: string[] = []
  const vals: unknown[] = []
  const add = (col: string, v: unknown) => {
    vals.push(v)
    sets.push(`${col} = $${vals.length}`)
  }
  if (p.name !== undefined) add('name', p.name)
  if (p.district !== undefined) add('district', p.district)
  if (p.interests !== undefined) add('interests', p.interests)
  if (p.notify !== undefined) add('notify', p.notify)
  if (!sets.length) {
    const [r] = await query('SELECT * FROM users WHERE id = $1', [id])
    return r ? toUser(r) : null
  }
  vals.push(id)
  const [r] = await query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals)
  return r ? toUser(r) : null
}

/** Removes the account and, by cascade, its sessions, progress, bookmarks and saved books. */
export async function deleteUser(id: number): Promise<void> {
  await query('DELETE FROM users WHERE id = $1', [id])
}
