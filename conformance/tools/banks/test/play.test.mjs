import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyPlay, updatePlayChecks } from '../lib/play.mjs'

const PKG = 'com.mbmobile'
const PAGE = 'https://play.google.com/store/apps/details?id=com.mbmobile&hl=en'

test('a 200 Play page that names the package is ok', () => {
  assert.equal(classifyPlay({ status: 200, url: PAGE, body: `<html>... id=${PKG} ...</html>` }, PKG), 'ok')
})

test('404 means the package is gone', () => {
  assert.equal(classifyPlay({ status: 404, url: PAGE, body: '' }, PKG), 'gone')
})

test('rate limiting and server errors are unknown', () => {
  assert.equal(classifyPlay({ status: 429, url: PAGE, body: '' }, PKG), 'unknown')
  assert.equal(classifyPlay({ status: 503, url: PAGE, body: '' }, PKG), 'unknown')
})

test('a 200 that landed on the consent page is unknown', () => {
  assert.equal(classifyPlay({ status: 200, url: 'https://consent.google.com/m?continue=x', body: PKG }, PKG), 'unknown')
})

test('a 200 Play page that does not name the package is unknown', () => {
  assert.equal(classifyPlay({ status: 200, url: PAGE, body: '<html>sign in</html>' }, PKG), 'unknown')
})

test('ok records the date as lastOk', () => {
  assert.deepEqual(updatePlayChecks({}, PKG, 'ok', '2026-11-20'), {
    [PKG]: { lastOk: '2026-11-20', last: 'ok', checked: '2026-11-20' },
  })
})

test('gone and unknown keep the previous lastOk', () => {
  const prev = { [PKG]: { lastOk: '2026-10-01', last: 'ok', checked: '2026-10-01' } }
  for (const result of ['gone', 'unknown']) {
    assert.deepEqual(updatePlayChecks(prev, PKG, result, '2026-11-20')[PKG], {
      lastOk: '2026-10-01',
      last: result,
      checked: '2026-11-20',
    })
  }
  assert.equal(prev[PKG].last, 'ok')
})

test('a first check that is not ok has no lastOk', () => {
  assert.deepEqual(updatePlayChecks({}, PKG, 'unknown', '2026-11-20')[PKG], {
    lastOk: null,
    last: 'unknown',
    checked: '2026-11-20',
  })
})
