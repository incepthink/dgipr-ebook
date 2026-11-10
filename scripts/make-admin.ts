/**
 * Give (or take away) admin rights for the admin console (/admin).
 *
 * The person must have signed in once on the site, by mobile OTP or email,
 * so their account exists. Only someone with DATABASE_URL can run this, which
 * is the point: nobody can make themselves an admin from the website.
 *
 *   npm run make-admin -- 9876543210
 *   npm run make-admin -- officer@example.gov.in
 *   npm run make-admin -- officer@example.gov.in --revoke
 */
import { loadEnvConfig } from '@next/env'
import { normalizeEmail, normalizeMobile } from '../src/lib/auth/normalize'
import * as db from '../src/lib/db'

loadEnvConfig(process.cwd())

async function main() {
  const who = process.argv.slice(2).find((a) => !a.startsWith('--'))
  const revoke = process.argv.includes('--revoke')
  if (!who) {
    console.error('usage: npm run make-admin -- <mobile|email> [--revoke]')
    process.exit(1)
  }
  const mobile = normalizeMobile(who)
  const email = mobile ? null : normalizeEmail(who)
  if (!mobile && !email) {
    console.error(`"${who}" is neither a valid mobile number nor an email`)
    process.exit(1)
  }
  const rows = await db.query<{ id: number; name: string | null }>(
    `UPDATE users SET role = $1, updated_at = now() WHERE ${mobile ? 'mobile' : 'email'} = $2 RETURNING id, name`,
    [revoke ? 'reader' : 'admin', mobile ?? email],
  )
  if (!rows.length) {
    console.error(`No account for ${who}. Ask them to sign in on the site once, then run this again.`)
    process.exit(1)
  }
  console.log(`${rows[0].name ?? who} (#${rows[0].id}) is now ${revoke ? 'a reader' : 'an admin'}.`)
  await db.pool().end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
