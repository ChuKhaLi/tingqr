import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { crc16 } from '../crc.mjs'
import { oracleExpected } from '../oracle-map.mjs'

const vector = (scheme, id) =>
  JSON.parse(readFileSync(new URL(`../../../vectors/${scheme}/${id}.json`, import.meta.url), 'utf8'))

// The README vectors' `expected` was written by hand; the mapping must reproduce it from the oracle.
for (const [scheme, id, missing] of [
  ['vietqr', 'vietqr-readme-sample', []],
  ['vietqr', 'vietqr-readme-purpose', []],
  ['vietqr', 'vietqr-readme-momo-new', []],
  ['vietqr', 'vietqr-readme-momo-old', []],
  ['vietqr', 'vietqr-readme-zalopay', []],
  ['vietqr', 'vietqr-card', []],
  ['vnpay', 'vnpay-readme-cellphones', ['52', '60']],
  ['vnpay', 'vnpay-bill-mobile', ['52', '60']],
]) {
  test(`oracleExpected reproduces ${id}`, () => {
    const v = vector(scheme, id)
    const r = oracleExpected(v.payload)
    assert.equal(r.scheme, scheme)
    assert.deepEqual(r.missing, missing)
    assert.deepEqual(r.expected, v.expected)
  })
}

test('a VietQR with an unknown tag 26 keeps it in extraFields', () => {
  const v = vector('vietqr', 'vietqr-readme-zalopay')
  const body = v.payload.slice(0, -8).replace('5802VN', '5802VN2604ABCD') + '6304'
  const r = oracleExpected(body + crc16(body))
  assert.deepEqual(r.expected.extraFields, { 26: 'ABCD' })
})

test('a payload the oracle rejects (bad CRC) throws', () => {
  const v = vector('vietqr', 'vietqr-readme-sample')
  assert.throws(() => oracleExpected(v.payload.slice(0, -4) + 'FFFF'), /rejects/)
})

test('a payload that is neither VietQR nor VNPAY throws', () => {
  assert.throws(() => oracleExpected('000201010211' + '29100006PROMPT' + '6304FFFF'))
})
