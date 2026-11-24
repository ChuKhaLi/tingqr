// NuGet release drill: pack the four TingQR packages, read what is inside each .nupkg, install them into a console app
// and a web app OUTSIDE the repo (TingQR.* only from the packed folder), and use the INSTALLED packages as a consumer
// would.
// Usage (from the repo root): node .claude/skills/release-drill-dotnet/scripts/drill.mjs [--out <dir>]
//   --out <dir>            copy the four .nupkg and four .snupkg there (the files a release publishes)
//   KEEP_DRILL_ARTIFACTS=1 keep the temp directory even when every check passes
// Calls nuget.org (dotnet new / restore of anything that is not TingQR.*).
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inflateRawSync } from 'node:zlib'

import { judgeBadConfigExit } from './bad-config-exit.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const { PACKAGES, readDotnetVersion } = await import(pathToFileURL(join(ROOT, 'dotnet', 'scripts', 'release-common.mjs')).href)
const CHECKS = 6
// Dependencies between the packages, as each .nuspec must list them (all at the packed version).
const DEPENDS = {
  'TingQR.Core': [],
  'TingQR.Rendering': ['TingQR.Core'],
  'TingQR.AspNetCore': ['TingQR.Core', 'TingQR.Rendering'],
  'TingQR.BankLogos': [],
}
// Target frameworks each package must ship (lib/<tfm>/<id>.dll and .xml), and no others.
const TFMS = {
  'TingQR.Core': ['net10.0', 'netstandard2.0'],
  'TingQR.Rendering': ['net10.0', 'netstandard2.0'],
  'TingQR.AspNetCore': ['net10.0'],
  'TingQR.BankLogos': ['net10.0', 'netstandard2.0'],
}
const LICENSE = {
  'TingQR.Core': '<license type="expression">MIT</license>',
  'TingQR.Rendering': '<license type="expression">MIT</license>',
  'TingQR.AspNetCore': '<license type="expression">MIT</license>',
  'TingQR.BankLogos': '<license type="file">LOGOS-NOTICE.md</license>',
}
const EXTRA_FILES = { 'TingQR.Rendering': ['NOTICE'], 'TingQR.BankLogos': ['LOGOS-NOTICE.md'] }
const ENV = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1' }

const outIndex = process.argv.indexOf('--out')
const outDir = outIndex === -1 ? undefined : resolve(process.argv[outIndex + 1] ?? '')

const version = readDotnetVersion()
// The OS temp directory: nothing of the repo (Directory.Build.props, Directory.Packages.props, nuget.config,
// global.json) is above it, so the consumer projects see only what a NuGet user sees.
const work = mkdtempSync(join(tmpdir(), 'tingqr-nuget-drill-'))
const pkgs = join(work, 'pkgs')
const consumer = join(work, 'consumer')
mkdirSync(consumer)
const results = []
const started = [] // child processes started by check 5, killed in `finally` and on exit
process.on('exit', () => { for (const c of started) if (c.exitCode === null && c.signalCode === null) c.kill() })

function sh(cmd, args, cwd, label) {
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status}${r.error ? `, ${r.error.message}` : ''}):\n${(r.stdout ?? '').slice(-3000)}\n${(r.stderr ?? '').slice(-3000)}`)
  }
  return r.stdout
}

async function check(name, fn) {
  try {
    results.push({ name, ok: true, detail: await fn() })
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) })
  }
}

/** Entries of a zip file (a .nupkg) read from its central directory: name → () => Buffer. No npm package needed. */
function readZip(file) {
  const buf = readFileSync(file)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd === -1) throw new Error(`${file}: not a zip file`)
  const count = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const entries = new Map()
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error(`${file}: bad central directory`)
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    entries.set(name, () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const data = buf.subarray(start, start + size)
      if (method === 0) return data
      if (method === 8) return inflateRawSync(data)
      throw new Error(`${name}: zip method ${method}`)
    })
    at += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** A free TCP port on 127.0.0.1 (released before the app binds it). */
function freePort() {
  return new Promise((res, rej) => {
    const s = createServer()
    s.once('error', rej)
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)) })
  })
}

/** Start `dotnet <dll> ...args` (the app itself, not `dotnet run`, so killing it leaves no grandchild behind). */
function startApp(dll, args, cwd) {
  const child = spawn('dotnet', [dll, ...args], { cwd, env: { ...ENV, ASPNETCORE_ENVIRONMENT: 'Production' }, stdio: ['ignore', 'pipe', 'pipe'] })
  started.push(child)
  let output = ''
  child.stdout.on('data', (d) => { output += d })
  child.stderr.on('data', (d) => { output += d })
  const exited = new Promise((res) => child.once('exit', (code, signal) => res({ code, signal })))
  return { child, exited, output: () => output.slice(-4000), fullOutput: () => output }
}

async function stop(app) {
  if (app.child.exitCode === null && app.child.signalCode === null) app.child.kill()
  await app.exited
}

const vector = JSON.parse(readFileSync(join(ROOT, 'conformance', 'vectors', 'vietqr', 'vietqr-dynamic-amount-purpose.json'), 'utf8'))
const contract = JSON.parse(readFileSync(join(ROOT, 'conformance', 'http', 'svg-response.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(ROOT, 'conformance', 'banks', 'logos', 'manifest.json'), 'utf8'))
const cs = (s) => JSON.stringify(s) // the vector's ASCII strings are valid C# literals this way
const fileOf = (id, ext) => join(pkgs, `${id}.${version}.${ext}`)

let fatal
try {
  await check('1. dotnet pack: exactly 4 .nupkg and 4 .snupkg at the version in Directory.Build.props', () => {
    sh('dotnet', ['pack', join(ROOT, 'dotnet', 'TingQR.slnx'), '-c', 'Release', '-o', pkgs], ROOT, 'dotnet pack')
    const files = readdirSync(pkgs).sort()
    const want = PACKAGES.flatMap((id) => [`${id}.${version}.nupkg`, `${id}.${version}.snupkg`]).sort()
    if (JSON.stringify(files) !== JSON.stringify(want)) throw new Error(`packed ${files.join(', ')}; expected ${want.join(', ')}`)
    return `${files.length} files at ${version}`
  })
  if (!results[0].ok) throw new Error('nothing to drill without the packages')

  await check('2. .nupkg contents: README, NOTICE, LOGOS-NOTICE + images, lib/<tfm> .dll + .xml, .nuspec metadata', () => {
    const problems = []
    for (const id of PACKAGES) {
      const zip = readZip(fileOf(id, 'nupkg'))
      const names = [...zip.keys()]
      for (const f of ['README.md', ...(EXTRA_FILES[id] ?? [])]) if (!zip.has(f)) problems.push(`${id}: no ${f}`)
      const libTfms = [...new Set(names.filter((n) => n.startsWith('lib/')).map((n) => n.split('/')[1]))].sort()
      if (JSON.stringify(libTfms) !== JSON.stringify([...TFMS[id]].sort())) problems.push(`${id}: lib/ has ${libTfms.join(', ')}; expected ${TFMS[id].join(', ')}`)
      for (const tfm of TFMS[id]) {
        for (const ext of ['dll', 'xml']) if (!zip.has(`lib/${tfm}/${id}.${ext}`)) problems.push(`${id}: no lib/${tfm}/${id}.${ext}`)
      }
      if (id === 'TingQR.BankLogos') {
        // Resource names sit as UTF-8 in the assembly's #Strings heap; count the distinct ones in each build.
        for (const tfm of TFMS[id]) {
          const dll = zip.get(`lib/${tfm}/${id}.dll`)?.()
          if (!dll) continue
          const found = new Set(dll.toString('latin1').match(/TingQR\.BankLogos\/(?:icon|logo)\/[A-Za-z0-9._-]+\.(?:webp|png|svg|jpg)/g) ?? [])
          const want = new Set(manifest.files.map((f) => `TingQR.BankLogos/${f.file}`))
          const missing = [...want].filter((n) => !found.has(n))
          if (found.size !== want.size || missing.length) {
            problems.push(`${id} ${tfm}: ${found.size} embedded images, manifest.json has ${want.size}${missing.length ? ` (missing ${missing.slice(0, 3).join(', ')}…)` : ''}`)
          }
        }
      }
      const nuspecName = names.find((n) => n.endsWith('.nuspec') && !n.includes('/'))
      if (!nuspecName) { problems.push(`${id}: no .nuspec`); continue }
      const nuspec = zip.get(nuspecName)().toString('utf8')
      if (!nuspec.includes(`<version>${version}</version>`)) problems.push(`${id}: .nuspec version is not ${version}`)
      if (!nuspec.includes(LICENSE[id])) problems.push(`${id}: .nuspec has no ${LICENSE[id]}`)
      if (!nuspec.includes('<readme>README.md</readme>')) problems.push(`${id}: .nuspec has no <readme>README.md</readme>`)
      if (!/<repository type="git" url="https:\/\/github\.com\/ChuKhaLi\/tingqr(\.git)?" (branch="[^"]*" )?commit="[0-9a-f]{40}"/.test(nuspec)) {
        problems.push(`${id}: .nuspec has no <repository type="git" url="https://github.com/ChuKhaLi/tingqr" … commit="<sha>">`)
      }
      const deps = [...nuspec.matchAll(/<dependency id="([^"]+)" version="([^"]+)"/g)].map((m) => [m[1], m[2]])
      for (const dep of DEPENDS[id]) {
        const versions = deps.filter(([d]) => d === dep).map(([, v]) => v)
        if (versions.length === 0) problems.push(`${id}: .nuspec does not depend on ${dep}`)
        // Each target framework group lists the dependency; every one must be the packed version.
        for (const v of versions) if (v !== version && v !== `[${version}, )`) problems.push(`${id}: depends on ${dep} ${v}, not ${version}`)
      }
      for (const [dep] of deps) if (!DEPENDS[id].includes(dep)) problems.push(`${id}: unexpected dependency ${dep}`)
      const hasAspNet = /<frameworkReference name="Microsoft\.AspNetCore\.App"/.test(nuspec)
      if ((id === 'TingQR.AspNetCore') !== hasAspNet) {
        problems.push(`${id}: frameworkReference Microsoft.AspNetCore.App ${hasAspNet ? 'present but not expected' : 'missing'}`)
      }
    }
    for (const id of PACKAGES) {
      const snupkg = [...readZip(fileOf(id, 'snupkg')).keys()]
      for (const tfm of TFMS[id]) if (!snupkg.includes(`lib/${tfm}/${id}.pdb`)) problems.push(`${id}: .snupkg has no lib/${tfm}/${id}.pdb`)
    }
    if (problems.length) throw new Error(problems.join('\n'))
    return `${PACKAGES.length} packages, ${manifest.files.length} images in BankLogos`
  })

  await check('3. consumer projects outside the repo restore TingQR.* from the packed folder only', () => {
    const rel = relative(ROOT, consumer)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error(`${consumer} is inside the repo`)
    // Package source mapping: TingQR.* can come only from the packed folder, everything else only from nuget.org. A
    // private packages folder, so a TingQR.* of the same version cached by an earlier drill is never reused.
    writeFileSync(
      join(consumer, 'nuget.config'),
      `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <config>
    <add key="globalPackagesFolder" value="nuget-packages" />
  </config>
  <fallbackPackageFolders>
    <clear />
  </fallbackPackageFolders>
  <packageSources>
    <clear />
    <add key="tingqr-drill" value="${pkgs}" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="tingqr-drill">
      <package pattern="TingQR.*" />
    </packageSource>
    <packageSource key="nuget.org">
      <package pattern="*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
`,
    )
    sh('dotnet', ['new', 'console', '-o', 'console', '--framework', 'net10.0'], consumer, 'dotnet new console')
    sh('dotnet', ['new', 'web', '-o', 'web', '--framework', 'net10.0'], consumer, 'dotnet new web')
    const sets = { console: ['TingQR.Core', 'TingQR.Rendering', 'TingQR.BankLogos'], web: PACKAGES }
    for (const [dir, ids] of Object.entries(sets)) {
      for (const id of ids) sh('dotnet', ['add', 'package', id, '--version', version], join(consumer, dir), `dotnet add package ${id} (${dir})`)
    }
    const problems = []
    for (const id of PACKAGES) {
      const meta = join(consumer, 'nuget-packages', id.toLowerCase(), version, '.nupkg.metadata')
      if (!existsSync(meta)) { problems.push(`${id} ${version} not restored`); continue }
      const source = JSON.parse(readFileSync(meta, 'utf8')).source
      if (resolve(source) !== resolve(pkgs)) problems.push(`${id} restored from ${source}, not ${pkgs}`)
    }
    if (problems.length) throw new Error(problems.join('\n'))
    return `console (3 packages) and web (4 packages) in ${consumer}`
  })

  if (!results[2].ok) throw new Error('no consumer projects to run')

  await check('4. console: VietQr.Encode/Decode, ToSvg with BankLogos.Icon("mb"), TingQrVersion.Value', () => {
    const i = vector.input
    writeFileSync(
      join(consumer, 'console', 'Program.cs'),
      `using TingQR;
using TingQR.Rendering;

var payload = VietQr.Encode(new VietQrInput { BankBin = ${cs(i.bankBin)}, AccountNumber = ${cs(i.accountNumber)}, Amount = ${cs(i.amount)}, Purpose = ${cs(i.purpose)} });
Console.WriteLine("payload=" + payload);
var decoded = VietQr.Decode(payload);
Console.WriteLine("decoded=" + (decoded.Ok && decoded.Value!.BankBin == ${cs(i.bankBin)} && decoded.Value.AccountNumber == ${cs(i.accountNumber)} && decoded.Value.Amount == ${cs(i.amount)} && decoded.Value.Purpose == ${cs(i.purpose)}));
var icon = BankLogos.Icon("mb") ?? throw new InvalidOperationException("no mb icon");
var svg = TingQrRender.ToSvg(payload, new SvgOptions { Logo = new LogoOptions { Href = icon } });
Console.WriteLine("svg=" + (icon.StartsWith("data:image/", StringComparison.Ordinal) && svg.StartsWith("<svg", StringComparison.Ordinal) && svg.Contains(icon)));
Console.WriteLine("version=" + TingQrVersion.Value);
`,
    )
    const out = sh('dotnet', ['run', '-c', 'Release'], join(consumer, 'console'), 'console app').split(/\r?\n/).filter(Boolean)
    const want = [`payload=${vector.payload}`, 'decoded=True', 'svg=True', `version=${version}`]
    if (JSON.stringify(out) !== JSON.stringify(want)) throw new Error(`output:\n${out.join('\n')}\nexpected:\n${want.join('\n')}`)
    return 'payload equals the conformance vector, decoded back, SVG has the icon'
  })

  await check('5. web: AddTingQr, WithTingQrSvg and [TingQrSvg("logo")] over real HTTP; a bad bank stops the app', async () => {
    const i = vector.input
    const web = join(consumer, 'web')
    writeFileSync(
      join(web, 'Program.cs'),
      `using Microsoft.AspNetCore.Mvc;
using TingQR;
using TingQR.AspNetCore;
using TingQR.Rendering;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddTingQr(o =>
{
    o.Bank = builder.Configuration["DrillBank"] ?? ${cs(i.bankBin)};
    o.AccountNumber = ${cs(i.accountNumber)};
    o.Profiles["logo"] = new SvgOptions { Logo = new LogoOptions { Href = BankLogos.Icon("mb")! } };
});
var app = builder.Build();
app.MapGet("/minimal/qr.svg", (TingQrService tingqr) => tingqr.PaymentQr(${i.amount}L, ${cs(i.purpose)})).WithTingQrSvg();
app.MapControllers();
app.Run();

[ApiController, Route("mvc")]
public class QrController(TingQrService tingqr) : ControllerBase
{
    [HttpGet("qr.svg"), TingQrSvg("logo")]
    public string? Qr() => tingqr.PaymentQr(${i.amount}L, ${cs(i.purpose)});
}
`,
    )
    sh('dotnet', ['build', '-c', 'Release'], web, 'web build')
    const dll = join(web, 'bin', 'Release', 'net10.0', 'web.dll')
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    const app = startApp(dll, ['--urls', base], web)
    const problems = []
    try {
      // Ready when the first route answers; give up after 60 s or when the app exits.
      const deadline = Date.now() + 60_000
      let ready = false
      while (!ready && Date.now() < deadline) {
        if (app.child.exitCode !== null) throw new Error(`the app exited (${app.child.exitCode}):\n${app.output()}`)
        try { await fetch(`${base}/minimal/qr.svg`); ready = true } catch { await new Promise((r) => setTimeout(r, 250)) }
      }
      if (!ready) throw new Error(`the app did not answer within 60 s:\n${app.output()}`)
      for (const [route, needsLogo] of [['/minimal/qr.svg', false], ['/mvc/qr.svg', true]]) {
        const res = await fetch(base + route)
        const body = await res.text()
        if (res.status !== 200) problems.push(`${route}: status ${res.status}`)
        for (const [k, v] of Object.entries(contract.success.headers)) {
          if (res.headers.get(k) !== v) problems.push(`${route}: ${k} is ${JSON.stringify(res.headers.get(k))}`)
        }
        if (!body.startsWith('<svg')) problems.push(`${route}: body starts ${JSON.stringify(body.slice(0, 40))}`)
        if (needsLogo !== body.includes('data:image/')) problems.push(`${route}: logo ${needsLogo ? 'missing' : 'unexpected'}`)
      }
    } finally {
      await stop(app)
    }

    // A wrong bank must stop the app at startup, not serve 500s later. How it stops differs by OS (an exit code on
    // Windows, SIGABRT on Linux): judgeBadConfigExit decides, and has tests.
    const bad = startApp(dll, ['--urls', `http://127.0.0.1:${await freePort()}`, '--DrillBank', 'NOT-A-BANK'], web)
    let timer
    const timeout = new Promise((r) => { timer = setTimeout(() => r('timeout'), 60_000) })
    const outcome = await Promise.race([bad.exited, timeout])
    clearTimeout(timer)
    const timedOut = outcome === 'timeout'
    if (timedOut) await stop(bad)
    const verdict = judgeBadConfigExit({
      timedOut,
      code: timedOut ? null : outcome.code,
      signal: timedOut ? null : outcome.signal,
      output: bad.fullOutput(),
    })
    if (!verdict.ok) problems.push(`with DrillBank=NOT-A-BANK: ${verdict.reason}`)
    if (problems.length) throw new Error(problems.join('\n'))
    return `2 routes on port ${port}; bad bank ${verdict.reason}`
  })

  await check('6. no app process left running', () => {
    const running = started.filter((c) => c.exitCode === null && c.signalCode === null)
    if (running.length) throw new Error(`still running: pid ${running.map((c) => c.pid).join(', ')}`)
    return `${started.length} started (pid ${started.map((c) => c.pid).join(', ')}), all exited`
  })

  // Packages leave the drill only when every check passed: they are the files a release publishes.
  if (outDir && results.length === CHECKS && results.every((r) => r.ok)) {
    mkdirSync(outDir, { recursive: true })
    for (const id of PACKAGES) for (const ext of ['nupkg', 'snupkg']) copyFileSync(fileOf(id, ext), join(outDir, `${id}.${version}.${ext}`))
  }
} catch (e) {
  fatal = e instanceof Error ? e.message : String(e)
} finally {
  for (const c of started) if (c.exitCode === null && c.signalCode === null) c.kill()
}

for (const r of results) console.log(`${r.ok ? 'ĐẠT ' : 'HỎNG'}  ${r.name}${r.ok ? (r.detail ? ` (${r.detail})` : '') : `\n      ${r.detail.split('\n').join('\n      ')}`}`)
const failed = fatal !== undefined || results.length < CHECKS || results.some((r) => !r.ok)
if (fatal) console.log(`HỎNG  setup: ${fatal}`)
if (outDir && !failed) console.log(`packages copied to ${outDir}`)
if (failed || process.env.KEEP_DRILL_ARTIFACTS === '1') {
  console.log(`artifacts kept in ${work}`)
} else {
  rmSync(work, { recursive: true, force: true })
}
console.log(failed ? 'release-drill-dotnet: HỎNG' : `release-drill-dotnet: ĐẠT (${results.length} checks)`)
process.exit(failed ? 1 : 0)
