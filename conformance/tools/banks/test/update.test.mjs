import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '../update.mjs'
import { parseBanksResponse } from '../lib/vietqr.mjs'
import { BANKS, COMMONS, CURATED, SAFE_SVG, fakeFetch, makeRoot, snapshot } from '../testing/helpers.mjs'

test('a package Google Play has not confirmed for more than 90 days is a change, even when every check is blocked', async () => {
  const blocked = fakeFetch({ play: () => ({ status: 429, body: '' }) })
  const stale = makeRoot({ lastOk: '2026-08-21' })
  const r = await run({ mode: 'check', root: stale.root, fetch: blocked.fetch, today: '2026-11-20', delayMs: 0 })
  assert.equal(r.changed, true)
  assert.match(r.report, /90 ngày/)
  assert.match(r.report, /com\.mbmobile/)
  const never = makeRoot({ lastOk: null })
  assert.equal((await run({ mode: 'check', root: never.root, fetch: blocked.fetch, today: '2026-11-20', delayMs: 0 })).changed, true)
  const fresh = makeRoot({ lastOk: '2026-08-22' })
  assert.equal((await run({ mode: 'check', root: fresh.root, fetch: blocked.fetch, today: '2026-11-20', delayMs: 0 })).changed, false)
})


test('check mode with nothing new reports no change and writes nothing', async () => {
  const { root, dir } = makeRoot()
  const before = snapshot(dir)
  const r = await run({ mode: 'check', root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })
  assert.equal(r.changed, false)
  assert.deepEqual(snapshot(dir), before)
})

test('check mode reports a bank added upstream as a change but writes nothing', async () => {
  const { root, dir } = makeRoot({ banks: parseBanksResponse(BANKS).slice(1) })
  const before = snapshot(dir)
  const r = await run({ mode: 'check', root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })
  assert.equal(r.changed, true)
  assert.match(r.report, /970406/)
  assert.deepEqual(snapshot(dir), before)
})

test('a package gone from Google Play is a change; an unknown result is not', async () => {
  const { root } = makeRoot()
  const gone = fakeFetch({ play: (pkg) => (pkg === 'com.mbmobile' ? { status: 404, body: '' } : { status: 200, body: pkg }) })
  const r1 = await run({ mode: 'check', root, fetch: gone.fetch, today: '2026-11-20', delayMs: 0 })
  assert.equal(r1.changed, true)
  assert.match(r1.report, /com\.mbmobile/)
  const blocked = fakeFetch({ play: () => ({ status: 429, body: '' }) })
  const r2 = await run({ mode: 'check', root, fetch: blocked.fetch, today: '2026-11-20', delayMs: 0 })
  assert.equal(r2.changed, false)
  assert.match(r2.report, /chưa kiểm được/)
})

test('write mode rewrites banks.json and play-checks.json but never bank-apps.json or overrides.json', async () => {
  const { root, dir } = makeRoot({ banks: parseBanksResponse(BANKS).slice(1) })
  const before = snapshot(dir)
  await run({ mode: 'write', root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })
  const after = snapshot(dir)
  assert.deepEqual(after['bank-apps.json'], before['bank-apps.json'])
  assert.deepEqual(after['overrides.json'], before['overrides.json'])
  const banks = JSON.parse(after['banks.json'][0])
  assert.equal(banks.fetchedAt, '2026-11-20')
  assert.equal(banks.banks.length, 6)
  const play = JSON.parse(after['play-checks.json'][0])
  assert.deepEqual(play['com.mbmobile'], { lastOk: '2026-11-20', last: 'ok', checked: '2026-11-20' })
})

test('write mode drops play-checks entries for packages no longer in bank-apps.json', async () => {
  const { root, dir } = makeRoot()
  const checks = JSON.parse(readFileSync(join(dir, 'play-checks.json'), 'utf8'))
  checks['vn.com.old.package'] = { lastOk: null, last: 'gone', checked: '2026-10-01' }
  writeFileSync(join(dir, 'play-checks.json'), JSON.stringify(checks))
  await run({ mode: 'write', root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })
  const after = JSON.parse(readFileSync(join(dir, 'play-checks.json'), 'utf8'))
  assert.deepEqual(Object.keys(after).sort(), CURATED.apps.map((a) => a.android.package).sort())
})

test('the Play section does not say every package is fine when some are stale', async () => {
  const { root } = makeRoot({ lastOk: '2026-01-01' })
  const r = await run({ mode: 'check', root, fetch: fakeFetch({ play: () => ({ status: 429, body: '' }) }).fetch, today: '2026-11-20', delayMs: 0 })
  assert.doesNotMatch(r.report, /Mọi gói còn trên Google Play/)
  const ok = makeRoot()
  assert.match((await run({ mode: 'check', root: ok.root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })).report, /Mọi gói còn trên Google Play/)
})

test('write mode applies overrides.json after fetching', async () => {
  const { root, dir } = makeRoot()
  writeFileSync(
    join(dir, 'overrides.json'),
    JSON.stringify([{ bin: '970422', field: 'shortName', value: 'MB Bank', reason: 'r', source: 's' }]),
  )
  await run({ mode: 'write', root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })
  const banks = JSON.parse(readFileSync(join(dir, 'banks.json'), 'utf8')).banks
  assert.equal(banks.find((b) => b.bin === '970422').shortName, 'MB Bank')
})

test('a response that drops more than 5 banks is refused and nothing is written', async () => {
  const many = parseBanksResponse(BANKS)
  for (let i = 0; i < 6; i++) many.push({ ...many[0], bin: `97100${i}`, code: `Z${i}` })
  const { root, dir } = makeRoot({ banks: many })
  const before = snapshot(dir)
  const r = await run({ mode: 'write', root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })
  assert.equal(r.changed, true)
  assert.match(r.report, /từ chối ghi/i)
  assert.deepEqual(snapshot(dir)['banks.json'], before['banks.json'])
})

test('a malformed bank response throws and writes nothing', async () => {
  const { root, dir } = makeRoot()
  const before = snapshot(dir)
  await assert.rejects(
    run({ mode: 'write', root, fetch: fakeFetch({ banks: { code: '00' } }).fetch, today: '2026-11-20', delayMs: 0 }),
    /data/,
  )
  assert.deepEqual(snapshot(dir), before)
})

test('an app scheme changed upstream shows in the report', async () => {
  const { root, dir } = makeRoot()
  const apps = structuredClone(CURATED)
  apps.apps[0].ios.scheme = 'mbbank-old'
  writeFileSync(join(dir, 'bank-apps.json'), JSON.stringify(apps))
  const r = await run({ mode: 'check', root, fetch: fakeFetch().fetch, today: '2026-11-20', delayMs: 0 })
  assert.equal(r.changed, true)
  assert.match(r.report, /mb.*scheme/)
})

test('seed mode writes banks.json and play-checks.json into outDir only', async () => {
  const { root, dir } = makeRoot()
  const before = snapshot(dir)
  const outDir = mkdtempSync(join(tmpdir(), 'tingqr-seed-'))
  await run({ mode: 'seed', root, fetch: fakeFetch().fetch, today: '2026-11-20', outDir, delayMs: 0 })
  assert.equal(JSON.parse(readFileSync(join(outDir, 'banks.json'), 'utf8')).banks.length, 6)
  assert.ok(JSON.parse(readFileSync(join(outDir, 'play-checks.json'), 'utf8'))['com.mbmobile'])
  assert.ok(JSON.parse(readFileSync(join(outDir, 'vietqr-apps.json'), 'utf8')).find((a) => a.id === 'klb'))
  assert.deepEqual(snapshot(dir), before)
})

/** makeRoot plus conformance/banks/logos/commons.json mapping MB (970422) to a Commons file. */
function makeLogoRoot() {
  const r = makeRoot()
  mkdirSync(join(r.dir, 'logos'), { recursive: true })
  writeFileSync(join(r.dir, 'logos', 'commons.json'), JSON.stringify({ logos: { '970422': 'File:Logo TPBank.svg' } }))
  return r
}
const manifestOf = (dir) => JSON.parse(readFileSync(join(dir, 'logos', 'manifest.json'), 'utf8'))
/** Stand-in for the sharp resize: marks the bytes so tests can tell a shrunk file from the source. */
const fakeShrink = async (bytes) => Buffer.concat([Buffer.from('small:'), bytes])
const opts = (root, fetch, mode = 'write', shrink = fakeShrink) => ({ mode, root, fetch, today: '2026-11-21', delayMs: 0, fetchLogos: true, shrink })

test('fetchLogos takes the Commons SVG when it is PD and safe, the vietqr.io PNG otherwise, and icons by vietqr.io id', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const m = manifestOf(dir)
  const mb = m.files.find((f) => f.key === '970422' && f.kind === 'logo')
  assert.equal(mb.file, 'logo/970422.svg')
  assert.equal(mb.license, 'PD-textlogo')
  assert.match(mb.pageUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
  assert.equal(readFileSync(join(dir, 'logos', 'logo', '970422.svg'), 'utf8'), SAFE_SVG)
  const vcb = m.files.find((f) => f.key === '970436')
  assert.deepEqual([vcb.file, vcb.license, vcb.sourceUrl, vcb.pageUrl], ['logo/970436.webp', 'trademark-no-license', 'https://cdn.vietqr.io/img/VCB.png', null])
  const vib = m.files.find((f) => f.kind === 'icon' && f.key === 'vib')
  assert.deepEqual([vib.file, vib.sourceUrl], ['icon/vib.webp', 'https://cdn.vietqr.io/bank-app-icon/vib-2-ios.webp'])
  assert.equal(m.files.filter((f) => f.kind === 'logo').length, 6)
  assert.equal(m.files.filter((f) => f.kind === 'icon').length, 4)
  assert.deepEqual(m.files.map((f) => f.file), [...m.files.map((f) => f.file)].sort())
})

test('an unsafe Commons SVG is not written; the PNG is used and the report says why', async () => {
  const { root, dir } = makeLogoRoot()
  const r = await run(opts(root, fakeFetch({ svg: '<svg><script>x</script></svg>' }).fetch))
  assert.equal(manifestOf(dir).files.find((f) => f.key === '970422').file, 'logo/970422.webp')
  assert.match(r.report, /970422.*script/)
})

test('a Commons file without a PD tag falls back to the PNG', async () => {
  const { root, dir } = makeLogoRoot()
  const cc = structuredClone(COMMONS)
  Object.values(cc.query.pages)[0].categories = [{ ns: 14, title: 'Category:CC-BY-SA-4.0' }]
  await run(opts(root, fakeFetch({ commons: cc }).fetch))
  assert.equal(manifestOf(dir).files.find((f) => f.key === '970422').license, 'trademark-no-license')
})

test('an image that fails to download is left out and named in the report', async () => {
  const { root, dir } = makeLogoRoot()
  const r = await run(opts(root, fakeFetch({ image: (u) => (u.endsWith('/VCB.png') ? { status: 404, body: '' } : { status: 200, body: u }) }).fetch))
  assert.equal(manifestOf(dir).files.find((f) => f.key === '970436'), undefined)
  assert.match(r.report, /970436/)
})

test('a download that fails on a later run keeps the committed image and is not a change', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const first = readFileSync(join(dir, 'logos', 'manifest.json'), 'utf8')
  const flaky = fakeFetch({ image: (u) => (u.endsWith('/VCB.png') || u.includes('/mb-') ? { status: 503, body: '' } : { status: 200, body: `bytes of ${u}` }) })
  for (const mode of ['check', 'write']) {
    const r = await run(opts(root, flaky.fetch, mode))
    assert.equal(r.changed, false, mode)
    assert.match(r.report, /970436.*503/, mode)
  }
  assert.equal(readFileSync(join(dir, 'logos', 'manifest.json'), 'utf8'), first)
  assert.ok(existsSync(join(dir, 'logos', 'logo', '970436.webp')))
  assert.ok(existsSync(join(dir, 'logos', 'icon', 'mb.webp')))
})

test('a fetch that throws (network down) is treated like a failed download, not a crash', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const inner = fakeFetch().fetch
  const down = async (url, init) => {
    if (url.startsWith('https://cdn.vietqr.io/img/VCB')) throw new TypeError('fetch failed')
    return inner(url, init)
  }
  const r = await run(opts(root, down))
  assert.equal(r.changed, false)
  assert.ok(manifestOf(dir).files.find((f) => f.key === '970436'))
})

test('a Commons outage keeps the committed SVG instead of swapping it for the PNG', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const inner = fakeFetch().fetch
  const outage = async (url, init) => {
    if (url.startsWith('https://commons.wikimedia.org/')) return { status: 503, ok: false, url, headers: new Headers(), text: async () => '', json: async () => ({}) }
    return inner(url, init)
  }
  const r = await run(opts(root, outage))
  assert.equal(r.changed, false)
  assert.equal(manifestOf(dir).files.find((f) => f.key === '970422').file, 'logo/970422.svg')
  assert.ok(existsSync(join(dir, 'logos', 'logo', '970422.svg')))
})

test('a bank that left the list has its logo dropped', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const fewer = structuredClone(BANKS)
  fewer.data = fewer.data.filter((b) => b.bin !== '970436')
  const r = await run(opts(root, fakeFetch({ banks: fewer }).fetch))
  assert.match(r.report, /logo\/970436\.webp: bỏ/)
  assert.equal(manifestOf(dir).files.find((f) => f.key === '970436'), undefined)
  assert.equal(existsSync(join(dir, 'logos', 'logo', '970436.webp')), false)
})

test('a second run with the same images changes nothing and keeps the first fetched date', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const first = readFileSync(join(dir, 'logos', 'manifest.json'), 'utf8')
  const r = await run({ ...opts(root, fakeFetch().fetch), today: '2026-12-01' })
  assert.equal(r.changed, false)
  assert.equal(readFileSync(join(dir, 'logos', 'manifest.json'), 'utf8'), first)
})

test('check mode with fetchLogos reports new images but writes nothing', async () => {
  const { root, dir } = makeLogoRoot()
  const r = await run(opts(root, fakeFetch().fetch, 'check'))
  assert.equal(r.changed, true)
  assert.match(r.report, /logo\/970422\.svg/)
  assert.equal(existsSync(join(dir, 'logos', 'manifest.json')), false)
  assert.equal(existsSync(join(dir, 'logos', 'logo')), false)
})

test('a changed image is reported with its file', async () => {
  const { root } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const r = await run(opts(root, fakeFetch({ image: (u) => ({ status: 200, body: `new ${u}` }) }).fetch))
  assert.equal(r.changed, true)
  assert.match(r.report, /icon\/mb\.webp/)
})

test('a vietqr.io PNG is stored shrunk; the manifest keeps the source hash and says how it was processed', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const vcb = manifestOf(dir).files.find((f) => f.key === '970436')
  const source = Buffer.from('bytes of https://cdn.vietqr.io/img/VCB.png')
  assert.equal(readFileSync(join(dir, 'logos', vcb.file), 'utf8'), `small:${source}`)
  assert.equal(vcb.sourceSha256, createHash('sha256').update(source).digest('hex'))
  assert.match(vcb.processed, /128 px.*WebP/)
  assert.equal(vcb.bytes, source.length + 'small:'.length)
})

test('SVGs and icons are stored as downloaded, without processed or sourceSha256', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  for (const f of manifestOf(dir).files.filter((x) => !x.file.startsWith('logo/') || x.file.endsWith('.svg'))) {
    assert.equal('processed' in f, false, f.file)
    assert.equal('sourceSha256' in f, false, f.file)
  }
})

test('a different shrink output for the same source is not a change (sharp versions differ)', async () => {
  const { root, dir } = makeLogoRoot()
  await run(opts(root, fakeFetch().fetch))
  const first = readFileSync(join(dir, 'logos', 'manifest.json'), 'utf8')
  const r = await run(opts(root, fakeFetch().fetch, 'write', async (b) => Buffer.concat([Buffer.from('other:'), b])))
  assert.equal(r.changed, false)
  assert.equal(readFileSync(join(dir, 'logos', 'manifest.json'), 'utf8'), first)
})
