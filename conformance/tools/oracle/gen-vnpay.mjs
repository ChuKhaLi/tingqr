// Generate VNPAY-QR conformance vectors with vietnam-qr-pay@1.5.1 (xuannghia, MIT), the only library we know that
// writes VNPAY-QR — so every vector says "single oracle". The oracle omits tags 52 and 60, like real VNPAY codes, so
// vectors are `lenient`: strict mode must fail with MISSING_TAG, lenient mode must read `expected` with one
// MISSING_OPTIONAL_TAG per missing tag. `expected` is built from the case inputs, never from tingqr.
//
// Run: cd conformance/tools/oracle && pnpm install && node gen-vnpay.mjs
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { QRPay } = require('vietnam-qr-pay')

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vectors', 'vnpay')

const CASES = [
  { id: 'vnpay-static', merchantId: '0123456789', merchantName: 'TINGQR SHOP', store: 'TINGQR STORE', terminal: 'TQ01' },
  {
    id: 'vnpay-amount-purpose-ref',
    merchantId: '0123456789',
    merchantName: 'TINGQR SHOP',
    store: 'TINGQR STORE',
    terminal: 'TQ01',
    amount: '150000',
    purpose: 'TINGQR TEST',
    reference: 'REF0001',
  },
  {
    id: 'vnpay-bill-mobile',
    merchantId: '0987654321',
    merchantName: 'TINGQR BILL',
    store: 'BILL STORE',
    terminal: 'TQ02',
    amount: '250000',
    billNumber: 'HD0001',
    mobileNumber: '0900000000',
  },
]

const SUB = { billNumber: '01', mobileNumber: '02', store: '03', reference: '05', terminal: '07', purpose: '08' }

mkdirSync(OUT, { recursive: true })
for (const c of CASES) {
  const { id, ...options } = c
  const payload = QRPay.initVNPayQR(options).build()
  // The oracle writes tag 01 = '11' even with an amount (as real VNPAY codes do).
  if (!payload.startsWith('000201010211')) throw new Error(`${id}: unexpected tag 01 in ${payload}`)
  const expected = {
    merchantId: c.merchantId,
    initiation: 'static',
    currency: '704',
    country: 'VN',
    merchantName: c.merchantName,
  }
  if (c.amount) expected.amount = c.amount
  const additionalData = {}
  for (const [name, sub] of Object.entries(SUB)) {
    if (c[name] !== undefined) {
      additionalData[sub] = c[name]
      expected[name] = c[name]
    }
  }
  expected.additionalData = additionalData
  const vector = {
    id,
    scheme: 'vnpay',
    kind: 'lenient',
    payload,
    expected,
    error: 'MISSING_TAG',
    errorTag: '52',
    warnings: ['MISSING_OPTIONAL_TAG', 'MISSING_OPTIONAL_TAG'],
    source: 'vietnam-qr-pay@1.5.1 QRPay.initVNPayQR (MIT), single oracle; fake merchant',
    note: 'The oracle omits tags 52 and 60, like real VNPAY codes: strict fails on 52, lenient warns for 52 and 60.',
  }
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(vector, null, 2) + '\n')
  console.log(`wrote ${id}`)
}
