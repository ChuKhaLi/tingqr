// Guards for @tingqr/render (design 2026-11-19, section 5.7): its only runtime dependency is @tingqr/core, no peer or
// optional dependencies, the CJS build loads, and the packed tarball fits the size budget.
// Run after `pnpm build`: node scripts/check-render-package.mjs (from ts/).
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RENDER = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'render')
// 30 000 until 2026-11-21; owner approved 33 000 for render/canvas (Plan 6), then 36 000 for a full README (Plan 7).
const MAX_TARBALL_BYTES = 36_000

const pkg = JSON.parse(readFileSync(join(RENDER, 'package.json'), 'utf8'))
const problems = []
const deps = pkg.dependencies ?? {}
if (JSON.stringify(deps) !== JSON.stringify({ '@tingqr/core': 'workspace:*' })) {
  problems.push(`dependencies must be exactly { "@tingqr/core": "workspace:*" }, found ${JSON.stringify(deps)}`)
}
for (const field of ['peerDependencies', 'optionalDependencies', 'bundleDependencies', 'bundledDependencies']) {
  const value = pkg[field]
  const count = Array.isArray(value) ? value.length : Object.keys(value ?? {}).length
  if (count > 0) problems.push(`${field} must be empty, found ${JSON.stringify(value)}`)
}
if (!pkg.files?.includes('NOTICE')) problems.push('"files" must include NOTICE (Nayuki attribution)')
// MIT: the Nayuki copyright notice must survive the build in every bundle (esbuild keeps only /*! or @license comments).
// The whole notice must survive, not only the copyright line: compare the permission text word by word.
const words = (t) => t.replace(/[*\s]+/g, ' ').trim()
const header = readFileSync(join(RENDER, 'src', 'qrcodegen.ts'), 'utf8')
const notice = words(header.slice(header.indexOf('Copyright (c) Project Nayuki'), header.indexOf('Software.') + 'Software.'.length))
if (!notice.includes('Permission is hereby granted')) problems.push('could not read the Nayuki notice from src/qrcodegen.ts')
// The ESM build splits the encoder into a shared chunk, so check every built file that carries encoder code.
const bundles = readdirSync(join(RENDER, 'dist')).filter((f) => /.(c?js)$/.test(f))
const withEncoder = bundles.filter((f) => readFileSync(join(RENDER, 'dist', f), 'utf8').includes('encodeSegments'))
if (!withEncoder.includes('index.cjs') || withEncoder.length < 2) problems.push(`encoder found only in ${JSON.stringify(withEncoder)}`)
for (const file of withEncoder) {
  if (!words(readFileSync(join(RENDER, 'dist', file), 'utf8')).includes(notice)) {
    problems.push(`dist/${file} lost the full Nayuki MIT notice`)
  }
}
const rootLicense = readFileSync(join(RENDER, '..', '..', '..', 'LICENSE'), 'utf8')
let packageLicense = ''
try {
  packageLicense = readFileSync(join(RENDER, 'LICENSE'), 'utf8')
} catch {}
if (packageLicense !== rootLicense) problems.push('packages/render/LICENSE must be a copy of the repository LICENSE (NOTICE refers to it)')

const require = createRequire(join(RENDER, 'package.json'))
try {
  const mod = require('@tingqr/render')
  for (const name of ['toMatrix', 'toSvg']) {
    if (typeof mod[name] !== 'function') problems.push(`require('@tingqr/render').${name} is not a function`)
  }
} catch (e) {
  problems.push(`require('@tingqr/render') failed: ${e.message}`)
}

const out = mkdtempSync(join(tmpdir(), 'tingqr-pack-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: RENDER, stdio: 'ignore', shell: process.platform === 'win32' })
  const tarball = readdirSync(out).find((f) => f.endsWith('.tgz'))
  if (!tarball) {
    problems.push('pnpm pack produced no tarball')
  } else {
    const size = statSync(join(out, tarball)).size
    console.log(`@tingqr/render tarball: ${size} bytes (budget ${MAX_TARBALL_BYTES})`)
    if (size > MAX_TARBALL_BYTES) problems.push(`tarball is ${size} bytes, over the ${MAX_TARBALL_BYTES}-byte budget`)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

if (problems.length) {
  for (const p of problems) console.error(`check-render-package: ${p}`)
  process.exit(1)
}
console.log('check-render-package: ok')
