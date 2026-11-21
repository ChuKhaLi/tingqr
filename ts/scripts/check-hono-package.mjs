// Guards for @tingqr/hono (design 2026-11-21, section 5.3): depends only on @tingqr/core and @tingqr/render, hono is a
// peer, no node:* imports (Workers, Bun, Deno), the CJS build loads, LICENSE is the repository's, and the tarball fits.
// Run after `pnpm build`: node scripts/check-hono-package.mjs (from ts/).
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'hono')
// Measured 4 025 bytes on 2026-11-21; budget = measurement rounded up to 1 000, plus 25%.
const MAX_TARBALL_BYTES = 6_250

const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'))
const problems = []
const expect = (label, actual, wanted) => {
  if (JSON.stringify(actual ?? {}) !== JSON.stringify(wanted)) {
    problems.push(`${label} must be ${JSON.stringify(wanted)}, found ${JSON.stringify(actual)}`)
  }
}
expect('dependencies', pkg.dependencies, { '@tingqr/core': 'workspace:*', '@tingqr/render': 'workspace:*' })
expect('peerDependencies', pkg.peerDependencies, { hono: '^4.0.0' })
expect('optionalDependencies', pkg.optionalDependencies, {})

for (const file of ['index.js', 'index.cjs']) {
  const code = readFileSync(join(PKG, 'dist', file), 'utf8')
  if (/(from\s*|require\()\s*["']node:/.test(code)) problems.push(`dist/${file} imports a node:* module`)
}
const rootLicense = readFileSync(join(PKG, '..', '..', '..', 'LICENSE'), 'utf8')
let license = ''
try {
  license = readFileSync(join(PKG, 'LICENSE'), 'utf8')
} catch {}
if (license !== rootLicense) problems.push('packages/hono/LICENSE must be a copy of the repository LICENSE')

const require = createRequire(join(PKG, 'package.json'))
try {
  const mod = require('@tingqr/hono')
  for (const name of ['tingqr', 'tingqrSvg']) {
    if (typeof mod[name] !== 'function') problems.push(`require('@tingqr/hono').${name} is not a function`)
  }
} catch (e) {
  problems.push(`require('@tingqr/hono') failed: ${e.message}`)
}

const out = mkdtempSync(join(tmpdir(), 'tingqr-pack-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: PKG, stdio: 'ignore', shell: process.platform === 'win32' })
  const tarball = readdirSync(out).find((f) => f.endsWith('.tgz'))
  if (!tarball) {
    problems.push('pnpm pack produced no tarball')
  } else {
    const size = statSync(join(out, tarball)).size
    console.log(`@tingqr/hono tarball: ${size} bytes (budget ${MAX_TARBALL_BYTES})`)
    if (size > MAX_TARBALL_BYTES) problems.push(`tarball is ${size} bytes, over the ${MAX_TARBALL_BYTES}-byte budget`)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

if (problems.length) {
  for (const p of problems) console.error(`check-hono-package: ${p}`)
  process.exit(1)
}
console.log('check-hono-package: ok')
