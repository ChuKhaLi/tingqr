// Guards for @tingqr/core (spec 3 and 5.9): no runtime, peer or optional dependencies, and a size budget for
// the packed tarball. Run after `pnpm build`: node scripts/check-core-package.mjs (from ts/).
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'core')
const MAX_TARBALL_BYTES = 40_000

const pkg = JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8'))
const problems = []
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies', 'bundledDependencies']) {
  const value = pkg[field]
  const count = Array.isArray(value) ? value.length : Object.keys(value ?? {}).length
  if (count > 0) problems.push(`${field} must be empty, found ${JSON.stringify(value)}`)
}

const out = mkdtempSync(join(tmpdir(), 'tingqr-pack-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: CORE, stdio: 'ignore', shell: process.platform === 'win32' })
  const tarball = readdirSync(out).find((f) => f.endsWith('.tgz'))
  if (!tarball) {
    problems.push('pnpm pack produced no tarball')
  } else {
    const size = statSync(join(out, tarball)).size
    console.log(`@tingqr/core tarball: ${size} bytes (budget ${MAX_TARBALL_BYTES})`)
    if (size > MAX_TARBALL_BYTES) problems.push(`tarball is ${size} bytes, over the ${MAX_TARBALL_BYTES}-byte budget`)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

// CommonJS: each subpath must load and expose its functions, and the shared EMV layer must exist once (subpaths
// re-export index.cjs instead of bundling their own copy, which would multiply the package size).
const require = createRequire(join(CORE, 'package.json'))
const SUBPATHS = {
  '@tingqr/core': ['detect', 'decodeVietQr', 'decodeVnpayQr', 'decodePromptPayQr', 'decodeKhqr', 'crc16'],
  '@tingqr/core/vietqr': ['encodeVietQr', 'decodeVietQr'],
  '@tingqr/core/vnpay': ['decodeVnpayQr'],
  '@tingqr/core/promptpay': ['encodePromptPayQr', 'decodePromptPayQr'],
  '@tingqr/core/khqr': ['encodeKhqr', 'decodeKhqr', 'isKhqrExpired'],
}
for (const [id, names] of Object.entries(SUBPATHS)) {
  let mod
  try {
    mod = require(id)
  } catch (e) {
    problems.push(`require('${id}') failed: ${e.message}`)
    continue
  }
  for (const name of names) {
    if (typeof mod[name] !== 'function') problems.push(`require('${id}').${name} is not a function`)
  }
}
const dist = join(CORE, 'dist')
const crcCopies = readdirSync(dist)
  .filter((f) => f.endsWith('.cjs'))
  .filter((f) => readFileSync(join(dist, f), 'utf8').includes('function crc16('))
if (crcCopies.length !== 1) problems.push(`the EMV layer is bundled into ${crcCopies.length} CJS files (${crcCopies.join(', ')}); expected 1`)

if (problems.length) {
  for (const p of problems) console.error(`check-core-package: ${p}`)
  process.exit(1)
}
console.log('check-core-package: ok')
