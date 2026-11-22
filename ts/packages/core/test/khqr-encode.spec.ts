import { decodeKhqr, encodeKhqr, parseTlv, TingQrError, type KhqrInput } from '../src/index.js'
import { encodeKhqr as encodeFromSubpath } from '../src/khqr.js'

const NOW = 1731000000000
const BASE: KhqrInput = {
  accountType: 'individual',
  bakongAccountId: 'jonhsmith@nbcq',
  merchantName: 'Jonh Smith',
  currency: 'KHR',
  createdAt: NOW,
}
const MERCHANT: KhqrInput = {
  accountType: 'merchant',
  bakongAccountId: 'khqr@devb',
  merchantId: '123456',
  acquiringBank: 'Dev Bank',
  merchantName: 'TINGQR SHOP',
  currency: 'KHR',
  createdAt: NOW,
}
// bakong-khqr@1.0.20 output for USD 1.5 with Date.now pinned (conformance/vectors/khqr/khqr-encode-individual-usd-1-5.json).
const SDK_USD_1_5 =
  '00020101021229450014jonhsmith@nbcq0111855123456780208Dev Bank52045999530384054041.505802KH5910Jonh Smith6010Phnom Penh993400131731000000000011317310006000006304A009'

function errorOf(input: unknown): [string, string | undefined] {
  try {
    encodeKhqr(input as KhqrInput)
  } catch (e) {
    if (e instanceof TingQrError) return [e.code, e.tag]
    throw e
  }
  throw new Error('expected encodeKhqr to throw')
}
const tag = (payload: string, t: string) => parseTlv(payload).find((f) => f.tag === t)?.value

test('the same input gives the same payload, and the clock is never read', () => {
  const spy = vi.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('Date.now must not be called')
  })
  try {
    const input: KhqrInput = { ...BASE, amount: 1000, expiresAt: NOW + 60000 }
    expect(encodeKhqr(input)).toBe(encodeKhqr(input))
  } finally {
    spy.mockRestore()
  }
})

test('the encoded payload decodes back to the input in strict mode', () => {
  const input: KhqrInput = {
    ...MERCHANT,
    merchantCity: 'Siem Reap',
    merchantCategoryCode: '5814',
    amount: 1000,
    billNumber: 'INV-0001',
    mobileNumber: '85512345678',
    storeLabel: 'Store 1',
    terminalLabel: 'T1',
    purpose: 'Coffee',
    alternateLanguage: { language: 'km', merchantName: 'ចន ស្មីន', merchantCity: 'ភ្នំពញ' },
    expiresAt: NOW + 120000,
  }
  const r = decodeKhqr(encodeKhqr(input), { mode: 'strict' })
  expect(r.ok && r.warnings).toEqual([])
  expect(r).toMatchObject({
    ok: true,
    value: {
      accountType: 'merchant',
      bakongAccountId: 'khqr@devb',
      merchantId: '123456',
      acquiringBank: 'Dev Bank',
      merchantName: 'TINGQR SHOP',
      merchantCity: 'Siem Reap',
      merchantCategoryCode: '5814',
      currency: '116',
      currencyAlpha: 'KHR',
      amount: '1000',
      billNumber: 'INV-0001',
      mobileNumber: '85512345678',
      storeLabel: 'Store 1',
      terminalLabel: 'T1',
      purpose: 'Coffee',
      alternateLanguage: input.alternateLanguage,
      createdAt: NOW,
      expiresAt: NOW + 120000,
      initiation: 'dynamic',
    },
  })
})

test('defaults: city Phnom Penh, MCC 5999; a static code without expiresAt has no tag 99', () => {
  const payload = encodeKhqr(BASE)
  expect(tag(payload, '60')).toBe('Phnom Penh')
  expect(tag(payload, '52')).toBe('5999')
  expect(tag(payload, '01')).toBe('11')
  expect(tag(payload, '99')).toBeUndefined()
})

test('a static code with expiresAt carries both timestamps', () => {
  const r = decodeKhqr(encodeKhqr({ ...BASE, expiresAt: NOW + 1 }), { mode: 'strict' })
  expect(r).toMatchObject({ ok: true, value: { initiation: 'static', createdAt: NOW, expiresAt: NOW + 1 } })
})

test('tags are written in the SDK order', () => {
  const payload = encodeKhqr({
    ...BASE,
    amount: 1,
    expiresAt: NOW + 1,
    billNumber: 'B',
    alternateLanguage: { language: 'km', merchantName: 'X' },
  })
  expect(parseTlv(payload).map((f) => f.tag)).toEqual(['00', '01', '29', '52', '53', '54', '58', '59', '60', '62', '64', '99', '63'])
})

test('USD amounts: whole numbers stay whole, fractions get two decimals (as the SDK)', () => {
  const usd = (amount: number | string) => tag(encodeKhqr({ ...BASE, currency: 'USD', amount, expiresAt: NOW + 1 }), '54')
  expect(usd(1)).toBe('1')
  expect(encodeKhqr({ ...BASE, currency: 'USD', amount: 1, expiresAt: NOW + 1 })).toContain('54011')
  expect(usd(1.5)).toBe('1.50')
  expect(usd('1.5')).toBe('1.50')
  expect(usd('1.0')).toBe('1.00')
  expect(usd('0.01')).toBe('0.01')
  expect(usd('007')).toBe('7')
})

test('the SDK sample is reproduced byte for byte', () => {
  expect(
    encodeKhqr({
      ...BASE,
      accountInformation: '85512345678',
      acquiringBank: 'Dev Bank',
      currency: 'USD',
      amount: 1.5,
      expiresAt: NOW + 600000,
    }),
  ).toBe(SDK_USD_1_5)
})

test('KHR amounts are whole numbers', () => {
  const khr = (amount: number | string) => tag(encodeKhqr({ ...BASE, amount, expiresAt: NOW + 1 }), '54')
  expect(khr(1000)).toBe('1000')
  expect(khr('1000')).toBe('1000')
  expect(khr('01000')).toBe('1000')
})

test.each([
  ['KHR', 1.5],
  ['KHR', '1000.0'],
  ['KHR', 0],
  ['KHR', -5],
  ['KHR', '1e3'],
  ['KHR', '12345678901234'],
  ['USD', 1.234],
  ['USD', '1.234'],
  ['USD', 0],
  ['USD', '0.00'],
  ['USD', '1.'],
  ['USD', NaN],
  ['USD', true],
] as const)('%s amount %s is rejected', (currency, amount) => {
  expect(errorOf({ ...BASE, currency, amount, expiresAt: NOW + 1 })).toEqual(['INVALID_VALUE', '54'])
})

test('an empty amount means a static code', () => {
  expect(encodeKhqr({ ...BASE, amount: '' })).toBe(encodeKhqr(BASE))
})

test.each([
  [{ amount: 1000 }, '99.01'],
  [{ amount: 1000, expiresAt: NOW }, '99.01'],
  [{ amount: 1000, expiresAt: NOW - 1 }, '99.01'],
  [{ expiresAt: 17310000000000 }, '99.01'],
  [{ expiresAt: '1731000060000' }, '99.01'],
  [{ createdAt: undefined }, '99.00'],
  [{ createdAt: 173100000000 }, '99.00'],
  [{ createdAt: NOW + 0.5 }, '99.00'],
  [{ createdAt: String(NOW) }, '99.00'],
])('timestamps %o are rejected at %s', (change, t) => {
  expect(errorOf({ ...BASE, ...change })).toEqual(['INVALID_VALUE', t])
})

test.each([
  [{ bakongAccountId: 'jonhsmithnbcq' }, '29.00'],
  [{ bakongAccountId: 'a@b@c' }, '29.00'],
  [{ bakongAccountId: 'abcdefghijklmnopqrstuvwxyz@abcdef' }, '29.00'],
  [{ bakongAccountId: 42 }, '29.00'],
  [{ accountInformation: 'x'.repeat(33) }, '29.01'],
  [{ acquiringBank: 'x'.repeat(33) }, '29.02'],
  [{ merchantId: '1' }, '29'],
  [{ merchantName: '' }, '59'],
  [{ merchantName: 'x'.repeat(26) }, '59'],
  [{ merchantName: undefined }, '59'],
  [{ merchantCity: 'x'.repeat(16) }, '60'],
  [{ merchantCategoryCode: '599' }, '52'],
  [{ merchantCategoryCode: 'abcd' }, '52'],
  [{ currency: 'EUR' }, '53'],
  [{ billNumber: 'x'.repeat(26) }, '62.01'],
  [{ mobileNumber: 'x'.repeat(26) }, '62.02'],
  [{ storeLabel: 'x'.repeat(26) }, '62.03'],
  [{ terminalLabel: 'x'.repeat(26) }, '62.07'],
  [{ purpose: 'x'.repeat(26) }, '62.08'],
  [{ alternateLanguage: { language: 'kmr', merchantName: 'X' } }, '64.00'],
  [{ alternateLanguage: { language: '', merchantName: 'X' } }, '64.00'],
  [{ alternateLanguage: { language: 'km' } }, '64.01'],
  [{ alternateLanguage: { language: 'km', merchantName: 'x'.repeat(26) } }, '64.01'],
  [{ alternateLanguage: { language: 'km', merchantName: 'X', merchantCity: 'x'.repeat(16) } }, '64.02'],
  [{ accountType: 'shop' }, '29'],
])('individual input %o is rejected at %s', (change, t) => {
  expect(errorOf({ ...BASE, ...change })).toEqual(['INVALID_VALUE', t])
})

test.each([
  [{ merchantId: undefined }, '30.01'],
  [{ merchantId: 'x'.repeat(33) }, '30.01'],
  [{ acquiringBank: undefined }, '30.02'],
  [{ acquiringBank: 'x'.repeat(33) }, '30.02'],
  [{ accountInformation: '1' }, '30'],
  [{ bakongAccountId: 'khqrdevb' }, '30.00'],
])('merchant input %o is rejected at %s', (change, t) => {
  expect(errorOf({ ...MERCHANT, ...change })).toEqual(['INVALID_VALUE', t])
})

test('a 32-character account and 25-character fields are accepted', () => {
  const r = decodeKhqr(
    encodeKhqr({
      ...BASE,
      bakongAccountId: 'abcdefghijklmnopqrstuvwxyz@abcde',
      merchantName: 'x'.repeat(25),
      merchantCity: 'x'.repeat(15),
      billNumber: 'x'.repeat(25),
    }),
    { mode: 'strict' },
  )
  expect(r.ok).toBe(true)
})

test.each([
  [{ merchantName: 'Café' }, '59'],
  [{ merchantCity: 'Phnôm Pénh' }, '60'],
  [{ purpose: 'កាហ្វេ' }, '62.08'],
  [{ bakongAccountId: 'jön@nbcq' }, '29.00'],
  [{ acquiringBank: 'Bank\n' }, '29.02'],
])('non-ASCII text outside tag 64 is NON_ASCII: %o', (change, t) => {
  expect(errorOf({ ...BASE, ...change })).toEqual(['NON_ASCII', t])
})

test('Khmer text is allowed in tag 64, counted in characters', () => {
  const payload = encodeKhqr({ ...BASE, alternateLanguage: { language: 'km', merchantName: 'ចន ស្មីន' } })
  expect(payload).toContain('0108ចន ស្មីន')
})

test('the ./khqr subpath exports the same encoder', () => {
  expect(encodeFromSubpath).toBe(encodeKhqr)
})

test('leading zeros are removed, and a 13-character amount is the longest accepted', () => {
  const amount = (currency: 'KHR' | 'USD', a: number | string) => tag(encodeKhqr({ ...BASE, currency, amount: a, expiresAt: NOW + 1 }), '54')
  expect(amount('KHR', '001000')).toBe('1000')
  expect(amount('KHR', 100)).toBe('100')
  expect(amount('USD', '100')).toBe('100')
  expect(amount('USD', '0010.5')).toBe('10.50')
  expect(amount('KHR', '1234567890123')).toBe('1234567890123')
  expect(errorOf({ ...BASE, currency: 'USD', amount: '12345678901.23', expiresAt: NOW + 1 })).toEqual(['INVALID_VALUE', '54'])
})

test.each([[['1000']], [{ toString: (): string => '1000' }]])('an amount that is neither number nor string (%o) is rejected', (amount) => {
  expect(errorOf({ ...BASE, amount, expiresAt: NOW + 1 })).toEqual(['INVALID_VALUE', '54'])
})

test.each([5999, '59990', 'a5999', '5999a'])('merchantCategoryCode %o is rejected', (mcc) => {
  expect(errorOf({ ...BASE, merchantCategoryCode: mcc })).toEqual(['INVALID_VALUE', '52'])
})

test.each(['a@', '@b', '@'])('bakongAccountId %s with an empty name or bank is rejected', (account) => {
  expect(errorOf({ ...BASE, bakongAccountId: account })).toEqual(['INVALID_VALUE', '29.00'])
})

test.each([
  ['116', 'KHR'],
  ['840', 'USD'],
] as const)('currency %s encodes exactly like %s', (numeric, alpha) => {
  const input = { ...BASE, amount: '5', expiresAt: NOW + 1 }
  expect(encodeKhqr({ ...input, currency: numeric })).toBe(encodeKhqr({ ...input, currency: alpha }))
})

test('numeric 840 follows the USD amount rule, numeric 116 the KHR one', () => {
  expect(tag(encodeKhqr({ ...BASE, currency: '840', amount: 1.5, expiresAt: NOW + 1 }), '54')).toBe('1.50')
  expect(errorOf({ ...BASE, currency: '116', amount: 1.5, expiresAt: NOW + 1 })).toEqual(['INVALID_VALUE', '54'])
})

test('the decoded currency can be passed straight back to encodeKhqr', () => {
  const first = encodeKhqr({ ...BASE, currency: 'USD', amount: 2, expiresAt: NOW + 1 })
  const r = decodeKhqr(first, { mode: 'strict' })
  if (!r.ok) throw new Error(r.error.code)
  const again = encodeKhqr({ ...BASE, currency: r.value.currency as KhqrInput['currency'], amount: 2, expiresAt: NOW + 1 })
  expect(again).toBe(first)
})

test.each(['764', 'khr', 116])('currency %o is rejected', (currency) => {
  expect(errorOf({ ...BASE, currency })).toEqual(['INVALID_VALUE', '53'])
})

describe('encodeKhqr without an input object', () => {
  for (const bad of [undefined, null, 42, 'x']) {
    test(`${String(bad)} is INVALID_VALUE, not a TypeError`, () => {
      let error: unknown
      try {
        encodeKhqr(bad as never)
      } catch (e) {
        error = e
      }
      expect(error).toBeInstanceOf(TingQrError)
      expect((error as TingQrError).code).toBe('INVALID_VALUE')
      expect((error as TingQrError).message).toBe(`encodeKhqr needs an input object; got ${bad === null ? 'null' : typeof bad}.`)
    })
  }
})
