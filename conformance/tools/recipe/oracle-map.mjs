// Build a vector's `expected` without tingqr: semantic fields (bank, account, service, merchant id, amount, initiation)
// come from vietnam-qr-pay@1.5.1's parser (independent, MIT); pure TLV extraction (tag 62 sub-tags, extra tags,
// merchant tags) comes from this tool's own TLV reader. The two must agree where they overlap, or this throws.
import { createRequire } from 'node:module'
import { parse } from './tlv.mjs'

const require = createRequire(import.meta.url)
const { QRPay } = require('vietnam-qr-pay')

const SCHEMES = {
  vietqr: { guid: 'A000000727', tag: '38', required: ['53', '58'], interpreted: ['00', '01', '38', '52', '53', '54', '58', '59', '60', '62', '63'] },
  vnpay: { guid: 'A000000775', tag: '26', required: ['52', '53', '58', '59', '60'], interpreted: ['00', '01', '26', '52', '53', '54', '58', '59', '60', '62', '63'] },
}
const NAMED_62 = { '01': 'billNumber', '02': 'mobileNumber', '03': 'store', '04': 'loyaltyNumber', '05': 'reference', '06': 'customerLabel', '07': 'terminal', '08': 'purpose' }

function schemeOf(fields) {
  for (const [name, s] of Object.entries(SCHEMES)) {
    const t = fields.find((f) => f.tag === s.tag)
    if (t && parse(t.value).find((n) => n.tag === '00')?.value.toUpperCase() === s.guid) return name
  }
  throw new Error('neither VietQR nor VNPAY')
}

function must(cond, what) {
  if (!cond) throw new Error(`oracle and TLV reader disagree on ${what}`)
}

/** @returns {{ scheme: 'vietqr'|'vnpay', expected: object, missing: string[] }} */
export function oracleExpected(payload) {
  const fields = parse(payload)
  const scheme = schemeOf(fields)
  const s = SCHEMES[scheme]
  const get = (tag) => fields.find((f) => f.tag === tag)?.value
  const missing = s.required.filter((t) => get(t) === undefined)
  const q = new QRPay(payload)
  if (!q.isValid) throw new Error('vietnam-qr-pay rejects this payload (CRC or structure)')

  const initiation = get('01') === '12' ? 'dynamic' : 'static'
  must(q.initMethod === get('01'), 'tag 01')
  const e = {}
  if (scheme === 'vietqr') {
    const beneficiary = parse(parse(get('38')).find((n) => n.tag === '01').value)
    e.bankBin = q.consumer.bankBin
    e.accountNumber = q.consumer.bankNumber
    must(e.bankBin === beneficiary.find((n) => n.tag === '00')?.value, 'bank BIN')
    must(e.accountNumber === beneficiary.find((n) => n.tag === '01')?.value, 'account number')
    e.service = q.provider.service === 'QRIBFTTC' ? 'card' : 'account'
    e.initiation = initiation
  } else {
    const provider = parse(get('26'))
    e.merchantId = q.merchant.id
    must(e.merchantId === provider.find((n) => n.tag === '01')?.value, 'merchant id')
    e.initiation = initiation
    const other = provider.filter((n) => n.tag !== '00' && n.tag !== '01')
    if (other.length) e.providerData = Object.fromEntries(other.map((n) => [n.tag, n.value]))
  }
  if (q.amount !== undefined && q.amount !== '') {
    must(q.amount === get('54'), 'amount')
    e.amount = q.amount
  }
  e.currency = get('53') ?? '704'
  e.country = get('58') ?? 'VN'
  if (get('59') !== undefined) e.merchantName = get('59')
  if (get('60') !== undefined) e.merchantCity = get('60')
  if (get('52') !== undefined) e.merchantCategoryCode = get('52')
  if (get('62') !== undefined) {
    const add = Object.fromEntries(parse(get('62')).map((n) => [n.tag, n.value]))
    e.additionalData = add
    if (scheme === 'vietqr') {
      if (add['08'] !== undefined) e.purpose = add['08']
    } else {
      for (const [sub, name] of Object.entries(NAMED_62)) if (add[sub] !== undefined) e[name] = add[sub]
    }
  }
  const extra = fields.filter((f) => !s.interpreted.includes(f.tag))
  if (extra.length) e.extraFields = Object.fromEntries(extra.map((f) => [f.tag, f.value]))
  return { scheme, expected: e, missing }
}
