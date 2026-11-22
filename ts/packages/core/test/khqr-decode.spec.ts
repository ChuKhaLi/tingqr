import { buildPayload, decodeKhqr, field, isKhqrExpired, parseTlv, type KhqrData, type TlvField } from '../src/index.js'
import { decodeKhqr as decodeFromSubpath, isKhqrExpired as expiredFromSubpath } from '../src/khqr.js'

// bakong-khqr@1.0.20 test/feature/timestamp/decode.test.js (ISC): individual, USD, Khmer tag 64, tag 99 after 64.
const INDIVIDUAL =
  '00020101021229460015john_smith@devb0111855122334550208Dev Bank52045999530384054031005802KH5910John Smith6010PHNOM PENH62670106#123450211855122334550311Coffee Shop0709Cashier_10810Buy coffee64280002km0108ចន ស្មីន0206ភ្នំពញ993400131726821915797011317268220357976304B73E'
// bakong-khqr@1.0.20 test/decode.test.js (ISC): ACLEDA merchant, static.
const MERCHANT =
  '00020101021130470009khqr@aclb0111855124649170215ACLEDA Bank Plc5204599953038405802KH5907BUN MAO6010Phnom Penh6102126213020901050033164310002KM0107BUN MAO0210Phnom Penh6304E313'
// promptparse@1.7.1 (MIT): PromptPay mobile, tag 29 with an AID.
const PROMPTPAY = '00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF'
// vietnam-qr-pay README (MIT) VietQR sample.
const VIETQR = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'

function rebuild(payload: string, edit: (fields: TlvField[]) => TlvField[]): string {
  return buildPayload(edit(parseTlv(payload).filter((f) => f.tag !== '63')))
}
const setTag = (fields: TlvField[], tag: string, value: string) => fields.map((f) => (f.tag === tag ? { tag, value } : f))
const drop = (fields: TlvField[], tag: string) => fields.filter((f) => f.tag !== tag)

function ok(payload: string, mode?: 'strict' | 'lenient') {
  const r = decodeKhqr(payload, mode ? { mode } : undefined)
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code} ${r.error.tag}`)
  return r
}
function err(payload: string, mode?: 'strict' | 'lenient'): [string, string | undefined] {
  const r = decodeKhqr(payload, mode ? { mode } : undefined)
  if (r.ok) throw new Error('expected an error')
  return [r.error.code, r.error.tag]
}

test('Khmer merchant name and city in tag 64 are read (lengths count characters)', () => {
  expect(ok(INDIVIDUAL, 'strict').value.alternateLanguage).toStrictEqual({
    language: 'km',
    merchantName: 'ចន ស្មីន',
    merchantCity: 'ភ្នំពញ',
  })
})

test('tag 99 after 64 is read; 13-digit timestamps become numbers', () => {
  const { value } = ok(INDIVIDUAL, 'strict')
  expect(value.createdAt).toBe(1726821915797)
  expect(value.expiresAt).toBe(1726822035797)
  expect(value.timestamp).toEqual({ '00': '1726821915797', '01': '1726822035797' })
  expect(value.currency).toBe('840')
  expect(value.currencyAlpha).toBe('USD')
})

test('tag 99 values that are not 13 digits stay in timestamp only', () => {
  const payload = rebuild(INDIVIDUAL, (f) => setTag(f, '99', field('00', '172682191579') + field('01', '39CA0264') + field('02', 'X')))
  const { value } = ok(payload)
  expect(value.timestamp).toEqual({ '00': '172682191579', '01': '39CA0264', '02': 'X' })
  expect('createdAt' in value).toBe(false)
  expect('expiresAt' in value).toBe(false)
})

test('isKhqrExpired compares expiresAt with the given time and never reads the clock', () => {
  const { value } = ok(INDIVIDUAL)
  expect(isKhqrExpired(value, 0)).toBe(false)
  expect(isKhqrExpired(value, Date.UTC(2030, 0, 1))).toBe(true)
  expect(isKhqrExpired(value, 1726822035797)).toBe(false)
  expect(isKhqrExpired(value, 1726822035798)).toBe(true)
  expect(isKhqrExpired(ok(MERCHANT).value, Date.UTC(2030, 0, 1))).toBeUndefined()
})

test('a merchant (tag 30) with postal code, upper-case KM kept verbatim', () => {
  const { value } = ok(MERCHANT, 'strict')
  expect(value).toMatchObject({
    accountType: 'merchant',
    bakongAccountId: 'khqr@aclb',
    merchantId: '85512464917',
    acquiringBank: 'ACLEDA Bank Plc',
    postalCode: '12',
    initiation: 'static',
    alternateLanguage: { language: 'KM' },
  })
  expect('amount' in value).toBe(false)
})

test('other schemes are UNSUPPORTED_SCHEME, in both modes', () => {
  expect(err(PROMPTPAY)).toEqual(['UNSUPPORTED_SCHEME', '29'])
  expect(err(PROMPTPAY, 'strict')).toEqual(['UNSUPPORTED_SCHEME', '29'])
  expect(err(VIETQR)).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

test.each([
  ['no @', 'john_smithdevb'],
  ['two @', 'john@smith@devb'],
])('a tag 29 account with %s is not KHQR', (_name, account) => {
  const payload = rebuild(INDIVIDUAL, (f) => setTag(f, '29', field('00', account)))
  expect(err(payload)).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

test('a tag 29 that is not TLV, or has no sub-tag 00, is not KHQR', () => {
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '29', 'a@b')))).toEqual(['UNSUPPORTED_SCHEME', '29'])
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '29', field('01', 'a@b'))))).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

test('missing 53 is MISSING_TAG in both modes (no default currency)', () => {
  const payload = rebuild(INDIVIDUAL, (f) => drop(f, '53'))
  expect(err(payload)).toEqual(['MISSING_TAG', '53'])
  expect(err(payload, 'strict')).toEqual(['MISSING_TAG', '53'])
})

test.each(['52', '59', '60'])('missing %s: strict MISSING_TAG, lenient a warning and no value', (tag) => {
  const payload = rebuild(INDIVIDUAL, (f) => drop(f, tag))
  expect(err(payload, 'strict')).toEqual(['MISSING_TAG', tag])
  const r = ok(payload)
  expect(r.warnings.map((w) => [w.code, w.tag])).toEqual([['MISSING_OPTIONAL_TAG', tag]])
  const key = { '52': 'merchantCategoryCode', '59': 'merchantName', '60': 'merchantCity' }[tag] as keyof KhqrData
  expect(key in r.value).toBe(false)
})

test('missing 58: strict MISSING_TAG, lenient KH with a warning', () => {
  const payload = rebuild(INDIVIDUAL, (f) => drop(f, '58'))
  expect(err(payload, 'strict')).toEqual(['MISSING_TAG', '58'])
  const r = ok(payload)
  expect(r.value.country).toBe('KH')
  expect(r.warnings.map((w) => [w.code, w.tag, w.message.includes('KH')])).toEqual([['MISSING_OPTIONAL_TAG', '58', true]])
})

test('a dynamic QR without 99.01: strict MISSING_TAG, lenient a warning; a static one needs none', () => {
  const payload = rebuild(INDIVIDUAL, (f) => setTag(f, '99', field('00', '1726821915797')))
  expect(err(payload, 'strict')).toEqual(['MISSING_TAG', '99.01'])
  expect(ok(payload).warnings.map((w) => [w.code, w.tag])).toEqual([['MISSING_OPTIONAL_TAG', '99.01']])
  const noTimestamp = rebuild(INDIVIDUAL, (f) => drop(f, '99'))
  expect(err(noTimestamp, 'strict')).toEqual(['MISSING_TAG', '99.01'])
  expect(ok(MERCHANT, 'strict').warnings).toEqual([])
})

test.each(['01', '02'])('a merchant without 30.%s is MISSING_TAG', (sub) => {
  const nodes = parseTlv(parseTlv(MERCHANT).find((f) => f.tag === '30')!.value).filter((n) => n.tag !== sub)
  const payload = rebuild(MERCHANT, (f) => setTag(f, '30', nodes.map((n) => field(n.tag, n.value)).join('')))
  expect(err(payload)).toEqual(['MISSING_TAG', `30.${sub}`])
})

test('with both 29 and 30, tag 29 wins and 30 is an extra field', () => {
  const t30 = parseTlv(MERCHANT).find((f) => f.tag === '30')!.value
  const { value } = ok(rebuild(INDIVIDUAL, (f) => [...f, { tag: '30', value: t30 }]), 'strict')
  expect(value.accountType).toBe('individual')
  expect(value.extraFields).toEqual({ '30': t30 })
})

test('currency is tag 53 verbatim; currencyAlpha only for 116/840', () => {
  const { value } = ok(rebuild(INDIVIDUAL, (f) => setTag(f, '53', '764')))
  expect(value.currency).toBe('764')
  expect('currencyAlpha' in value).toBe(false)
  expect(ok(rebuild(INDIVIDUAL, (f) => setTag(f, '53', '116'))).value).toMatchObject({ currency: '116', currencyAlpha: 'KHR' })
})

test('unknown top-level tags go to extraFields; tag 15 is unionPay', () => {
  const { value } = ok(rebuild(MERCHANT, (f) => [...f, { tag: '15', value: 'UP1' }, { tag: '81', value: 'X' }]), 'strict')
  expect(value.unionPay).toBe('UP1')
  expect(value.extraFields).toEqual({ '81': 'X' })
})

test('tag 64 with only a language code', () => {
  expect(ok(rebuild(MERCHANT, (f) => setTag(f, '64', field('00', 'km')))).value.alternateLanguage).toStrictEqual({
    language: 'km',
  })
})

test('tags 00 and 01 are checked', () => {
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '00', '02')))).toEqual(['INVALID_VALUE', '00'])
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '01', '13')))).toEqual(['INVALID_VALUE', '01'])
})

test('duplicate sub-tags are DUPLICATE_TAG', () => {
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '29', field('00', 'a@b') + field('01', 'x') + field('01', 'y'))))).toEqual([
    'DUPLICATE_TAG',
    '29.01',
  ])
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '99', field('00', '1') + field('00', '2'))))).toEqual(['DUPLICATE_TAG', '99.00'])
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '64', field('00', 'km') + field('00', 'km'))))).toEqual(['DUPLICATE_TAG', '64.00'])
})

test('CRC errors pass through, and the default mode is lenient', () => {
  expect(err(INDIVIDUAL.slice(0, -1) + '0')).toEqual(['CRC_MISMATCH', '63'])
  expect(decodeKhqr(rebuild(INDIVIDUAL, (f) => drop(f, '52'))).ok).toBe(true)
})

test('the ./khqr subpath exports the same functions', () => {
  expect(decodeFromSubpath).toBe(decodeKhqr)
  expect(expiredFromSubpath).toBe(isKhqrExpired)
})

test('parse warnings (whitespace) are kept', () => {
  expect(ok(` ${INDIVIDUAL} `).warnings.map((w) => w.code)).toEqual(['TRIMMED_WHITESPACE'])
})

test.each([['00', 'INVALID_VALUE'], ['01', 'MISSING_TAG']])('a missing tag %s is %s, not a crash', (t, code) => {
  expect(err(rebuild(INDIVIDUAL, (f) => drop(f, t)))).toEqual([code, t])
})

test.each(['01726821915797', '17268219157970'])('a 14-digit timestamp %s is not a time', (stamp) => {
  const { value } = ok(rebuild(INDIVIDUAL, (f) => setTag(f, '99', field('00', stamp) + field('01', stamp))))
  expect('createdAt' in value).toBe(false)
  expect('expiresAt' in value).toBe(false)
})

test.each([
  ['01', '2', '99.01'],
  ['00', '1', '99.00'],
])('strict mode rejects a 99.%s that is not 13 digits', (sub, bad, t) => {
  const stamps = { '00': '1726821915797', '01': '1726822035797', [sub]: bad }
  const payload = rebuild(INDIVIDUAL, (f) => setTag(f, '99', field('00', stamps['00']!) + field('01', stamps['01']!)))
  expect(err(payload, 'strict')).toEqual(['INVALID_VALUE', t])
})

test('lenient mode: a dynamic code whose 99.01 is unreadable has no expiry and is warned about', () => {
  const payload = rebuild(INDIVIDUAL, (f) => setTag(f, '99', field('00', '1726821915797') + field('01', '2')))
  const r = ok(payload)
  expect('expiresAt' in r.value).toBe(false)
  expect(r.value.timestamp).toEqual({ '00': '1726821915797', '01': '2' })
  expect(r.warnings.map((w) => [w.code, w.tag])).toEqual([['MISSING_OPTIONAL_TAG', '99.01']])
})

test.each(['a@', '@b'])('an account %s with an empty name or bank is not KHQR', (account) => {
  expect(err(rebuild(INDIVIDUAL, (f) => setTag(f, '29', field('00', account))))).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

test.each(['DE', 'TH', 'kh'])('an @ account in a code whose tag 58 is %s is not KHQR', (country) => {
  const payload = rebuild(INDIVIDUAL, (f) => setTag(f, '58', country))
  expect(err(payload)).toEqual(['UNSUPPORTED_SCHEME', '29'])
  expect(err(payload, 'strict')).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

describe('decodeKhqr with no tag 01', () => {
  // conformance/vectors/khqr/khqr-missing-poi.json
  const payload = '00020129310014jonhsmith@nbcq0109012345678520459995303116540750000.05802KH5910Jonh Smith6009Siam Reap62550117INV-2021-07-658220211855123456780305BKK-107060123459917001316303958385026304FF7C'
  for (const mode of ['strict', 'lenient'] as const) {
    test(`${mode}: MISSING_TAG 01 with a message that names the tag`, () => {
      const r = decodeKhqr(payload, { mode })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '01'])
      expect(r.error.message).toBe('Tag 01 (point of initiation) is missing; expected 11 or 12.')
    })
  }
})
