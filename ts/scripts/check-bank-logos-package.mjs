// Guards for @tingqr/bank-logos (design 2026-11-20, section 5.4): no dependencies, the trademark notice and the MIT
// LICENSE ship in the tarball, and the packed tarball fits its size budget.
// Run after `pnpm build`: node scripts/check-bank-logos-package.mjs (from ts/).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'bank-logos')
// Measured 1 815 147 bytes on 2026-11-21, × 1.25 (owner accepted ~1.84 MB for lossless 128 px logos plus original icons).
const MAX_TARBALL_BYTES = 2_270_000

const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'))
const problems = []
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies', 'bundledDependencies']) {
  const value = pkg[field]
  const count = Array.isArray(value) ? value.length : Object.keys(value ?? {}).length
  if (count > 0) problems.push(`${field} must be empty, found ${JSON.stringify(value)}`)
}
if (pkg.license === 'MIT') problems.push('license must not be "MIT": the images are trademarks (see LOGOS-NOTICE.md)')
let license = ''
try {
  license = readFileSync(join(PKG, 'LICENSE'), 'utf8')
} catch {}
if (license !== readFileSync(join(PKG, '..', '..', '..', 'LICENSE'), 'utf8')) problems.push('packages/bank-logos/LICENSE must be a copy of the repository LICENSE')

const out = mkdtempSync(join(tmpdir(), 'tingqr-pack-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: PKG, stdio: 'ignore', shell: process.platform === 'win32' })
  const tarball = readdirSync(out).find((f) => f.endsWith('.tgz'))
  if (!tarball) {
    problems.push('pnpm pack produced no tarball')
  } else {
    const size = statSync(join(out, tarball)).size
    console.log(`@tingqr/bank-logos tarball: ${size} bytes (budget ${MAX_TARBALL_BYTES})`)
    if (size > MAX_TARBALL_BYTES) problems.push(`tarball is ${size} bytes, over the ${MAX_TARBALL_BYTES}-byte budget`)
    // Windows' tar.exe ends each line with CRLF; split on both so exact matches below work on every OS.
    const listing = execFileSync('tar', ['-tzf', tarball], { cwd: out, encoding: 'utf8' }).split(/\r?\n/)
    for (const need of ['package/LICENSE', 'package/LOGOS-NOTICE.md', 'package/README.md', 'package/dist/index.js']) {
      if (!listing.includes(need)) problems.push(`tarball lacks ${need}`)
    }
    if (!listing.some((f) => f.startsWith('package/files/icon/'))) problems.push('tarball lacks files/icon/')
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

if (problems.length) {
  for (const p of problems) console.error(`check-bank-logos-package: ${p}`)
  process.exit(1)
}
console.log('check-bank-logos-package: ok')
