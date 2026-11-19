// Check every KHQR vector's hand-written `expected` against bakong-khqr@1.0.20 BakongKHQR.decode, the official SDK of
// the National Bank of Cambodia (ISC, declared in its package.json; no LICENSE file). For each `valid` or `lenient`
// vector, every field the SDK reads must equal the matching field of `expected` (absent in `expected` = null in the
// SDK). The SDK's decode does not validate anything, so this checks field extraction only. Not compared: currency,
// tag 61 (postal code), the raw tag 62/99 maps, extraFields and warnings.
//
// Run: cd conformance/tools/oracle && pnpm install && node check-khqr.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { BakongKHQR } = require('bakong-khqr')

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vectors', 'khqr')

/** SDK field → function reading the same value from a tingqr `expected`. */
const MAP = {
  merchantType: (e) => (e.accountType === 'individual' ? '29' : '30'),
  bakongAccountID: (e) => e.bakongAccountId,
  accountInformation: (e) => e.accountInformation,
  merchantID: (e) => e.merchantId,
  acquiringBank: (e) => e.acquiringBank,
  billNumber: (e) => e.billNumber,
  mobileNumber: (e) => e.mobileNumber,
  storeLabel: (e) => e.storeLabel,
  terminalLabel: (e) => e.terminalLabel,
  purposeOfTransaction: (e) => e.purpose,
  languagePreference: (e) => e.alternateLanguage?.language,
  merchantNameAlternateLanguage: (e) => e.alternateLanguage?.merchantName,
  merchantCityAlternateLanguage: (e) => e.alternateLanguage?.merchantCity,
  creationTimestamp: (e) => e.timestamp?.['00'],
  expirationTimestamp: (e) => e.timestamp?.['01'],
  pointofInitiationMethod: (e) => (e.initiation === 'dynamic' ? '12' : '11'),
  unionPayMerchant: (e) => e.unionPay,
  merchantCategoryCode: (e) => e.merchantCategoryCode,
  transactionCurrency: (e) => e.currencyCode,
  transactionAmount: (e) => e.amount,
  countryCode: (e) => e.country,
  merchantName: (e) => e.merchantName,
  merchantCity: (e) => e.merchantCity,
}

let checked = 0
for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  const v = JSON.parse(readFileSync(join(DIR, name), 'utf8'))
  if (v.kind !== 'valid' && v.kind !== 'lenient') continue
  // BakongKHQR.decode always returns status 0 and never validates (CRC, required tags): this compares extraction only.
  const { data } = BakongKHQR.decode(v.payload)
  for (const [field, read] of Object.entries(MAP)) {
    const expected = read(v.expected) ?? null
    if (data[field] !== expected) {
      throw new Error(`${v.id}: SDK ${field} is ${JSON.stringify(data[field])}, expected ${JSON.stringify(expected)}`)
    }
  }
  for (const [key, sub] of [['createdAt', '00'], ['expiresAt', '01']]) {
    const raw = v.expected.timestamp?.[sub]
    const want = raw !== undefined && /^\d{13}$/.test(raw) ? Number(raw) : undefined
    if (v.expected[key] !== want) throw new Error(`${v.id}: ${key} does not match timestamp.${sub}`)
  }
  checked++
}
console.log(`bakong-khqr agrees with ${checked} KHQR vectors`)
