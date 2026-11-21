// Guards for @tingqr/angular (design 2026-11-21, section 5.2): the package is packed from ng-packagr's dist/ (Angular
// Package Format, partial compilation), Angular is a peer (>=20.0.0), the packed manifest has no workspace: ranges,
// LICENSE is the repository's, and the tarball fits the budget.
// Run after `pnpm build`: node scripts/check-angular-package.mjs (from ts/).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'angular')
// Measured 7 288 bytes on 2026-11-21; budget = measurement rounded up to 1 000, plus 25%.
const MAX_TARBALL_BYTES = 10_000
const ANGULAR_PEERS = { '@angular/common': '>=20.0.0', '@angular/core': '>=20.0.0', '@angular/platform-browser': '>=20.0.0' }

const problems = []
const dist = join(PKG, 'dist')
const fesm = join(dist, 'fesm2022', 'tingqr-angular.mjs')
if (!existsSync(fesm)) problems.push('dist/fesm2022/tingqr-angular.mjs is missing (run pnpm build)')
else if (!readFileSync(fesm, 'utf8').includes('ɵɵngDeclareComponent')) problems.push('the build is not partially compiled')

const rootLicense = readFileSync(join(PKG, '..', '..', '..', 'LICENSE'), 'utf8')
for (const where of [PKG, dist]) {
  let license = ''
  try {
    license = readFileSync(join(where, 'LICENSE'), 'utf8')
  } catch {}
  if (license !== rootLicense) problems.push(`${where === PKG ? '' : 'dist/'}LICENSE must be a copy of the repository LICENSE`)
}

const out = mkdtempSync(join(tmpdir(), 'tingqr-pack-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: PKG, stdio: 'ignore', shell: process.platform === 'win32' })
  const tarball = readdirSync(out).find((f) => f.endsWith('.tgz'))
  if (!tarball) {
    problems.push('pnpm pack produced no tarball')
  } else {
    const size = statSync(join(out, tarball)).size
    console.log(`@tingqr/angular tarball: ${size} bytes (budget ${MAX_TARBALL_BYTES})`)
    if (size > MAX_TARBALL_BYTES) problems.push(`tarball is ${size} bytes, over the ${MAX_TARBALL_BYTES}-byte budget`)
    execFileSync('tar', ['-xzf', tarball], { cwd: out })
    const packed = JSON.parse(readFileSync(join(out, 'package', 'package.json'), 'utf8'))
    for (const [name, range] of Object.entries(ANGULAR_PEERS)) {
      if (packed.peerDependencies?.[name] !== range) problems.push(`packed peerDependencies["${name}"] must be "${range}"`)
    }
    if (JSON.stringify(packed).includes('workspace:')) problems.push('the packed package.json still has workspace: ranges')
    for (const file of ['fesm2022/tingqr-angular.mjs', 'index.d.ts', 'LICENSE', 'README.md']) {
      if (!existsSync(join(out, 'package', file))) problems.push(`the tarball has no ${file}`)
    }
    if (existsSync(join(out, 'package', 'src'))) problems.push('the tarball contains src/ (packed from the wrong directory)')
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

if (problems.length) {
  for (const p of problems) console.error(`check-angular-package: ${p}`)
  process.exit(1)
}
console.log('check-angular-package: ok')
