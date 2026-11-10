import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

/** `scrypt$<salt>$<hash>`, both base64url. Node's built-in scrypt: no native addon to install. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password.normalize('NFKC'), salt, 64)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = await scryptAsync(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length)
  return timingSafeEqual(actual, expected)
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export const newToken = () => randomBytes(32).toString('base64url')


export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && timingSafeEqual(x, y)
}
