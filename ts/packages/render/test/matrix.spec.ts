import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TingQrError } from '@tingqr/core'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { toMatrix } from '../src/index.js'

const ALNUM = JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'vectors', 'render', 'render-vietqr-alnum.json'), 'utf8')).input.text

function thrown(fn: () => unknown): TingQrError {
  try {
    fn()
  } catch (e) {
    if (e instanceof TingQrError) return e
    throw e
  }
  throw new Error('expected a TingQrError')
}

test.each([ALNUM, 'A'])('the default ECC is M (%#)', (t) => {
  expect(toMatrix(t)).toEqual(toMatrix(t, { ecc: 'M' }))
})

test('boostEcc is on by default and reports the ECC actually used', () => {
  expect(toMatrix('A').ecc).toBe('H')
  expect(toMatrix('A', { boostEcc: false }).ecc).toBe('M')
})

test('size is 4 × version + 17', () => {
  const m = toMatrix('A', { minVersion: 7 })
  expect(m.size).toBe(4 * 7 + 17)
  expect(m.modules).toHaveLength(m.size)
  expect(m.modules.every((row) => row.length === m.size)).toBe(true)
})

test('each call returns a fresh modules array', () => {
  const a = toMatrix('A')
  a.modules[0]![0] = !a.modules[0]![0]
  expect(toMatrix('A').modules[0]![0]).toBe(!a.modules[0]![0])
})

test('text too long is INVALID_VALUE with a clear message, never a RangeError', () => {
  const e = thrown(() => toMatrix('a'.repeat(200), { maxVersion: 5 }))
  expect(e.code).toBe('INVALID_VALUE')
  expect(e.message).toContain('too long')
  expect('tag' in e).toBe(false)
})

test.each([undefined, 42, null])('text %o that is not a string is INVALID_VALUE', (text) => {
  expect(thrown(() => toMatrix(text as unknown as string)).code).toBe('INVALID_VALUE')
})

test.each([
  [{ boostEcc: 'yes' }],
  [{ minVersion: 1.5 }],
  [{ maxVersion: Number.NaN }],
  [{ mask: -1 }],
  [{ ecc: 'm' }],
])('option %o is INVALID_VALUE', (options) => {
  expect(thrown(() => toMatrix('A', options as never)).code).toBe('INVALID_VALUE')
})

test('explicit defaults give the same matrix as no options', () => {
  expect(toMatrix(ALNUM, { ecc: 'M', boostEcc: true, minVersion: 1, maxVersion: 40 })).toEqual(toMatrix(ALNUM))
})

test.each([
  [{ mask: 8 }, /mask/],
  [{ maxVersion: 41 }, /maxVersion/],
  [{ minVersion: 5, maxVersion: 4 }, /minVersion must not exceed maxVersion/],
])('option %o is rejected by tingqr with a message naming it', (options, message) => {
  expect(() => toMatrix('A', options)).toThrow(message)
})

test('minVersion equal to maxVersion pins the version', () => {
  expect(toMatrix('A', { minVersion: 3, maxVersion: 3 }).version).toBe(3)
})

test.each(['\uD800', 'a\uDC00b', '😀'.slice(0, 1)])('text with an unpaired surrogate (%#) is INVALID_VALUE, not a URIError', (text) => {
  const e = thrown(() => toMatrix(text))
  expect(e.code).toBe('INVALID_VALUE')
  expect(e.message).toContain('surrogate')
})
