import { buildPayload, decodeVietQr, encodeVietQr, field, parseTlv, type VietQrInput } from '../src/index.js'
import { decodeVietQr as decodeFromSubpath } from '../src/vietqr.js'

// vietnam-qr-pay README sample (MIT, https://github.com/xuannghia/vietnam-qr-pay)
const S = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'

/** Rebuild S with tag fields replaced/removed (CRC recomputed). */
function rebuild(edit: (fields: { tag: string; value: string }[]) => { tag: string; value: string }[]): string {
  return buildPayload(edit(parseTlv(S).filter((f) => f.tag !== '63')))
}

test('decodes the published sample in strict mode', () => {
  const r = decodeVietQr(S)
  expect(r).toStrictEqual({
    ok: true,
    warnings: [],
    value: {
      bankBin: '970416',
      accountNumber: '257678859',
      service: 'account',
      initiation: 'static',
      currency: '704',
      country: 'VN',
    },
  })
})

const INPUTS: VietQrInput[] = [
  { bankBin: '970422', accountNumber: '0123456789' },
  { bankBin: '970422', accountNumber: '9704220123456789', service: 'card', amount: 20000 },
  { bankBin: '970422', accountNumber: '0123456789', amount: 50000, purpose: 'TINGQR TEST' },
  { bankBin: '970415', accountNumber: '9876543210', amount: '10000', purpose: 'A'.repeat(95) },
  { bankBin: '970436', accountNumber: '1234567890', amount: '1234567890123' },
]

test.each(INPUTS)('decode(encode(x)) gives x back: %j', (input) => {
  const r = decodeVietQr(encodeVietQr(input))
  expect(r.ok).toBe(true)
  if (!r.ok) return
  const v = r.value
  expect(v.bankBin).toBe(input.bankBin)
  expect(v.accountNumber).toBe(input.accountNumber)
  expect(v.service).toBe(input.service ?? 'account')
  expect(v.amount).toBe(input.amount === undefined ? undefined : String(input.amount))
  expect(v.initiation).toBe(input.amount === undefined ? 'static' : 'dynamic')
  expect(v.purpose).toBe(input.purpose)
  if (input.purpose) expect(v.additionalData).toStrictEqual({ '08': input.purpose })
})

test('tag 54 is returned verbatim, including decimals', () => {
  const p = rebuild((f) => {
    const out = [...f]
    out.splice(4, 0, { tag: '54', value: '50000.00' })
    out[1] = { tag: '01', value: '12' }
    return out
  })
  const r = decodeVietQr(p)
  expect(r.ok && r.value.amount).toBe('50000.00')
})

test('missing tag 58: strict fails with MISSING_TAG, lenient defaults to VN and warns', () => {
  const p = rebuild((f) => f.filter((x) => x.tag !== '58'))
  const strict = decodeVietQr(p)
  expect(strict.ok).toBe(false)
  if (!strict.ok) {
    expect(strict.error.code).toBe('MISSING_TAG')
    expect(strict.error.tag).toBe('58')
  }
  const lenient = decodeVietQr(p, { mode: 'lenient' })
  expect(lenient.ok).toBe(true)
  if (!lenient.ok) return
  expect(lenient.value.country).toBe('VN')
  expect(lenient.warnings.map((w) => [w.code, w.tag])).toEqual([['MISSING_OPTIONAL_TAG', '58']])
})

test('a different GUID in tag 38 is UNSUPPORTED_SCHEME', () => {
  const p = rebuild((f) =>
    f.map((x) => (x.tag === '38' ? { tag: '38', value: x.value.replace('A000000727', 'A000000775') } : x)),
  )
  const r = decodeVietQr(p)
  expect(!r.ok && r.error.code).toBe('UNSUPPORTED_SCHEME')
})

test('no tag 38 at all is UNSUPPORTED_SCHEME', () => {
  const r = decodeVietQr(rebuild((f) => f.filter((x) => x.tag !== '38')))
  expect(!r.ok && r.error.code).toBe('UNSUPPORTED_SCHEME')
})

test('unknown service code is INVALID_VALUE on 38.02', () => {
  const p = rebuild((f) => f.map((x) => (x.tag === '38' ? { tag: '38', value: x.value.replace('QRIBFTTA', 'QRIBFTTX') } : x)))
  const r = decodeVietQr(p)
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['INVALID_VALUE', '38.02'])
})

test('missing account number is MISSING_TAG on 38.01', () => {
  const merchant = field('00', 'A000000727') + field('01', field('00', '970416')) + field('02', 'QRIBFTTA')
  const r = decodeVietQr(rebuild((f) => f.map((x) => (x.tag === '38' ? { tag: '38', value: merchant } : x))))
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '38.01'])
})

test('bad point of initiation is INVALID_VALUE', () => {
  const r = decodeVietQr(rebuild((f) => f.map((x) => (x.tag === '01' ? { tag: '01', value: '13' } : x))))
  expect(!r.ok && r.error.code).toBe('INVALID_VALUE')
})

test('CRC errors pass through; trailing newline is accepted with a warning', () => {
  const bad = decodeVietQr(S.slice(0, -1) + '0')
  expect(!bad.ok && bad.error.code).toBe('CRC_MISMATCH')
  const nl = decodeVietQr(S + '\n')
  expect(nl.ok).toBe(true)
  if (nl.ok) expect(nl.warnings.map((w) => w.code)).toEqual(['TRIMMED_WHITESPACE'])
})

test('the @tingqr/core/vietqr entry exports the same decode function', () => {
  expect(decodeFromSubpath).toBe(decodeVietQr)
})
