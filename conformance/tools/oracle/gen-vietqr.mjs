// Generate VietQR conformance vectors from two independent MIT-licensed implementations:
//   vietqr@1.2.0 (Casso, genQRText) and vietnam-qr-pay@1.5.1 (xuannghia, QRPay.initVietQR).
// A vector is written only when both agree. If they disagree the script prints both strings and exits 1;
// a human decides and records the reason in the vector's `note`. Cases one oracle cannot express use the
// other alone and say "single oracle" in `source`.
//
// Run: cd conformance/tools/oracle && pnpm install && node gen-vietqr.mjs
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { genQRText } = require('vietqr')
const { QRPay, VietQRService } = require('vietnam-qr-pay')

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vectors', 'vietqr')

const CASES = [
  { id: 'vietqr-static-account', bankBin: '970422', accountNumber: '0123456789' },
  { id: 'vietqr-dynamic-amount-purpose', bankBin: '970422', accountNumber: '0123456789', amount: '50000', purpose: 'TINGQR TEST' },
  { id: 'vietqr-amount-13-digits', bankBin: '970436', accountNumber: '1234567890', amount: '1234567890123' },
  { id: 'vietqr-purpose-95-chars', bankBin: '970415', accountNumber: '9876543210', amount: '10000', purpose: 'A'.repeat(95) },
  { id: 'vietqr-card', bankBin: '970422', accountNumber: '9704220123456789', service: 'card', amount: '20000' },
]

function fromVietqr(c) {
  if (c.service === 'card') return undefined // genQRText always writes QRIBFTTA
  return genQRText({ acqId: c.bankBin, accountNo: c.accountNumber, amount: c.amount, addInfo: c.purpose })
}

function fromVietnamQrPay(c) {
  return QRPay.initVietQR({
    bankBin: c.bankBin,
    bankNumber: c.accountNumber,
    amount: c.amount,
    purpose: c.purpose,
    service: c.service === 'card' ? VietQRService.BY_CARD_NUMBER : VietQRService.BY_ACCOUNT_NUMBER,
  }).build()
}

mkdirSync(OUT, { recursive: true })
let failed = false
for (const c of CASES) {
  const a = fromVietqr(c)
  const b = fromVietnamQrPay(c)
  if (a !== undefined && a !== b) {
    console.error(`DISAGREE ${c.id}\n  vietqr@1.2.0:        ${a}\n  vietnam-qr-pay@1.5.1: ${b}`)
    failed = true
    continue
  }
  const input = { bankBin: c.bankBin, accountNumber: c.accountNumber }
  if (c.service) input.service = c.service
  if (c.amount) input.amount = c.amount
  if (c.purpose) input.purpose = c.purpose
  const expected = {
    bankBin: c.bankBin,
    accountNumber: c.accountNumber,
    service: c.service ?? 'account',
    initiation: c.amount ? 'dynamic' : 'static',
    currency: '704',
    country: 'VN',
  }
  if (c.amount) expected.amount = c.amount
  if (c.purpose) {
    expected.purpose = c.purpose
    expected.additionalData = { '08': c.purpose }
  }
  const source =
    a !== undefined
      ? 'vietqr@1.2.0 genQRText + vietnam-qr-pay@1.5.1 QRPay.initVietQR (both MIT), agree; fake account'
      : 'vietnam-qr-pay@1.5.1 QRPay.initVietQR (MIT), single oracle (vietqr@1.2.0 cannot write QRIBFTTC); fake account'
  const vector = { id: c.id, scheme: 'vietqr', kind: 'valid', payload: b, input, expected, source }
  writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(vector, null, 2) + '\n')
  console.log(`wrote ${c.id}`)
}
process.exit(failed ? 1 : 0)
