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
  const strict = decodeVietQr(p, { mode: 'strict' })
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

test('a service code naming an Object.prototype property is INVALID_VALUE, not a crash or a match', () => {
  for (const code of ['constructor', 'toString', '__proto__']) {
    const p = rebuild((f) => f.map((x) => (x.tag === '38' ? { tag: '38', value: x.value.replace('0208QRIBFTTA', field('02', code)) } : x)))
    const r = decodeVietQr(p)
    expect(r.ok, code).toBe(false)
    if (!r.ok) expect([r.error.code, r.error.tag], code).toEqual(['INVALID_VALUE', '38.02'])
  }
})

test('a duplicated tag inside template 38.01 is DUPLICATE_TAG in both modes', () => {
  const merchant =
    field('00', 'A000000727') +
    field('01', field('00', '970416') + field('01', '257678859') + field('01', '999999999')) +
    field('02', 'QRIBFTTA')
  const p = rebuild((f) => f.map((x) => (x.tag === '38' ? { tag: '38', value: merchant } : x)))
  for (const mode of ['strict', 'lenient'] as const) {
    const r = decodeVietQr(p, { mode })
    expect(r.ok, mode).toBe(false)
    if (!r.ok) expect([r.error.code, r.error.tag], mode).toEqual(['DUPLICATE_TAG', '38.01.01'])
  }
})

test('a duplicated sub-tag inside template 62 is DUPLICATE_TAG', () => {
  const p = rebuild((f) => [...f, { tag: '62', value: field('08', 'A') + field('08', 'B') }])
  const r = decodeVietQr(p)
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['DUPLICATE_TAG', '62.08'])
})

function withMerchant(merchant: string): string {
  return rebuild((f) => f.map((x) => (x.tag === '38' ? { tag: '38', value: merchant } : x)))
}

test('missing 38.01 entirely is MISSING_TAG on 38.01', () => {
  const r = decodeVietQr(withMerchant(field('00', 'A000000727') + field('02', 'QRIBFTTA')))
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '38.01'])
})

test('missing bank BIN in 38.01 is MISSING_TAG on 38.01', () => {
  const r = decodeVietQr(withMerchant(field('00', 'A000000727') + field('01', field('01', '257678859')) + field('02', 'QRIBFTTA')))
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '38.01'])
})

test('missing service code is MISSING_TAG on 38.02', () => {
  const r = decodeVietQr(withMerchant(field('00', 'A000000727') + field('01', field('00', '970416') + field('01', '257678859'))))
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '38.02'])
})

test('tag 38 without a GUID is UNSUPPORTED_SCHEME', () => {
  const r = decodeVietQr(withMerchant(field('01', field('00', '970416') + field('01', '257678859')) + field('02', 'QRIBFTTA')))
  expect(!r.ok && r.error.code).toBe('UNSUPPORTED_SCHEME')
})

test('payload format indicator other than 01 is INVALID_VALUE on 00', () => {
  const r = decodeVietQr(rebuild((f) => f.map((x) => (x.tag === '00' ? { tag: '00', value: '02' } : x))))
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['INVALID_VALUE', '00'])
})

test('missing tag 00 is INVALID_VALUE on 00; missing tag 01 is MISSING_TAG on 01', () => {
  const no00 = decodeVietQr(rebuild((f) => f.filter((x) => x.tag !== '00')))
  expect(!no00.ok && [no00.error.code, no00.error.tag]).toEqual(['INVALID_VALUE', '00'])
  const no01 = decodeVietQr(rebuild((f) => f.filter((x) => x.tag !== '01')))
  expect(!no01.ok && [no01.error.code, no01.error.tag]).toEqual(['MISSING_TAG', '01'])
})

test('merchant tags 52, 59, 60 are returned; tag 62 without 08 gives no purpose', () => {
  const p = rebuild((f) => [
    ...f,
    { tag: '52', value: '5812' },
    { tag: '59', value: 'TINGQR SHOP' },
    { tag: '60', value: 'HA NOI' },
    { tag: '62', value: field('05', 'REF123') },
  ])
  const r = decodeVietQr(p)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.value.merchantCategoryCode).toBe('5812')
  expect(r.value.merchantName).toBe('TINGQR SHOP')
  expect(r.value.merchantCity).toBe('HA NOI')
  expect(r.value.additionalData).toStrictEqual({ '05': 'REF123' })
  expect('purpose' in r.value).toBe(false)
})

test('a duplicated tag directly inside template 38 is DUPLICATE_TAG on 38.00', () => {
  const r = decodeVietQr(withMerchant(field('00', 'A000000727') + field('00', 'A000000727') + field('01', field('00', '970416') + field('01', '257678859')) + field('02', 'QRIBFTTA')))
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['DUPLICATE_TAG', '38.00'])
})

// vietnam-qr-pay README (MIT) MoMo "old account" example — generated by that library, not a real app capture.
const MOMO_OLD = '00020101021138620010A00000072701320006970454011899MM24011M348750800208QRIBFTTA53037045802VN62190515MOMOW2W3487508080030466304EBC8'

test('uninterpreted top-level tags are returned in extraFields', () => {
  const r = decodeVietQr(MOMO_OLD)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.value.extraFields).toStrictEqual({ '80': '046' })
  expect(r.value.additionalData).toStrictEqual({ '05': 'MOMOW2W34875080' })
})

test('a payload without extra tags has no extraFields property', () => {
  const r = decodeVietQr(S)
  expect(r.ok && 'extraFields' in r.value).toBe(false)
})

test('tags 26 and 80 both land in extraFields, template values unsplit', () => {
  const p = rebuild((f) => [...f, { tag: '26', value: field('00', 'ZP') + field('01', 'X') }, { tag: '80', value: '046' }])
  const r = decodeVietQr(p)
  expect(r.ok && r.value.extraFields).toStrictEqual({ '26': '0002ZP0101X', '80': '046' })
})

test('default mode is lenient: missing tag 58 reads with a warning; strict must be asked for', () => {
  const p = rebuild((f) => f.filter((x) => x.tag !== '58'))
  const byDefault = decodeVietQr(p)
  expect(byDefault.ok).toBe(true)
  expect(byDefault.ok && byDefault.warnings.map((w) => w.code)).toEqual(['MISSING_OPTIONAL_TAG'])
  expect(decodeVietQr(p, { mode: 'strict' }).ok).toBe(false)
})

describe('decodeVietQr with no tag 01', () => {
  // conformance/vectors/vietqr/vietqr-missing-poi.json
  const payload = '00020138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN63043B24'
  for (const mode of ['strict', 'lenient'] as const) {
    test(`${mode}: MISSING_TAG 01 with a message that names the tag`, () => {
      const r = decodeVietQr(payload, { mode })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '01'])
      expect(r.error.message).toBe('Tag 01 (point of initiation) is missing; expected 11 or 12.')
    })
  }
})
