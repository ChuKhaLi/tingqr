import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { commonsLicense, iconUrl, manifestEntry, svgProblems } from '../lib/logos.mjs'

const commons = JSON.parse(readFileSync(new URL('./fixtures/commons-tpbank.json', import.meta.url), 'utf8'))

test('svgProblems accepts a plain SVG and one with in-document references', () => {
  assert.deepEqual(svgProblems('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>'), [])
  assert.deepEqual(
    svgProblems('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><g id="g1"/></defs><use href="#g1"/><use xlink:href="#g1"/></svg>'),
    [],
  )
})

const BAD = {
  script: '<svg><script>alert(1)</script></svg>',
  foreignObject: '<svg><foreignObject><div/></foreignObject></svg>',
  onload: '<svg onload="alert(1)"></svg>',
  'external href': '<svg><image href="https://x/a.png"/></svg>',
  'javascript xlink:href': '<svg><a xlink:href="javascript:alert(1)"><path/></a></svg>',
  'data href': '<svg><use href="data:image/svg+xml,x"/></svg>',
  'uppercase SCRIPT': '<svg><SCRIPT>x</SCRIPT></svg>',
  'onclick with spaces': '<svg><g  onclick = "x"/></svg>',
  'external url() in style': '<svg><rect style="fill:url(https://x/p.svg#a)"/></svg>',
}
for (const [name, svg] of Object.entries(BAD)) {
  test(`svgProblems flags ${name}`, () => {
    assert.ok(svgProblems(svg).length > 0, svg)
  })
}

test('svgProblems allows url(#id) in style', () => {
  assert.deepEqual(svgProblems('<svg><rect style="fill:url(#grad)"/><rect fill="url(#g2)"/></svg>'), [])
})

test('the real TPBank file on Commons reads as PD-textlogo', () => {
  assert.equal(commonsLicense(commons), 'PD-textlogo')
})

test('a Commons file without a PD category reads as null', () => {
  const cc = structuredClone(commons)
  const page = Object.values(cc.query.pages)[0]
  page.categories = [{ ns: 14, title: 'Category:CC-BY-SA-4.0' }, { ns: 14, title: 'Category:SVG logos of banks in Vietnam' }]
  assert.equal(commonsLicense(cc), null)
})

test('PD simple is recognised', () => {
  const simple = structuredClone(commons)
  Object.values(simple.query.pages)[0].categories = [{ ns: 14, title: 'Category:PD simple' }]
  assert.equal(commonsLicense(simple), 'PD-simple')
})

test('a missing page reads as null', () => {
  assert.equal(commonsLicense({ query: { pages: { '-1': { title: 'File:x.svg', missing: '' } } } }), null)
})

test('manifestEntry records size and SHA-256 of the bytes', () => {
  const bytes = Buffer.from('hello')
  const e = manifestEntry({ file: 'logo/970423.svg', kind: 'logo', key: '970423', sourceUrl: 'https://u', pageUrl: 'https://p', license: 'PD-textlogo', fetched: '2026-11-21', bytes })
  assert.equal(e.bytes, 5)
  assert.equal(e.sha256, createHash('sha256').update(bytes).digest('hex'))
  assert.deepEqual(Object.keys(e), ['file', 'kind', 'key', 'sourceUrl', 'pageUrl', 'license', 'fetched', 'sha256', 'bytes'])
})

test('iconUrl takes the appLogo vietqr.io lists for the app, iOS first, else Android', () => {
  const lists = {
    ios: { apps: [{ appId: 'vib-2', appLogo: 'https://cdn.vietqr.io/bank-app-icon/vib-2-ios.webp' }, { appId: 'mbv', appLogo: 'https://cdn.vietqr.io/bank-app-icon/oceanbank-ios.webp' }] },
    android: { apps: [{ appId: 'nab', appLogo: 'https://cdn.vietqr.io/bank-app-icon/nab-android.webp' }, { appId: 'vib-2', appLogo: 'https://cdn.vietqr.io/bank-app-icon/vib-2-android.webp' }] },
  }
  const app = (id, ref) => ({ id, sources: [{ name: 'vietqr.io', ref }] })
  assert.equal(iconUrl(app('vib', 'vib-2'), lists), 'https://cdn.vietqr.io/bank-app-icon/vib-2-ios.webp')
  assert.equal(iconUrl(app('mbv', 'mbv'), lists), 'https://cdn.vietqr.io/bank-app-icon/oceanbank-ios.webp')
  assert.equal(iconUrl(app('nab', 'nab'), lists), 'https://cdn.vietqr.io/bank-app-icon/nab-android.webp')
  assert.equal(iconUrl({ id: 'momo', sources: [{ name: 'qrviet', ref: 'MOMO' }] }, lists), null)
  assert.equal(iconUrl(app('gone', 'gone'), lists), null)
})
