import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '../update.mjs'
import { parseBanksResponse } from '../lib/vietqr.mjs'

const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
const BANKS = fx('vietqr-banks.json')
const REDIRECTS = fx('vietqr-dl-redirects.json')
const LISTS = { android: fx('vietqr-android-app-deeplinks.json'), ios: fx('vietqr-ios-app-deeplinks.json') }

/** A fetch stand-in serving the trimmed fixtures; `banks` and `play` can be swapped per test. */
const COMMONS = fx('commons-tpbank.json')
const SAFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>'

function fakeFetch({
  banks = BANKS,
  play = (pkg) => ({ status: 200, body: `id=${pkg}` }),
  svg = SAFE_SVG,
  commons = COMMONS,
  image = (url) => ({ status: 200, body: `bytes of ${url}` }),
} = {}) {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push(url)
    const ua = init.headers?.['user-agent'] ?? ''
    const reply = (status, body = '', headers = {}, finalUrl = url) => ({
      status,
      ok: status >= 200 && status < 300,
      url: finalUrl,
      headers: new Headers(headers),
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      json: async () => body,
      arrayBuffer: async () => new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body)).buffer,
    })
    if (url.startsWith('https://commons.wikimedia.org/w/api.php?')) return reply(200, commons)
    if (url.startsWith('https://upload.wikimedia.org/')) return reply(200, svg)
    if (url.startsWith('https://cdn.vietqr.io/')) {
      const r = image(url)
      return reply(r.status, r.body)
    }
    if (url === 'https://api.vietqr.io/v2/banks') return reply(200, banks)
    const list = /v2\/(android|ios)-app-deeplinks$/.exec(url)
    if (list) return reply(200, LISTS[list[1]])
    const dl = /^https:\/\/dl\.vietqr\.io\/pay\?app=(.+)$/.exec(url)
    if (dl) {
      const platform = /Android/.test(ua) ? 'android' : 'ios'
      const r = REDIRECTS[platform][dl[1]]
      if (platform === 'android') return reply(r.status, '', r.location ? { location: r.location } : {})
      return reply(200, `<a class="btn" id="open" href="${r.openHref}">open</a>`)
    }
    const p = /^https:\/\/play\.google\.com\/store\/apps\/details\?id=([^&]+)/.exec(url)
    if (p) {
      const r = play(p[1])
      return reply(r.status, r.body, {}, r.url ?? url)
    }
    throw new Error(`unexpected fetch ${url}`)
  }
  return { fetch, calls }
}

const CURATED = {
  apps: [
    {
      id: 'mb',
      name: 'MB Bank',
      bin: '970422',
      ios: { scheme: 'mbbank' },
      android: { package: 'com.mbmobile', scheme: 'mbbank', host: '' },
      sources: [{ name: 'vietqr.io', ref: 'mb' }],
    },
    {
      id: 'tcb',
      name: 'Techcombank Mobile',
      bin: '970407',
      ios: { scheme: 'tcb' },
      android: { package: 'vn.com.techcombank.bb.app', scheme: 'tcb', host: 'applink' },
      sources: [{ name: 'vietqr.io', ref: 'tcb' }],
    },
    {
      id: 'vib',
      name: 'MyVIB',
      bin: '970441',
      ios: { scheme: 'myvib2' },
      android: { package: 'com.vib.myvib2', scheme: 'myvib2', host: 'myvib2.com.vn/data' },
      sources: [{ name: 'vietqr.io', ref: 'vib-2' }],
    },
    {
      id: 'klb',
      name: 'KienlongBank Plus',
      bin: null,
      ios: { scheme: 'kienlongbankmobilebanking' },
      android: { package: 'com.sunshine.ksbank', scheme: 'ksbank', host: 'ksbank.co' },
      sources: [{ name: 'vietqr.io', ref: 'klb' }],
    },
  ],
}

/** A repo root holding conformance/banks/ in sync with the fixtures. */
function makeRoot({ banks = parseBanksResponse(BANKS) } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tingqr-banks-'))
  const dir = join(root, 'conformance', 'banks')
  mkdirSync(dir, { recursive: true })
  const write = (name, value) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + '\n')
  write('banks.json', { source: 'https://api.vietqr.io/v2/banks', fetchedAt: '2026-11-01', banks })
  write('bank-apps.json', CURATED)
  write('overrides.json', [])
  write('play-checks.json', {})
  return { root, dir }
}

const snapshot = (dir) =>
  Object.fromEntries(
    ['banks.json', 'bank-apps.json', 'overrides.json', 'play-checks.json'].map((n) => [
      n,
      [readFileSync(join(dir, n), 'utf8'), statSync(join(dir, n)).mtimeMs],
    ]),
  )

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
const opts = (root, fetch, mode = 'write') => ({ mode, root, fetch, today: '2026-11-21', delayMs: 0, fetchLogos: true })

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
  assert.deepEqual([vcb.file, vcb.license, vcb.sourceUrl, vcb.pageUrl], ['logo/970436.png', 'trademark-no-license', 'https://cdn.vietqr.io/img/VCB.png', null])
  const vib = m.files.find((f) => f.kind === 'icon' && f.key === 'vib')
  assert.deepEqual([vib.file, vib.sourceUrl], ['icon/vib.webp', 'https://cdn.vietqr.io/bank-app-icon/vib-2-ios.webp'])
  assert.equal(m.files.filter((f) => f.kind === 'logo').length, 6)
  assert.equal(m.files.filter((f) => f.kind === 'icon').length, 4)
  assert.deepEqual(m.files.map((f) => f.file), [...m.files.map((f) => f.file)].sort())
})

test('an unsafe Commons SVG is not written; the PNG is used and the report says why', async () => {
  const { root, dir } = makeLogoRoot()
  const r = await run(opts(root, fakeFetch({ svg: '<svg><script>x</script></svg>' }).fetch))
  assert.equal(manifestOf(dir).files.find((f) => f.key === '970422').file, 'logo/970422.png')
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
