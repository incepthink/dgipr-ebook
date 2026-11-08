/**
 * Run a command with Node trusting the operating system's certificate store.
 *
 * Node ships its own baked-in CA list and ignores the OS one, so on any machine
 * where TLS is intercepted — corporate proxy, antivirus HTTPS scanning — every
 * outbound HTTPS call from the server dies with SELF_SIGNED_CERT_IN_CHAIN. The
 * OpenAI SDK reports that as a bare "Connection error.", which is why extraction
 * and summaries fail while curl and the browser work fine.
 *
 * Set as a NODE_OPTIONS prefix here rather than inline in the npm script,
 * because npm runs scripts through cmd.exe on Windows, where `VAR=x cmd` is not
 * a thing.
 *
 *   node scripts/with-system-ca.mjs next dev
 */
import { spawn } from 'node:child_process'

const FLAG = '--use-system-ca'
const [cmd, ...args] = process.argv.slice(2)

if (!cmd) {
  console.error('usage: node scripts/with-system-ca.mjs <command> [args...]')
  process.exit(1)
}

const existing = process.env.NODE_OPTIONS ?? ''
const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: existing.includes(FLAG) ? existing : `${existing} ${FLAG}`.trim(),
  },
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
