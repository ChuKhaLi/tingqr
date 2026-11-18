import { TingQrError, encodeVietQr } from '../src/index.js'
import { encodeVietQr as encodeFromSubpath } from '../src/vietqr.js'

// vietnam-qr-pay README sample (MIT, https://github.com/xuannghia/vietnam-qr-pay) — produced outside tingqr.
const S = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'
const BASE = { bankBin: '970422', accountNumber: '0123456789' }

function thrown(fn: () => unknown): TingQrError {
  try {
    fn()
  } catch (e) {
    if (e instanceof TingQrError) return e
    throw e
  }
  throw new Error('expected TingQrError, nothing was thrown')
}

test('encodes the published static account sample byte for byte', () => {
  expect(encodeVietQr({ bankBin: '970416', accountNumber: '257678859' })).toBe(S)
})

test('card service uses QRIBFTTC', () => {
  const p = encodeVietQr({ ...BASE, service: 'card' })
  expect(p).toContain('0208QRIBFTTC')
  expect(p).not.toContain('QRIBFTTA')
})

test('amount as number or string gives the same dynamic QR', () => {
  const a = encodeVietQr({ ...BASE, amount: 50000 })
  expect(encodeVietQr({ ...BASE, amount: '50000' })).toBe(a)
  expect(a).toContain('010212')
  expect(a).toContain('540550000')
})

test('no amount gives a static QR without tag 54', () => {
  const p = encodeVietQr(BASE)
  expect(p).toContain('010211')
  expect(p).not.toContain('530370454')
  expect(p).toContain('53037045802VN')
})

test('purpose with Vietnamese accents throws NON_ASCII pointing at removeVietnameseAccents', () => {
  const e = thrown(() => encodeVietQr({ ...BASE, purpose: 'Chuyển tiền' }))
  expect(e.code).toBe('NON_ASCII')
  expect(e.tag).toBe('62')
  expect(e.message).toContain('removeVietnameseAccents')
})

test('purpose of 95 characters fits, 96 throws FIELD_TOO_LONG on tag 62', () => {
  expect(encodeVietQr({ ...BASE, purpose: 'A'.repeat(95) })).toContain('6299' + '0895' + 'A'.repeat(95))
  const e = thrown(() => encodeVietQr({ ...BASE, purpose: 'A'.repeat(96) }))
  expect(e.code).toBe('FIELD_TOO_LONG')
  expect(e.tag).toBe('62')
})

test.each([0, -1, 1.5, '50,000', '1'.repeat(14), '01000'])('amount %j throws INVALID_VALUE on tag 54', (amount) => {
  const e = thrown(() => encodeVietQr({ ...BASE, amount }))
  expect(e.code).toBe('INVALID_VALUE')
  expect(e.tag).toBe('54')
})

test('empty-string amount is treated as no amount', () => {
  expect(encodeVietQr({ ...BASE, amount: '' })).toBe(encodeVietQr(BASE))
})

test('amount of 13 digits is accepted', () => {
  expect(encodeVietQr({ ...BASE, amount: '1'.repeat(13) })).toContain('5413' + '1'.repeat(13))
})

test.each([
  [{ bankBin: '97042', accountNumber: '0123456789' }],
  [{ bankBin: '970422', accountNumber: '0123-456' }],
  [{ bankBin: '970422', accountNumber: '12' }],
])('bad bank BIN or account %j throws INVALID_VALUE on tag 38', (input) => {
  const e = thrown(() => encodeVietQr(input))
  expect(e.code).toBe('INVALID_VALUE')
  expect(e.tag).toBe('38')
})

test('the @tingqr/core/vietqr entry exports the same function', () => {
  expect(encodeFromSubpath).toBe(encodeVietQr)
})

test.each([
  [{ bankBin: 970422 as unknown as string, accountNumber: '0123456789' }, '38'],
  [{ bankBin: '970422', accountNumber: 123456789 as unknown as string }, '38'],
  [{ bankBin: '970422', accountNumber: '0123456789', purpose: 123 as unknown as string }, '62'],
  [{ bankBin: '970422', accountNumber: '0123456789', service: 'wallet' as never }, '38'],
  [{ bankBin: '970422', accountNumber: '0123456789', service: 'toString' as never }, '38'],
  [{ bankBin: '970422', accountNumber: '0123456789', amount: true as never }, '54'],
])('wrongly typed input %j throws INVALID_VALUE, not TypeError', (input, tag) => {
  const e = thrown(() => encodeVietQr(input))
  expect(e.code).toBe('INVALID_VALUE')
  expect(e.tag).toBe(tag)
})

test('empty-string purpose is treated as no purpose', () => {
  expect(encodeVietQr({ ...BASE, purpose: '' })).toBe(encodeVietQr(BASE))
})

test.each(['9704220', 'X970422', '970422 '])('bank BIN %j is rejected (exactly 6 digits)', (bankBin) => {
  expect(thrown(() => encodeVietQr({ ...BASE, bankBin })).code).toBe('INVALID_VALUE')
})
