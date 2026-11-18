// Guards for @tingqr/core (spec 3 and 5.9): no runtime, peer or optional dependencies, and a size budget for
// the packed tarball. Run after `pnpm build`: node scripts/check-core-package.mjs (from ts/).
import { execFileSync } from 'node:child_process'
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

if (problems.length) {
  for (const p of problems) console.error(`check-core-package: ${p}`)
  process.exit(1)
}
console.log('check-core-package: ok')
