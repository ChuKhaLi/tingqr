// Release drill: build and pack the six @tingqr packages, install the tarballs into a fresh directory that shares
// nothing with this repo, and use the INSTALLED packages the way a consumer would.
// Usage (from the repo root): node .claude/skills/release-drill/scripts/drill.mjs [--out <dir>]
//   --out <dir>            copy the six tarballs there (the files a release publishes)
//   KEEP_DRILL_ARTIFACTS=1 keep the temp directory even when every check passes
// Calls the npm registry (installs hono, NestJS and Angular as peers).
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const PACKAGES = ['core', 'render', 'bank-logos', 'hono', 'nestjs', 'angular'] // publish order
const PEERS = [
  'hono@^4',
  '@nestjs/common@^12',
  '@nestjs/core@^12',
  '@nestjs/platform-express@^12',
  'rxjs@^7',
  'reflect-metadata@^0.2',
  '@angular/core@^20',
  '@angular/common@^20',
  '@angular/compiler@^20',
  '@angular/platform-browser@^20',
  '@angular/platform-server@^20',
]
const WIN = process.platform === 'win32'

const outIndex = process.argv.indexOf('--out')
const outDir = outIndex === -1 ? undefined : resolve(process.argv[outIndex + 1] ?? '')

const work = mkdtempSync(join(tmpdir(), 'tingqr-drill-'))
const packDir = join(work, 'tarballs')
const app = join(work, 'app')
mkdirSync(packDir)
mkdirSync(app)
const results = []

function sh(cmd, args, cwd, label) {
  // pnpm and npm are .cmd shims on Windows and need a shell; node itself must not go through one (its path has spaces).
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: WIN && cmd !== process.execPath, maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status}):\n${(r.stdout ?? '').slice(-3000)}\n${(r.stderr ?? '').slice(-3000)}`)
  }
  return r.stdout
}

function check(name, fn) {
  try {
    const detail = fn()
    results.push({ name, ok: true, detail })
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) })
  }
}

/** Run an ES module (or .cjs) written into the app directory, with the installed packages only. */
function runInApp(file, code) {
  writeFileSync(join(app, file), code)
  return sh(process.execPath, [file], app, file).trim()
}

const vector = JSON.parse(readFileSync(join(ROOT, 'conformance', 'vectors', 'vietqr', 'vietqr-dynamic-amount-purpose.json'), 'utf8'))
const contract = JSON.parse(readFileSync(join(ROOT, 'conformance', 'http', 'svg-response.json'), 'utf8'))
writeFileSync(join(work, 'expected.json'), JSON.stringify({ vector, headers: contract.success.headers }))

let fatal
try {
  // 1. Build and pack, as a release does.
  sh('pnpm', ['-C', 'ts', 'build'], ROOT, 'pnpm build')
  for (const p of PACKAGES) sh('pnpm', ['pack', '--pack-destination', packDir], join(ROOT, 'ts', 'packages', p), `pnpm pack ${p}`)
  const tarballs = readdirSync(packDir).filter((f) => f.endsWith('.tgz'))
  const tarballOf = (p) => {
    const t = tarballs.find((f) => f.startsWith(`tingqr-${p}-`))
    if (!t) throw new Error(`no tarball for ${p}`)
    return join(packDir, t)
  }

  check('1. tarballs: no src/ or test/, LICENSE and README.md present, no workspace: ranges', () => {
    const problems = []
    for (const p of PACKAGES) {
      // A bare file name, run inside packDir: GNU tar (Git for Windows) reads 'C:' in an archive path as a remote host.
      const tgz = basename(tarballOf(p))
      // Windows tar prints CRLF line endings.
      const files = sh('tar', ['-tzf', tgz], packDir, `tar -t ${p}`).split(/\r?\n/).filter(Boolean)
      if (files.some((f) => /^package\/(src|test)\//.test(f))) problems.push(`${p}: contains src/ or test/`)
      for (const need of ['package/LICENSE', 'package/README.md', 'package/package.json']) {
        if (!files.includes(need)) problems.push(`${p}: no ${need.slice(8)}`)
      }
      const x = join(work, `x-${p}`)
      mkdirSync(x)
      sh('tar', ['-xzf', tgz, '-C', `../x-${p}`, 'package/package.json'], packDir, `tar -x ${p}`)
      if (readFileSync(join(x, 'package', 'package.json'), 'utf8').includes('workspace:')) problems.push(`${p}: package.json still has workspace:`)
    }
    if (problems.length) throw new Error(problems.join('; '))
    return `${PACKAGES.length} tarballs`
  })

  // 2. Install into a directory that shares nothing with the repo.
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'tingqr-drill-app', private: true, type: 'module' }, null, 2))
  sh('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...PACKAGES.map(tarballOf), ...PEERS], app, 'npm install')

  check('2. ESM import of the six packages', () =>
    runInApp(
      'esm.mjs',
      `// An Angular app links partially compiled libraries at build time (Angular CLI); in plain Node the JIT compiler does it.
import '@angular/compiler'
const names = ['@tingqr/core', '@tingqr/core/banks', '@tingqr/render', '@tingqr/render/canvas', '@tingqr/bank-logos', '@tingqr/hono', '@tingqr/nestjs', '@tingqr/angular']
for (const n of names) { const m = await import(n); if (Object.keys(m).length === 0) throw new Error(n + ' exports nothing') }
console.log(names.length + ' entry points')`,
    ),
  )

  check('3. CommonJS require (core, core/banks, render, bank-logos, hono, nestjs)', () =>
    runInApp(
      'cjs.cjs',
      `const want = { '@tingqr/core': 'encodeVietQr', '@tingqr/core/banks': 'findBank', '@tingqr/render': 'toSvg', '@tingqr/bank-logos': 'ICON_IDS', '@tingqr/hono': 'tingqr', '@tingqr/nestjs': 'TingQrModule' }
for (const [n, k] of Object.entries(want)) if (require(n)[k] === undefined) throw new Error(n + ' has no ' + k)
console.log(Object.keys(want).length + ' packages')`,
    ),
  )

  check('4. core: encode, decode, detect, findBank', () =>
    runInApp(
      'core.mjs',
      `import { readFileSync } from 'node:fs'
import { encodeVietQr, decodeVietQr, detect } from '@tingqr/core'
import { findBank } from '@tingqr/core/banks'
const { vector } = JSON.parse(readFileSync(${JSON.stringify(join(work, 'expected.json'))}, 'utf8'))
const payload = encodeVietQr(vector.input)
if (payload !== vector.payload) throw new Error('encodeVietQr gave ' + payload)
const d = decodeVietQr(payload)
if (!d.ok || d.value.bankBin !== '970422' || d.value.amount !== '50000') throw new Error('decodeVietQr: ' + JSON.stringify(d))
const t = detect(payload)
if (!t.ok || t.value.scheme !== 'vietqr') throw new Error('detect: ' + JSON.stringify(t))
if (findBank('MB')?.bin !== '970422') throw new Error('findBank')
console.log('ok')`,
    ),
  )

  check('5. render toSvg, bank-logos icon', () =>
    runInApp(
      'render.mjs',
      `import { toSvg } from '@tingqr/render'
import mb from '@tingqr/bank-logos/icon/mb'
if (!toSvg('TINGQR').startsWith('<svg')) throw new Error('toSvg')
if (!mb.startsWith('data:image/')) throw new Error('icon is not a data URI')
console.log('ok')`,
    ),
  )

  check('6. hono: tingqr({ resolve }) serves the contract', () =>
    runInApp(
      'hono.mjs',
      `import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { tingqr } from '@tingqr/hono'
import { toSvg } from '@tingqr/render'
const { vector, headers } = JSON.parse(readFileSync(${JSON.stringify(join(work, 'expected.json'))}, 'utf8'))
const app = new Hono().get('/qr.svg', tingqr({ resolve: () => vector.payload }))
const res = await app.request('/qr.svg')
if (res.status !== 200) throw new Error('status ' + res.status)
for (const [k, v] of Object.entries(headers)) if (res.headers.get(k) !== v) throw new Error(k + ': ' + res.headers.get(k))
if ((await res.text()) !== toSvg(vector.payload)) throw new Error('body')
console.log('ok')`,
    ),
  )

  check('7. nestjs: an Express app with TingQrModule and @TingQrSvg serves the contract', () =>
    runInApp(
      'nest.mjs',
      `import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { Controller, Get, Inject, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { TingQrModule, TingQrService, TingQrSvg } from '@tingqr/nestjs'
import { toSvg } from '@tingqr/render'
const { vector, headers } = JSON.parse(readFileSync(${JSON.stringify(join(work, 'expected.json'))}, 'utf8'))
class Qr { constructor(tingqr) { this.tingqr = tingqr } qr() { return this.tingqr.paymentQr({ amount: 50000, purpose: 'TINGQR TEST' }) } }
Inject(TingQrService)(Qr, undefined, 0)
Reflect.decorate([Get('qr.svg'), TingQrSvg()], Qr.prototype, 'qr', Object.getOwnPropertyDescriptor(Qr.prototype, 'qr'))
Controller()(Qr)
class AppModule {}
Module({ imports: [TingQrModule.forRoot({ bank: 'MB', accountNumber: '0123456789' })], controllers: [Qr] })(AppModule)
const app = await NestFactory.create(AppModule, { logger: false })
await app.listen(0, '127.0.0.1')
try {
  const res = await fetch((await app.getUrl()).replace('[::1]', '127.0.0.1') + '/qr.svg')
  if (res.status !== 200) throw new Error('status ' + res.status)
  for (const [k, v] of Object.entries(headers)) if (res.headers.get(k) !== v) throw new Error(k + ': ' + res.headers.get(k))
  if ((await res.text()) !== toSvg(vector.payload)) throw new Error('body')
} finally { await app.close() }
console.log('ok')`,
    ),
  )

  check('8. angular: server-side render of <tingqr-code> has an <svg>', () =>
    runInApp(
      'angular.mjs',
      `import '@angular/compiler'
import { Component, provideZonelessChangeDetection } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { TingQrCode } from '@tingqr/angular'
class Root { payload = 'TINGQR' }
Component({ selector: 'app-root', imports: [TingQrCode], template: '<tingqr-code [payload]="payload" mode="svg" label="QR" />' })(Root)
const html = await renderApplication(
  (context) => bootstrapApplication(Root, { providers: [provideZonelessChangeDetection(), provideServerRendering()] }, context),
  { document: '<html><body><app-root></app-root></body></html>', url: '/' },
)
if (!html.includes('<tingqr-code') || !html.includes('<svg')) throw new Error('no <svg> in the server HTML')
console.log('ok')`,
    ),
  )

  if (outDir) {
    mkdirSync(outDir, { recursive: true })
    for (const p of PACKAGES) copyFileSync(tarballOf(p), join(outDir, basename(tarballOf(p))))
  }
} catch (e) {
  fatal = e instanceof Error ? e.message : String(e)
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.detail.split('\n').join('\n      ')}`}`)
const failed = fatal !== undefined || results.length < 8 || results.some((r) => !r.ok)
if (fatal) console.log(`FAIL  setup: ${fatal}`)
if (outDir && !failed) console.log(`tarballs copied to ${outDir}`)
if (failed || process.env.KEEP_DRILL_ARTIFACTS === '1') {
  console.log(`artifacts kept in ${work}`)
} else {
  rmSync(work, { recursive: true, force: true })
}
console.log(failed ? 'release-drill: FAILED' : `release-drill: ok (${results.length} checks)`)
process.exit(failed ? 1 : 0)
