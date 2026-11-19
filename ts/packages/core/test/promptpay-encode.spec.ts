import { decodePromptPayQr, encodePromptPayQr, TingQrError, type PromptPayInput } from '../src/index.js'
import { encodePromptPayQr as encodeFromSubpath } from '../src/promptpay.js'

// thai-qr-payment@1.2.0 output for mobile 0812223333 (conformance/vectors/promptpay/promptpay-encode-mobile.json).
const MOBILE = '00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF'
// Same, amount 30 (promptpay-encode-mobile-amount.json).
const MOBILE_30 = '00020101021229370016A000000677010111011300668122233335303764540530.005802TH6304F9BA'
// dtinth/promptpay-qr@v0.5.0 index.test.js (MIT): mobile 0801234567, tags 58 before 53.
const DT_MOBILE = '00020101021129370016A000000677010111011300668012345675802TH530376463046197'

function errorOf(input: unknown): [string, string | undefined] {
  try {
    encodePromptPayQr(input as PromptPayInput)
  } catch (e) {
    if (e instanceof TingQrError) return [e.code, e.tag]
    throw e
  }
  throw new Error('expected encodePromptPayQr to throw')
}

test.each(['0812223333', '+66 81-222-3333', '66812223333', '0066812223333', '081-222-3333'])(
  'mobile %s encodes as 0066 + 9 digits',
  (mobile) => {
    expect(encodePromptPayQr({ target: { mobile } })).toBe(MOBILE)
  },
)

test.each(['08122233', '081222333344', '1812223333', '6681222333', '0166812223333', ''])('mobile %s is rejected', (mobile) => {
  expect(errorOf({ target: { mobile } })).toEqual(['INVALID_VALUE', '29.01'])
})

test.each([30, '30', '30.00', '30.0'])('amount %s is written 30.00', (amount) => {
  expect(encodePromptPayQr({ target: { mobile: '0812223333' }, amount })).toBe(MOBILE_30)
})

test('amounts always get two decimals and keep their digits', () => {
  const amount = (a: number | string) => decodePromptPayQr(encodePromptPayQr({ target: { mobile: '0812223333' }, amount: a }))
  expect(amount(4.2)).toMatchObject({ value: { amount: '4.20' } })
  expect(amount('0.01')).toMatchObject({ value: { amount: '0.01' } })
  expect(amount(9999999999.99)).toMatchObject({ value: { amount: '9999999999.99' } })
  expect(amount('0001.5')).toMatchObject({ value: { amount: '1.50' } })
  expect(amount('0.5')).toMatchObject({ value: { amount: '0.50' } })
})

test.each([0, '0', '0.00', -1, '-1', 1.234, '1.234', 0.1 + 0.2, 10000000000, '10000000000', 'abc', '1.', '.5', NaN, Infinity, 1e21])(
  'amount %s is rejected',
  (amount) => {
    expect(errorOf({ target: { mobile: '0812223333' }, amount })).toEqual(['INVALID_VALUE', '54'])
  },
)

test('an empty or missing amount means a static QR', () => {
  expect(encodePromptPayQr({ target: { mobile: '0812223333' }, amount: '' })).toBe(MOBILE)
  expect(encodePromptPayQr({ target: { mobile: '0812223333' }, amount: undefined })).toBe(MOBILE)
})

test('a non-string, non-number amount is rejected', () => {
  expect(errorOf({ target: { mobile: '0812223333' }, amount: true })).toEqual(['INVALID_VALUE', '54'])
})

test('tingqr and dtinth write the same fields in a different order', () => {
  const ours = encodePromptPayQr({ target: { mobile: '0801234567' } })
  expect(ours).not.toBe(DT_MOBILE)
  expect(decodePromptPayQr(ours, { mode: 'strict' })).toEqual(decodePromptPayQr(DT_MOBILE, { mode: 'strict' }))
})

test.each([
  [{ nationalId: '111111111111' }, '29.02'],
  [{ nationalId: '11111111111111' }, '29.02'],
  [{ nationalId: '1-1111-11111-11-1' }, '29.02'],
  [{ eWallet: '01234567890123' }, '29.03'],
  [{ eWallet: '01234567890123A' }, '29.03'],
  [{ billerId: '01122334455' }, '30.01'],
  [{ billerId: '01122334455667' }, '30.01'],
  [{ billerId: '0112233445566A' }, '30.01'],
])('target %o is rejected at %s', (target, tag) => {
  expect(errorOf({ target })).toEqual(['INVALID_VALUE', tag])
})

test.each([
  [{ mobile: 812223333 }, '29.01'],
  [{ nationalId: 1111111111111 }, '29.02'],
  [{ eWallet: null }, '29.03'],
  [{ billerId: undefined }, '30.01'],
  [{}, '29'],
  [{ email: 'x@y' }, '29'],
])('target %o with a wrong type or shape is rejected at %s', (target, tag) => {
  expect(errorOf({ target })).toEqual(['INVALID_VALUE', tag])
})

test('a missing target is rejected', () => {
  expect(errorOf({})).toEqual(['INVALID_VALUE', '29'])
})

test('bill payment with references; 13- and 15-digit billers', () => {
  const payload = encodePromptPayQr({ target: { billerId: '0112233445566', reference1: 'CUSTOMER001', reference2: 'INV001' } })
  expect(decodePromptPayQr(payload, { mode: 'strict' })).toMatchObject({
    ok: true,
    value: { kind: 'bill-payment', billerId: '0112233445566', reference1: 'CUSTOMER001', reference2: 'INV001' },
  })
  const fifteen = decodePromptPayQr(encodePromptPayQr({ target: { billerId: '099999999999990' } }), { mode: 'strict' })
  expect(fifteen).toMatchObject({ ok: true, value: { billerId: '099999999999990', subFields: { '01': '099999999999990' } } })
})

test('empty references are left out', () => {
  const payload = encodePromptPayQr({ target: { billerId: '0112233445566', reference1: '', reference2: '' } })
  expect(payload).toBe(encodePromptPayQr({ target: { billerId: '0112233445566' } }))
})

test.each([
  [{ reference1: '123456789012345678901' }, 'INVALID_VALUE', '30.02'],
  [{ reference2: '123456789012345678901' }, 'INVALID_VALUE', '30.03'],
  [{ reference1: 'CAFÉ' }, 'NON_ASCII', '30.02'],
  [{ reference2: 'tab\there' }, 'NON_ASCII', '30.03'],
  [{ reference1: 42 }, 'INVALID_VALUE', '30.02'],
])('reference %o is rejected', (refs, code, tag) => {
  expect(errorOf({ target: { billerId: '0112233445566', ...refs } })).toEqual([code, tag])
})

test('a 20-character reference is accepted', () => {
  const r = decodePromptPayQr(encodePromptPayQr({ target: { billerId: '0112233445566', reference1: '12345678901234567890' } }))
  expect(r).toMatchObject({ ok: true, value: { reference1: '12345678901234567890' } })
})

test('the ./promptpay subpath exports the same encoder', () => {
  expect(encodeFromSubpath).toBe(encodePromptPayQr)
})

test.each([
  [{ nationalId: 'A111111111111' }, '29.02'],
  [{ eWallet: 'A12345678901234' }, '29.03'],
])('an ID with a non-digit first character (%o) is rejected', (target, t) => {
  expect(errorOf({ target })).toEqual(['INVALID_VALUE', t])
})

test('leading zeros are removed without touching inner zeros', () => {
  const amount = (a: number | string) => decodePromptPayQr(encodePromptPayQr({ target: { mobile: '0812223333' }, amount: a }))
  expect(amount(100)).toMatchObject({ value: { amount: '100.00' } })
  expect(amount('00100.5')).toMatchObject({ value: { amount: '100.50' } })
})

test.each([[['30']], [{ toString: (): string => '30' }]])('an amount that is neither number nor string (%o) is rejected', (amount) => {
  expect(errorOf({ target: { mobile: '0812223333' }, amount })).toEqual(['INVALID_VALUE', '54'])
})
