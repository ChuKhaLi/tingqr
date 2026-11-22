import { buildPayload, decodeVietQr, decodeVnpayQr, field, parseTlv } from '../src/index.js'
import { decodeVnpayQr as decodeFromSubpath } from '../src/vnpay.js'

// vietnam-qr-pay README (MIT): a public shop QR (CellphoneS) shown in that README.
const V =
  '00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685'
// vietnam-qr-pay README (MIT) VietQR sample.
const S_VIETQR = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'

function rebuild(edit: (fields: { tag: string; value: string }[]) => { tag: string; value: string }[]): string {
  return buildPayload(edit(parseTlv(V).filter((f) => f.tag !== '63')))
}

test('the README VNPAY QR fails strict mode on missing tag 52', () => {
  const r = decodeVnpayQr(V, { mode: 'strict' })
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '52'])
})

test('the README VNPAY QR reads in lenient mode with warnings for 52 and 60', () => {
  const r = decodeVnpayQr(V, { mode: 'lenient' })
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.value).toStrictEqual({
    merchantId: '0105313144',
    initiation: 'static',
    amount: '21090000',
    currency: '704',
    country: 'VN',
    merchantName: 'CELLPHONES',
    additionalData: { '03': 'CPSHN ONLINE', '05': '02190806161312785', '07': 'ONLHN', '08': 'CellphoneS' },
    store: 'CPSHN ONLINE',
    reference: '02190806161312785',
    terminal: 'ONLHN',
    purpose: 'CellphoneS',
  })
  expect(r.warnings.map((w) => [w.code, w.tag])).toEqual([
    ['MISSING_OPTIONAL_TAG', '52'],
    ['MISSING_OPTIONAL_TAG', '60'],
  ])
})

test('a VNPAY QR with 52, 59 and 60 reads in strict mode without warnings', () => {
  const r = decodeVnpayQr(rebuild((f) => [...f, { tag: '52', value: '5732' }, { tag: '60', value: 'HA NOI' }]))
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.warnings).toEqual([])
  expect(r.value.merchantCategoryCode).toBe('5732')
  expect(r.value.merchantCity).toBe('HA NOI')
})

test('each sub-tag 62.01 … 62.08 maps to its named field', () => {
  const sub = ['01', '02', '03', '04', '05', '06', '07', '08'].map((t) => field(t, 'V' + t)).join('')
  const r = decodeVnpayQr(rebuild((f) => f.map((x) => (x.tag === '62' ? { tag: '62', value: sub } : x))), { mode: 'lenient' })
  expect(r.ok).toBe(true)
  if (!r.ok) return
  const v = r.value
  expect([v.billNumber, v.mobileNumber, v.store, v.loyaltyNumber, v.reference, v.customerLabel, v.terminal, v.purpose]).toEqual([
    'V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08',
  ])
})

test('missing 53 and 58 in lenient mode default to 704 and VN, in tag order with 52 and 60', () => {
  const r = decodeVnpayQr(rebuild((f) => f.filter((x) => x.tag !== '53' && x.tag !== '58')), { mode: 'lenient' })
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect([r.value.currency, r.value.country]).toEqual(['704', 'VN'])
  expect(r.warnings.map((w) => w.tag)).toEqual(['52', '53', '58', '60'])
})

test('missing 59 is MISSING_TAG in strict mode and a warning without default in lenient mode', () => {
  const p = rebuild((f) => [...f.filter((x) => x.tag !== '59'), { tag: '52', value: '5732' }, { tag: '60', value: 'HA NOI' }])
  const strict = decodeVnpayQr(p, { mode: 'strict' })
  expect(!strict.ok && [strict.error.code, strict.error.tag]).toEqual(['MISSING_TAG', '59'])
  const lenient = decodeVnpayQr(p, { mode: 'lenient' })
  expect(lenient.ok && 'merchantName' in lenient.value).toBe(false)
  expect(lenient.ok && lenient.warnings.map((w) => w.tag)).toEqual(['59'])
})

test('decoding with the wrong scheme function is UNSUPPORTED_SCHEME both ways', () => {
  const a = decodeVnpayQr(S_VIETQR, { mode: 'lenient' })
  expect(!a.ok && a.error.code).toBe('UNSUPPORTED_SCHEME')
  const b = decodeVietQr(V, { mode: 'lenient' })
  expect(!b.ok && b.error.code).toBe('UNSUPPORTED_SCHEME')
})

test('missing 26.01 is MISSING_TAG on 26.01 in both modes', () => {
  const p = rebuild((f) => f.map((x) => (x.tag === '26' ? { tag: '26', value: field('00', 'A000000775') } : x)))
  for (const mode of ['strict', 'lenient'] as const) {
    const r = decodeVnpayQr(p, { mode })
    expect(!r.ok && [r.error.code, r.error.tag], mode).toEqual(['MISSING_TAG', '26.01'])
  }
})

test('other sub-tags of 26 are returned in providerData; GUID compared case-insensitively', () => {
  const p = rebuild((f) =>
    f.map((x) => (x.tag === '26' ? { tag: '26', value: field('00', 'a000000775') + field('01', '0105313144') + field('02', 'XYZ') } : x)),
  )
  const r = decodeVnpayQr(p, { mode: 'lenient' })
  expect(r.ok && r.value.providerData).toStrictEqual({ '02': 'XYZ' })
})

test('duplicated 62.07 is DUPLICATE_TAG', () => {
  const p = rebuild((f) => f.map((x) => (x.tag === '62' ? { tag: '62', value: field('07', 'A') + field('07', 'B') } : x)))
  const r = decodeVnpayQr(p, { mode: 'lenient' })
  expect(!r.ok && [r.error.code, r.error.tag]).toEqual(['DUPLICATE_TAG', '62.07'])
})

test('bad 00 or 01 is INVALID_VALUE; tag 01 = 12 is dynamic', () => {
  const bad00 = decodeVnpayQr(rebuild((f) => f.map((x) => (x.tag === '00' ? { tag: '00', value: '02' } : x))), { mode: 'lenient' })
  expect(!bad00.ok && [bad00.error.code, bad00.error.tag]).toEqual(['INVALID_VALUE', '00'])
  const bad01 = decodeVnpayQr(rebuild((f) => f.map((x) => (x.tag === '01' ? { tag: '01', value: '13' } : x))), { mode: 'lenient' })
  expect(!bad01.ok && [bad01.error.code, bad01.error.tag]).toEqual(['INVALID_VALUE', '01'])
  const dyn = decodeVnpayQr(rebuild((f) => f.map((x) => (x.tag === '01' ? { tag: '01', value: '12' } : x))), { mode: 'lenient' })
  expect(dyn.ok && dyn.value.initiation).toBe('dynamic')
})

test('unknown top-level tags are returned in extraFields', () => {
  const r = decodeVnpayQr(rebuild((f) => [...f, { tag: '80', value: 'X' }]), { mode: 'lenient' })
  expect(r.ok && r.value.extraFields).toStrictEqual({ '80': 'X' })
})

test('the @tingqr/core/vnpay entry exports the same function', () => {
  expect(decodeFromSubpath).toBe(decodeVnpayQr)
})

test('default mode is lenient: a real-world VNPAY QR reads without options', () => {
  const r = decodeVnpayQr(V)
  expect(r.ok).toBe(true)
  expect(r.ok && r.warnings.map((w) => w.tag)).toEqual(['52', '60'])
})

test('parse-level warnings (trimmed whitespace) are passed through first', () => {
  const r = decodeVnpayQr(V + '\r\n')
  expect(r.ok && r.warnings.map((w) => w.code)).toEqual(['TRIMMED_WHITESPACE', 'MISSING_OPTIONAL_TAG', 'MISSING_OPTIONAL_TAG'])
})

test('tag 26 with another GUID, or without sub-tag 00, is UNSUPPORTED_SCHEME', () => {
  for (const value of [field('00', 'A000000727') + field('01', '0105313144'), field('01', '0105313144')]) {
    const r = decodeVnpayQr(rebuild((f) => f.map((x) => (x.tag === '26' ? { tag: '26', value } : x))))
    expect(!r.ok && [r.error.code, r.error.tag]).toEqual(['UNSUPPORTED_SCHEME', '26'])
  }
})

test('missing tag 00 is INVALID_VALUE on 00; missing tag 01 is MISSING_TAG on 01', () => {
  const no00 = decodeVnpayQr(rebuild((f) => f.filter((x) => x.tag !== '00')))
  expect(!no00.ok && [no00.error.code, no00.error.tag]).toEqual(['INVALID_VALUE', '00'])
  const no01 = decodeVnpayQr(rebuild((f) => f.filter((x) => x.tag !== '01')))
  expect(!no01.ok && [no01.error.code, no01.error.tag]).toEqual(['MISSING_TAG', '01'])
})

test('a VNPAY QR without tag 62 has no additionalData and no named 62 fields', () => {
  const r = decodeVnpayQr(rebuild((f) => f.filter((x) => x.tag !== '62')))
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect('additionalData' in r.value).toBe(false)
  expect('store' in r.value).toBe(false)
  expect(r.value.merchantId).toBe('0105313144')
})

test('a VietQR whose tag 26 is not clean TLV is UNSUPPORTED_SCHEME for the VNPAY decoder', () => {
  const vietqrFields = parseTlv(S_VIETQR).filter((f) => f.tag !== '63')
  for (const value of ['ABCD', field('00', 'X') + field('00', 'Y'), field('00', 'A000000727')]) {
    const p = buildPayload([...vietqrFields.slice(0, 2), { tag: '26', value }, ...vietqrFields.slice(2)])
    const r = decodeVnpayQr(p)
    expect(!r.ok && r.error.code, value).toBe('UNSUPPORTED_SCHEME')
  }
})

test('a VNPAY QR with duplicated sub-tags in 26 is still DUPLICATE_TAG', () => {
  const p = rebuild((f) => f.map((x) => (x.tag === '26' ? { tag: '26', value: field('00', 'A000000775') + field('01', '1') + field('01', '2') } : x)))
  const r = decodeVnpayQr(p)
  expect(!r.ok && [r.error.code, r.error.tag]).toEqual(['DUPLICATE_TAG', '26.01'])
})

test('a VNPAY QR whose tag 38 is not clean TLV is UNSUPPORTED_SCHEME for the VietQR decoder', () => {
  for (const value of ['ABCD', field('00', 'X') + field('00', 'Y')]) {
    const r = decodeVietQr(rebuild((f) => [...f, { tag: '38', value }]))
    expect(!r.ok && r.error.code, value).toBe('UNSUPPORTED_SCHEME')
  }
})
