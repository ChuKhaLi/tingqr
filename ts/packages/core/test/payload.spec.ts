import {
  buildPayload,
  decodeKhqr,
  decodePromptPayQr,
  decodeVietQr,
  decodeVnpayQr,
  detect,
  getField,
  parsePayload,
  parseTlv,
  type Result,
} from '../src/index.js'

// vietnam-qr-pay README sample (MIT, https://github.com/xuannghia/vietnam-qr-pay)
const S = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'

function codes(r: ReturnType<typeof parsePayload>): string[] {
  return r.ok ? r.warnings.map((w) => w.code) : []
}

test('buildPayload appends 6304 and the CRC', () => {
  const fields = parseTlv(S).filter((f) => f.tag !== '63')
  expect(buildPayload(fields)).toBe(S)
})

test('parsePayload reads a valid payload without warnings', () => {
  const r = parsePayload(S)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.value.crc).toBe('AE9F')
  expect(r.value.raw).toBe(S)
  expect(r.value.fields.map((f) => f.tag)).toEqual(['00', '01', '38', '53', '58', '63'])
  expect(getField(r.value, '58')?.value).toBe('VN')
  expect(getField(r.value, '54')).toBeUndefined()
  expect(r.warnings).toEqual([])
})

test('parsePayload trims CRLF and spaces and warns', () => {
  for (const input of [S + '\r\n', '  ' + S, '\t' + S + ' ']) {
    const r = parsePayload(input)
    expect(r.ok, JSON.stringify(input)).toBe(true)
    expect(codes(r)).toEqual(['TRIMMED_WHITESPACE'])
    if (r.ok) expect(r.value.raw).toBe(S)
  }
})

test('parsePayload accepts a lowercase CRC and warns', () => {
  const r = parsePayload(S.slice(0, -4) + 'ae9f')
  expect(r.ok).toBe(true)
  expect(codes(r)).toEqual(['LOWERCASE_CRC'])
})

test('parsePayload reports CRC_MISMATCH for a wrong CRC', () => {
  const r = parsePayload(S.slice(0, -1) + '0')
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error.code).toBe('CRC_MISMATCH')
})

test('parsePayload reports CRC_MISSING without tag 63', () => {
  const r = parsePayload(S.slice(0, -8))
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error.code).toBe('CRC_MISSING')
})

test('parsePayload reports CRC_MISSING when tag 63 is not last', () => {
  const r = parsePayload(S + '0002AB')
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error.code).toBe('CRC_MISSING')
})

test('parsePayload wraps TLV errors into a Result instead of throwing', () => {
  const r = parsePayload('0002')
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error.code).toBe('TRUNCATED')
})

test('parsePayload rejects a duplicated top-level tag with DUPLICATE_TAG', () => {
  const fields = parseTlv(S).filter((f) => f.tag !== '63')
  const r = parsePayload(buildPayload([...fields, { tag: '58', value: 'TH' }]))
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['DUPLICATE_TAG', '58'])
})

test('parsePayload strips a UTF-8 BOM and no-break spaces around the payload and warns', () => {
  for (const input of ['﻿' + S, S + ' ', '﻿ ' + S + '\r\n']) {
    const r = parsePayload(input)
    expect(r.ok, JSON.stringify(input)).toBe(true)
    expect(codes(r)).toEqual(['TRIMMED_WHITESPACE'])
    if (r.ok) expect(r.value.raw).toBe(S)
  }
})

test('parsePayload reports CRC_MISSING when tag 63 does not hold 4 hex digits', () => {
  // '6302😀😀': two characters that are four UTF-16 units, so a .length check would wrongly pass it.
  for (const tail of ['6302😀😀', '6304GGGG', '6304AE9-']) {
    const r = parsePayload(S.slice(0, -8) + tail)
    expect(r.ok, tail).toBe(false)
    if (!r.ok) expect(r.error.code, tail).toBe('CRC_MISSING')
  }
})

test('parsePayload reports CRC_MISSING when the last field holds 4 hex digits but is not tag 63', () => {
  const r = parsePayload(S + '0004ABCD')
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error.code).toBe('CRC_MISSING')
})

test('parsePayload reports CRC_MISSING when tag 63 holds more than 4 characters', () => {
  for (const tail of ['6305XAE9F', '6305AE9FX']) {
    const r = parsePayload(S.slice(0, -8) + tail)
    expect(r.ok, tail).toBe(false)
    if (!r.ok) expect(r.error.code, tail).toBe('CRC_MISSING')
  }
})

describe('readers given a non-string', () => {
  const readers = { parsePayload, decodeVietQr, decodeVnpayQr, decodePromptPayQr, decodeKhqr, detect }
  for (const [name, read] of Object.entries(readers)) {
    for (const bad of [null, undefined, 42]) {
      it(`${name}(${String(bad)}) returns INVALID_VALUE without throwing`, () => {
        const r = (read as (x: never) => Result<unknown>)(bad as never)
        expect(r.ok).toBe(false)
        if (!r.ok) {
          expect(r.error.code).toBe('INVALID_VALUE')
          expect(r.error.tag).toBeUndefined()
        }
      })
    }
  }
})
