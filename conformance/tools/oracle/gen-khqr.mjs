// Generate KHQR encode vectors with bakong-khqr@1.0.20, the official SDK of the National Bank of Cambodia (ISC,
// declared in its package.json; no LICENSE file). The SDK stamps tag 99.00 with Date.now(), so this script pins
// Date.now to 1731000000000 to make the output reproducible; tingqr takes the same value as `createdAt`.
// Each payload is checked with the SDK's own BakongKHQR.verify. Error 46 (KHQR expired) is ignored there because the
// pinned clock is in 2024; with Date.now pinned it does not occur. `expected` is built from the case inputs, never
// from tingqr.
//
// Run: cd conformance/tools/oracle && pnpm install && node gen-khqr.mjs
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { BakongKHQR, IndividualInfo, MerchantInfo, khqrData } = require('bakong-khqr')

const NOW = 1731000000000
Date.now = () => NOW

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vectors', 'khqr')
const EXPIRED = 46

const CASES = [
  {
    id: 'khqr-encode-individual-khr-static',
    input: {
      accountType: 'individual',
      bakongAccountId: 'jonhsmith@nbcq',
      merchantName: 'Jonh Smith',
      merchantCity: 'PHNOM PENH',
      currency: 'KHR',
      createdAt: NOW,
    },
  },
  {
    id: 'khqr-encode-individual-usd-1-5',
    input: {
      accountType: 'individual',
      bakongAccountId: 'jonhsmith@nbcq',
      accountInformation: '85512345678',
      acquiringBank: 'Dev Bank',
      merchantName: 'Jonh Smith',
      currency: 'USD',
      amount: 1.5,
      createdAt: NOW,
      expiresAt: NOW + 600000,
    },
  },
  {
    id: 'khqr-encode-merchant-khr-1000',
    input: {
      accountType: 'merchant',
      bakongAccountId: 'khqr@devb',
      merchantId: '123456',
      acquiringBank: 'Dev Bank',
      merchantName: 'TINGQR SHOP',
      merchantCity: 'Siem Reap',
      merchantCategoryCode: '5814',
      currency: 'KHR',
      amount: 1000,
      billNumber: 'INV-0001',
      mobileNumber: '85512345678',
      storeLabel: 'Store 1',
      terminalLabel: 'T1',
      purpose: 'Coffee',
      createdAt: NOW,
      expiresAt: NOW + 120000,
    },
  },
  {
    id: 'khqr-encode-individual-khmer',
    input: {
      accountType: 'individual',
      bakongAccountId: 'john_smith@devb',
      merchantName: 'John Smith',
      currency: 'KHR',
      alternateLanguage: { language: 'km', merchantName: 'ចន ស្មីន', merchantCity: 'ភ្នំពញ' },
      createdAt: NOW,
    },
  },
]

function sdkPayload(i) {
  const optional = {
    currency: khqrData.currency[i.currency.toLowerCase()],
    amount: i.amount,
    accountInformation: i.accountInformation,
    acquiringBank: i.acquiringBank,
    merchantCategoryCode: i.merchantCategoryCode,
    billNumber: i.billNumber,
    mobileNumber: i.mobileNumber,
    storeLabel: i.storeLabel,
    terminalLabel: i.terminalLabel,
    purposeOfTransaction: i.purpose,
    languagePreference: i.alternateLanguage?.language,
    merchantNameAlternateLanguage: i.alternateLanguage?.merchantName,
    merchantCityAlternateLanguage: i.alternateLanguage?.merchantCity,
    expirationTimestamp: i.expiresAt,
  }
  const khqr = new BakongKHQR()
  const r =
    i.accountType === 'merchant'
      ? khqr.generateMerchant(new MerchantInfo(i.bakongAccountId, i.merchantName, i.merchantCity, i.merchantId, i.acquiringBank, optional))
      : khqr.generateIndividual(new IndividualInfo(i.bakongAccountId, i.merchantName, i.merchantCity, optional))
  if (r.status.code !== 0) throw new Error(`SDK refused: ${JSON.stringify(r.status)}`)
  return r.data.qr
}

function expectedFor(i) {
  const dynamic = i.amount !== undefined
  const e = {
    accountType: i.accountType,
    bakongAccountId: i.bakongAccountId,
    initiation: dynamic ? 'dynamic' : 'static',
    currencyCode: i.currency === 'KHR' ? '116' : '840',
    currency: i.currency,
    merchantCategoryCode: i.merchantCategoryCode ?? '5999',
    merchantName: i.merchantName,
    merchantCity: i.merchantCity ?? 'Phnom Penh',
    country: 'KH',
  }
  if (i.accountInformation) e.accountInformation = i.accountInformation
  if (i.merchantId) e.merchantId = i.merchantId
  if (i.acquiringBank) e.acquiringBank = i.acquiringBank
  if (dynamic) e.amount = i.currency === 'USD' && !Number.isInteger(i.amount) ? i.amount.toFixed(2) : String(i.amount)
  const extra = [['01', 'billNumber'], ['02', 'mobileNumber'], ['03', 'storeLabel'], ['07', 'terminalLabel'], ['08', 'purpose']]
  const additional = {}
  for (const [sub, key] of extra) if (i[key]) additional[sub] = e[key] = i[key]
  if (Object.keys(additional).length > 0) e.additionalData = additional
  if (i.alternateLanguage) e.alternateLanguage = { ...i.alternateLanguage }
  if (dynamic) {
    e.createdAt = i.createdAt
    e.expiresAt = i.expiresAt
    e.timestamp = { '00': String(i.createdAt), '01': String(i.expiresAt) }
  }
  return e
}

mkdirSync(OUT, { recursive: true })
for (const c of CASES) {
  const payload = sdkPayload(c.input)
  const check = BakongKHQR.verify(payload)
  if (!check.isValid && check.errorCode !== EXPIRED) throw new Error(`${c.id}: SDK verify rejects ${payload}`)
  const vector = {
    id: c.id,
    scheme: 'khqr',
    kind: 'valid',
    payload,
    input: c.input,
    expected: expectedFor(c.input),
    source: 'bakong-khqr@1.0.20 BakongKHQR.generateIndividual/generateMerchant (ISC declared in package.json, no LICENSE file; official NBC SDK) with Date.now pinned to 1731000000000; BakongKHQR.verify accepts it',
    note: 'Generated by conformance/tools/oracle/gen-khqr.mjs. The SDK writes tag 99 only for dynamic codes, so a static input\'s createdAt does not appear in the payload.',
  }
  writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(vector, null, 2) + '\n')
  console.log(c.id)
}
