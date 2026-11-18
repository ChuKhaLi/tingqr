import { buildPayload, decodePromptPayQr, field, parseTlv, PROMPTPAY_AID, type TlvField } from '../src/index.js'
import { decodePromptPayQr as decodeFromSubpath } from '../src/promptpay.js'

// Payloads below are pinned in the oracles' own tests (all MIT); see conformance/vectors/promptpay for sources.
// dtinth/promptpay-qr@v0.5.0: mobile 0801234567. Note tag 58 comes before 53.
const DT_MOBILE = '00020101021129370016A000000677010111011300668012345675802TH530376463046197'
// maythiwat/promptparse@1.7.1
const PP_MOBILE = '00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF'
const PP_TRUEMONEY = '00020101021129390016A000000677010111031514000080111111153037645802TH63047C0F'
const PP_BILL_REF3 =
  '00020101021130620016A000000677010112011301122334455660211CUSTOMER0010306INV00153037645802TH62070703SCB6304780E'
const DT_NATIONAL_ID = '00020101021129370016A000000677010111021311111111111115802TH530376463047B5A'
const DT_EWALLET = '00020101021129390016A00000067701011103150123456789012345802TH530376463049781'
// uunw/thai-qr-payment@v1.2.0
const TQ_BANK = '00020101021229370016A0000006770101110413014123456789053037645406100.005802TH6304901D'
const TQ_OTA = '00020101021229510016A00000067701011401130066812345678051012345678905303764540550.005802TH63048856'
const TQ_CROSS_BORDER =
  '00020101021230550016A0000006770120060115099400016550100021212345678901253037645406100.005802TH63049D1C'
// vietnam-qr-pay README (MIT) VietQR sample.
const VIETQR = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'
// bakong-khqr@1.0.20 test/feature/timestamp/decode.test.js (ISC): tag 29 holds a Bakong account 'john_smith@devb'.
const KHQR =
  '00020101021229460015john_smith@devb0111855122334550208Dev Bank52045999530384054031005802KH5910John Smith6010PHNOM PENH62670106#123450211855122334550311Coffee Shop0709Cashier_10810Buy coffee64280002km0108ចន ស្មីន0206ភ្នំពញ993400131726821915797011317268220357976304B73E'

function rebuild(payload: string, edit: (fields: TlvField[]) => TlvField[]): string {
  return buildPayload(edit(parseTlv(payload).filter((f) => f.tag !== '63')))
}
function setTag(fields: TlvField[], tag: string, value: string): TlvField[] {
  return fields.map((f) => (f.tag === tag ? { tag, value } : f))
}

function ok(payload: string, mode?: 'strict' | 'lenient') {
  const r = decodePromptPayQr(payload, mode ? { mode } : undefined)
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code} ${r.error.tag}`)
  return r
}
function err(payload: string, mode?: 'strict' | 'lenient'): [string, string | undefined] {
  const r = decodePromptPayQr(payload, mode ? { mode } : undefined)
  if (r.ok) throw new Error('expected an error')
  return [r.error.code, r.error.tag]
}

test('PROMPTPAY_AID lists the four AIDs', () => {
  expect(PROMPTPAY_AID).toEqual({
    creditTransfer: 'A000000677010111',
    ota: 'A000000677010114',
    billPayment: 'A000000677010112',
    billPaymentCrossBorder: 'A000000677012006',
  })
})

test('mobile proxy: verbatim proxy and mobile normalised to 0 + 9 digits; 58 before 53 reads', () => {
  const { value, warnings } = ok(DT_MOBILE, 'strict')
  expect(value).toStrictEqual({
    kind: 'credit-transfer',
    ota: false,
    proxyType: 'mobile',
    proxy: '0066801234567',
    mobile: '0801234567',
    subFields: { '01': '0066801234567' },
    initiation: 'static',
    currency: '764',
    country: 'TH',
  })
  expect(warnings).toEqual([])
  expect(ok(PP_MOBILE).value).toMatchObject({ mobile: '0812223333' })
})

test('a mobile sub-tag not in the 0066 + 9 digits form keeps proxy but has no mobile', () => {
  const payload = rebuild(PP_MOBILE, (f) =>
    setTag(f, '29', field('00', PROMPTPAY_AID.creditTransfer) + field('01', '66812223333')),
  )
  const { value } = ok(payload, 'strict')
  expect(value).toMatchObject({ proxyType: 'mobile', proxy: '66812223333' })
  expect('mobile' in value).toBe(false)
})

test('nationalId, eWallet and bankAccount proxies', () => {
  expect(ok(DT_NATIONAL_ID).value).toMatchObject({ proxyType: 'nationalId', proxy: '1111111111111' })
  expect(ok(DT_EWALLET).value).toMatchObject({ proxyType: 'eWallet', proxy: '012345678901234' })
  const bank = ok(TQ_BANK).value
  expect(bank).toMatchObject({ proxyType: 'bankAccount', proxy: '0141234567890', amount: '100.00' })
  expect(bank.initiation).toBe('dynamic')
  expect('mobile' in bank).toBe(false)
})

test('the first of sub-tags 01-04 present is the proxy', () => {
  const payload = rebuild(PP_MOBILE, (f) =>
    setTag(f, '29', field('00', PROMPTPAY_AID.creditTransfer) + field('03', '012345678901234') + field('02', '1111111111111')),
  )
  expect(ok(payload).value).toMatchObject({ proxyType: 'nationalId', proxy: '1111111111111' })
})

test('TrueMoney is an ordinary eWallet whose proxy starts with 14; tingqr does not name it', () => {
  const { value } = ok(PP_TRUEMONEY, 'strict')
  expect(value).toMatchObject({ kind: 'credit-transfer', proxyType: 'eWallet', proxy: '140000801111111' })
  expect(JSON.stringify(value)).not.toMatch(/true ?money/i)
})

test('bill payment with references; 62 kept verbatim', () => {
  expect(ok(PP_BILL_REF3, 'strict').value).toStrictEqual({
    kind: 'bill-payment',
    crossBorder: false,
    billerId: '0112233445566',
    reference1: 'CUSTOMER001',
    reference2: 'INV001',
    subFields: { '01': '0112233445566', '02': 'CUSTOMER001', '03': 'INV001' },
    additionalData: { '07': 'SCB' },
    initiation: 'static',
    currency: '764',
    country: 'TH',
  })
})

test('OTA credit transfer', () => {
  expect(ok(TQ_OTA).value).toMatchObject({ ota: true, otaCode: '1234567890', mobile: '0812345678', amount: '50.00' })
})

test('cross-border bill payment', () => {
  expect(ok(TQ_CROSS_BORDER).value).toMatchObject({ kind: 'bill-payment', crossBorder: true, billerId: '099400016550100' })
})

test('optional EMV tags are read when present, and unknown tags go to extraFields', () => {
  const payload = rebuild(PP_MOBILE, (f) => [
    ...f,
    { tag: '52', value: '5814' },
    { tag: '59', value: 'SHOP' },
    { tag: '60', value: 'BANGKOK' },
    { tag: '81', value: '0048' },
  ])
  expect(ok(payload, 'strict').value).toMatchObject({
    merchantCategoryCode: '5814',
    merchantName: 'SHOP',
    merchantCity: 'BANGKOK',
    extraFields: { '81': '0048' },
  })
})

test('the AID is compared case-insensitively', () => {
  const payload = rebuild(PP_MOBILE, (f) =>
    setTag(f, '29', field('00', PROMPTPAY_AID.creditTransfer.toLowerCase()) + field('01', '0066812223333')),
  )
  expect(ok(payload).value).toMatchObject({ proxyType: 'mobile' })
})

test('with both 29 and 30, tag 29 wins and 30 is an extra field', () => {
  const t30 = field('00', PROMPTPAY_AID.billPayment) + field('01', '0112233445566')
  const payload = rebuild(PP_MOBILE, (f) => [...f, { tag: '30', value: t30 }])
  const { value } = ok(payload, 'strict')
  expect(value.kind).toBe('credit-transfer')
  expect(value.extraFields).toEqual({ '30': t30 })
})

test('a tag 30 with a credit-transfer AID is not PromptPay', () => {
  const payload = rebuild(PP_BILL_REF3, (f) =>
    setTag(f, '30', field('00', PROMPTPAY_AID.creditTransfer) + field('01', '0112233445566')),
  )
  expect(err(payload)).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

test('a tag 29 with a bill-payment AID is not PromptPay', () => {
  const payload = rebuild(PP_MOBILE, (f) => setTag(f, '29', field('00', PROMPTPAY_AID.billPayment) + field('01', '1')))
  expect(err(payload)).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

test('other schemes are UNSUPPORTED_SCHEME', () => {
  expect(err(VIETQR)).toEqual(['UNSUPPORTED_SCHEME', '29'])
  expect(err(KHQR)).toEqual(['UNSUPPORTED_SCHEME', '29'])
  expect(err(KHQR, 'strict')).toEqual(['UNSUPPORTED_SCHEME', '29'])
})

test('tag 29 without sub-tags 01-04: lenient proxyType unknown with a warning, strict MISSING_TAG 29.01', () => {
  const payload = rebuild(PP_MOBILE, (f) => setTag(f, '29', field('00', PROMPTPAY_AID.creditTransfer) + field('05', 'X1')))
  const r = ok(payload)
  expect(r.value).toMatchObject({ proxyType: 'unknown', proxy: '', subFields: { '05': 'X1' }, otaCode: 'X1' })
  expect(r.warnings.map((w) => [w.code, w.tag])).toEqual([['MISSING_OPTIONAL_TAG', '29']])
  expect(err(payload, 'strict')).toEqual(['MISSING_TAG', '29.01'])
})

test('tag 30 without 30.01 is MISSING_TAG in both modes', () => {
  const payload = rebuild(PP_BILL_REF3, (f) => setTag(f, '30', field('00', PROMPTPAY_AID.billPayment) + field('02', 'R1')))
  expect(err(payload)).toEqual(['MISSING_TAG', '30.01'])
  expect(err(payload, 'strict')).toEqual(['MISSING_TAG', '30.01'])
})

test('duplicate sub-tag in a PromptPay template is DUPLICATE_TAG', () => {
  const payload = rebuild(PP_MOBILE, (f) =>
    setTag(f, '29', field('00', PROMPTPAY_AID.creditTransfer) + field('01', '0066812223333') + field('01', '0066812223333')),
  )
  expect(err(payload)).toEqual(['DUPLICATE_TAG', '29.01'])
})

test.each(['53', '58'])('missing %s: strict MISSING_TAG, lenient default with a warning', (tag) => {
  const payload = rebuild(PP_MOBILE, (f) => f.filter((x) => x.tag !== tag))
  expect(err(payload, 'strict')).toEqual(['MISSING_TAG', tag])
  const r = ok(payload)
  expect(tag === '53' ? r.value.currency : r.value.country).toBe(tag === '53' ? '764' : 'TH')
  expect(r.warnings.map((w) => [w.code, w.tag])).toEqual([['MISSING_OPTIONAL_TAG', tag]])
  expect(r.warnings[0]!.message).toContain(tag === '53' ? '764' : 'TH')
})

test('tags 00 and 01 are checked', () => {
  expect(err(rebuild(PP_MOBILE, (f) => setTag(f, '00', '02')))).toEqual(['INVALID_VALUE', '00'])
  expect(err(rebuild(PP_MOBILE, (f) => setTag(f, '01', '13')))).toEqual(['INVALID_VALUE', '01'])
})

test('CRC errors pass through, and the default mode is lenient', () => {
  expect(err(DT_MOBILE.slice(0, -1) + '0')).toEqual(['CRC_MISMATCH', '63'])
  const missing58 = rebuild(PP_MOBILE, (f) => f.filter((x) => x.tag !== '58'))
  expect(decodePromptPayQr(missing58).ok).toBe(true)
})

test('a malformed tag 62 is reported', () => {
  expect(err(rebuild(PP_MOBILE, (f) => [...f, { tag: '62', value: '07' }]))).toEqual(['TRUNCATED', undefined])
})

test('the ./promptpay subpath exports the same decoder', () => {
  expect(decodeFromSubpath).toBe(decodePromptPayQr)
})
