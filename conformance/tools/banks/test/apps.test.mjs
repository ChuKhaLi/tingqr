import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { diffApps, parseDlRedirects, parseIntent } from '../lib/apps.mjs'

const redirects = JSON.parse(readFileSync(new URL('./fixtures/vietqr-dl-redirects.json', import.meta.url), 'utf8'))

test('parseIntent splits host, scheme and package and drops the fallback', () => {
  assert.deepEqual(
    parseIntent('intent://applink#Intent;scheme=tcb;package=vn.com.techcombank.bb.app;S.browser_fallback_url=https%3A%2F%2Fx;end'),
    { host: 'applink', scheme: 'tcb', package: 'vn.com.techcombank.bb.app' },
  )
  assert.deepEqual(parseIntent('intent://#Intent;scheme=mbbank;package=com.mbmobile;end'), {
    host: '',
    scheme: 'mbbank',
    package: 'com.mbmobile',
  })
  assert.equal(parseIntent('https://example.com'), null)
})

test('parseDlRedirects merges the Android intent and the iOS open link per app', () => {
  const apps = parseDlRedirects(redirects)
  assert.deepEqual(apps.find((a) => a.id === 'klb'), {
    id: 'klb',
    ios: { scheme: 'kienlongbankmobilebanking' },
    android: { host: 'ksbank.co', scheme: 'ksbank', package: 'com.sunshine.ksbank' },
  })
  assert.deepEqual(apps.find((a) => a.id === 'vib-2').android, {
    host: 'myvib2.com.vn/data',
    scheme: 'myvib2',
    package: 'com.vib.myvib2',
  })
})

const curated = [
  {
    id: 'mb',
    sources: [{ name: 'vietqr.io', ref: 'mb' }],
    ios: { scheme: 'mbbank' },
    android: { host: '', scheme: 'mbbank', package: 'com.mbmobile' },
  },
  {
    id: 'vib',
    sources: [{ name: 'vietqr.io', ref: 'vib-2' }],
    ios: { scheme: 'myvib2' },
    android: { host: 'myvib2.com.vn/data', scheme: 'myvib2', package: 'com.vib.myvib2' },
  },
]
const source = [
  { id: 'mb', ios: { scheme: 'mbbank' }, android: { host: '', scheme: 'mbbank', package: 'com.mbmobile' } },
  { id: 'vib-2', ios: { scheme: 'myvib2' }, android: { host: 'myvib2.com.vn/data', scheme: 'myvib2', package: 'com.vib.myvib2' } },
]

test('diffApps reports nothing when the curated list matches the source', () => {
  assert.deepEqual(diffApps(curated, source), [])
})

test('diffApps reports a new source app, a missing one, and scheme, package and host changes', () => {
  const changed = [
    { id: 'mb', ios: { scheme: 'mbbank2' }, android: { host: 'x', scheme: 'mbbank', package: 'com.mbmobile.new' } },
    { id: 'zzz', ios: { scheme: 'zzz' } },
  ]
  const kinds = diffApps(curated, changed).map((d) => `${d.appId}:${d.kind}`)
  assert.deepEqual(kinds.sort(), ['mb:host', 'mb:package', 'mb:scheme', 'vib:missing', 'zzz:new'])
})

test('diffApps skips vietqr.io apps listed as ignored', () => {
  const extra = [...source, { id: 'vab', ios: { scheme: 'vabmobilebanking' } }]
  assert.deepEqual(diffApps(curated, extra, { ignored: ['vab'] }), [])
  assert.deepEqual(diffApps(curated, extra).map((d) => `${d.appId}:${d.kind}`), ['vab:new'])
})

test('diffApps skips the fields an app marks with vietqrDiffers', () => {
  const lpb = [{ ...curated[0], vietqrDiffers: ['package'], android: { ...curated[0].android, package: 'com.mbmobile.new' } }]
  assert.deepEqual(diffApps(lpb, source.slice(0, 1)), [])
  lpb[0].vietqrDiffers = []
  assert.deepEqual(diffApps(lpb, source.slice(0, 1)).map((d) => d.kind), ['package'])
})

test('diffApps ignores curated apps without a vietqr.io reference', () => {
  const own = [...curated, { id: 'momo', sources: [{ name: 'qrviet', ref: 'MOMO' }], ios: { scheme: 'momo' } }]
  assert.deepEqual(diffApps(own, source), [])
})
