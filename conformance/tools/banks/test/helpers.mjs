// Shared stand-ins for update.mjs tests: fixtures, a fake fetch, and a temporary repo root.
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseBanksResponse } from '../lib/vietqr.mjs'

export const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
export const BANKS = fx('vietqr-banks.json')
const REDIRECTS = fx('vietqr-dl-redirects.json')
const LISTS = { android: fx('vietqr-android-app-deeplinks.json'), ios: fx('vietqr-ios-app-deeplinks.json') }

/** A fetch stand-in serving the trimmed fixtures; `banks` and `play` can be swapped per test. */
export const COMMONS = fx('commons-tpbank.json')
export const SAFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>'

export function fakeFetch({
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

export const CURATED = {
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
// lastOk defaults to today so the CLI tests (which use the real date) never see a stale Play check.
export function makeRoot({ banks = parseBanksResponse(BANKS), lastOk = new Date().toISOString().slice(0, 10) } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tingqr-banks-'))
  const dir = join(root, 'conformance', 'banks')
  mkdirSync(dir, { recursive: true })
  const write = (name, value) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + '\n')
  write('banks.json', { source: 'https://api.vietqr.io/v2/banks', fetchedAt: '2026-11-01', banks })
  write('bank-apps.json', CURATED)
  write('overrides.json', [])
  const checks = Object.fromEntries(CURATED.apps.map((a) => [a.android.package, { lastOk, last: lastOk ? 'ok' : 'unknown', checked: '2026-11-01' }]))
  write('play-checks.json', checks)
  return { root, dir }
}
export const snapshot = (dir) =>
  Object.fromEntries(
    ['banks.json', 'bank-apps.json', 'overrides.json', 'play-checks.json'].map((n) => [
      n,
      [readFileSync(join(dir, n), 'utf8'), statSync(join(dir, n)).mtimeMs],
    ]),
  )
