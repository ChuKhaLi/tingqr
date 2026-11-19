import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { buildPayload, detect, field, parseTlv, type TlvField } from '../src/index.js'

const SCHEMES = ['vietqr', 'vnpay', 'promptpay', 'khqr'] as const

interface Vector {
  id: string
  kind: string
  payload: string
}
const decodable = SCHEMES.flatMap((scheme) =>
  readdirSync(join(CONFORMANCE_DIR, 'vectors', scheme))
    .map((name) => JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'vectors', scheme, name), 'utf8')) as Vector)
    .filter((v) => v.kind === 'valid' || v.kind === 'lenient')
    .map((v) => [v.id, scheme, v.payload] as const),
)

// promptparse@1.7.1 (MIT): PromptPay mobile.
const PROMPTPAY = '00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF'
// vietnam-qr-pay README (MIT) VietQR and VNPAY samples.
const VIETQR = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'
const VNPAY =
  '00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685'

const rebuild = (payload: string, edit: (f: TlvField[]) => TlvField[]) =>
  buildPayload(edit(parseTlv(payload).filter((f) => f.tag !== '63')))

test('there are decodable vectors for all four schemes', () => {
  expect(new Set(decodable.map(([, s]) => s))).toEqual(new Set(SCHEMES))
})

test.each(decodable)('%s is detected as %s', (_id, scheme, payload) => {
  const r = detect(payload)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.value.scheme).toBe(scheme)
  // Review Focus 1: tag 29 of PromptPay and KHQR must never be confused, not even as a secondary match.
  if (scheme === 'promptpay') expect(r.value.alsoMatches).not.toContain('khqr')
  if (scheme === 'khqr') expect(r.value.alsoMatches).not.toContain('promptpay')
})

test('the result carries the scheme data, read in lenient mode', () => {
  const r = detect(VNPAY)
  expect(r).toMatchObject({ ok: true, value: { scheme: 'vnpay', alsoMatches: [], data: { merchantId: '0105313144' } } })
  expect(r.ok && r.warnings.map((w) => w.tag)).toEqual(['52', '60'])
  expect(detect(PROMPTPAY)).toMatchObject({ ok: true, value: { scheme: 'promptpay', data: { proxyType: 'mobile' } } })
})

test('a code with both VietQR and VNPAY templates is VietQR, also matching VNPAY', () => {
  const t26 = parseTlv(VNPAY).find((f) => f.tag === '26')!
  const r = detect(rebuild(VIETQR, (f) => [...f, t26]))
  expect(r).toMatchObject({ ok: true, value: { scheme: 'vietqr', alsoMatches: ['vnpay'] } })
})

test('a later scheme that recognises the code but rejects it still counts in alsoMatches', () => {
  const r = detect(rebuild(VIETQR, (f) => [...f, { tag: '26', value: field('00', 'A000000775') }]))
  expect(r).toMatchObject({ ok: true, value: { scheme: 'vietqr', alsoMatches: ['vnpay'] } })
})

test('an error from the first recognising scheme is returned as is, without trying the others', () => {
  const t26 = parseTlv(VNPAY).find((f) => f.tag === '26')!
  const broken = rebuild(VIETQR, (f) => [
    ...f.map((x) => (x.tag === '38' ? { tag: '38', value: field('00', 'A000000727') } : x)),
    t26,
  ])
  const r = detect(broken)
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['MISSING_TAG', '38.01'])
})

test('UNKNOWN_SCHEME carries the top-level fields that were read', () => {
  const payload = buildPayload([
    { tag: '00', value: '01' },
    { tag: '01', value: '11' },
    { tag: '29', value: field('00', 'A000000999') },
    { tag: '58', value: 'TH' },
  ])
  const r = detect(payload)
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.error.code).toBe('UNKNOWN_SCHEME')
  expect(r.error.fields).toEqual(parseTlv(payload))
})

test('CRC and TLV errors pass through unchanged', () => {
  const r = detect(PROMPTPAY.slice(0, -1) + '0')
  expect(r.ok).toBe(false)
  if (!r.ok) expect([r.error.code, r.error.tag]).toEqual(['CRC_MISMATCH', '63'])
  const t = detect('0002')
  expect(t.ok).toBe(false)
  if (!t.ok) expect(t.error.code).toBe('TRUNCATED')
})

test('whitespace warnings from parsing are kept, once', () => {
  const r = detect(`  ${PROMPTPAY}\n`)
  expect(r.ok && r.warnings.map((w) => w.code)).toEqual(['TRIMMED_WHITESPACE'])
})

test('a KHQR tag 30 inside a Thai (58 = TH) PromptPay code is not KHQR', () => {
  const t30 = field('00', 'khqr@devb') + field('01', '123456') + field('02', 'Dev Bank')
  const r = detect(rebuild(PROMPTPAY, (f) => [...f, { tag: '30', value: t30 }]))
  expect(r).toMatchObject({ ok: true, value: { scheme: 'promptpay', alsoMatches: [] } })
})

test('without tag 58, a PromptPay tag 29 next to a KHQR tag 30 matches both; PromptPay comes first', () => {
  const t30 = field('00', 'khqr@devb') + field('01', '123456') + field('02', 'Dev Bank')
  const r = detect(rebuild(PROMPTPAY, (f) => [...f.filter((x) => x.tag !== '58'), { tag: '30', value: t30 }]))
  expect(r).toMatchObject({ ok: true, value: { scheme: 'promptpay', alsoMatches: ['khqr'] } })
})

test('an @ account in tag 29 of a non-Cambodian code is UNKNOWN_SCHEME, not KHQR', () => {
  const payload = buildPayload([
    { tag: '00', value: '01' },
    { tag: '01', value: '11' },
    { tag: '30', value: field('00', 'user@example') + field('01', 'M1') + field('02', 'Bank') },
    { tag: '53', value: '978' },
    { tag: '58', value: 'DE' },
  ])
  const r = detect(payload)
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error.code).toBe('UNKNOWN_SCHEME')
})
