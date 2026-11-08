/**
 * Start/stop the project-local Postgres cluster in ./.pgdata (port 5435).
 *
 *   npm run db:start   # initialises the cluster and database on first run
 *   npm run db:stop
 *
 * Uses the PostgreSQL binaries from PG_BIN, or the newest install under
 * "C:\Program Files\PostgreSQL", or whatever is on PATH.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const DATA = path.resolve('.pgdata')
const PORT = '5435'
const DB = 'dgipr_ebook'

function bin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  if (process.env.PG_BIN) return path.join(process.env.PG_BIN, exe)
  const root = 'C:\\Program Files\\PostgreSQL'
  if (process.platform === 'win32' && existsSync(root)) {
    const versions = readdirSync(root).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a))
    for (const v of versions) {
      const p = path.join(root, v, 'bin', exe)
      if (existsSync(p)) return p
    }
  }
  return exe
}

function run(name, args, opts = {}) {
  return execFileSync(bin(name), args, { stdio: 'inherit', ...opts })
}

const cmd = process.argv[2]
if (cmd === 'start') {
  if (!existsSync(path.join(DATA, 'PG_VERSION'))) {
    run('initdb', ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C'])
  }
  try {
    run('pg_ctl', ['-D', DATA, '-o', `-p ${PORT}`, '-l', path.join(DATA, 'server.log'), '-w', 'start'])
  } catch {
    console.log('(already running?)')
  }
  try {
    run('createdb', ['-h', 'localhost', '-p', PORT, '-U', 'postgres', DB], { stdio: 'pipe' })
    console.log(`created database ${DB}`)
  } catch {
    /* exists */
  }
} else if (cmd === 'stop') {
  run('pg_ctl', ['-D', DATA, '-m', 'fast', 'stop'])
} else {
  console.error('usage: node scripts/pg.mjs start|stop')
  process.exit(1)
}
