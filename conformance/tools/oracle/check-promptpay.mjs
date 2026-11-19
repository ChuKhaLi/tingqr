// Check every PromptPay vector's hand-written `expected` against promptparse@1.7.1 (maythiwat, MIT), an independent
// parser. For each `valid` vector: promptparse must accept the payload in strict mode (CRC checked), and every field
// `expected` names must equal the value promptparse reads from the same tag. Stops at the first mismatch.
//
// Run: cd conformance/tools/oracle && pnpm install && node check-promptpay.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'promptparse'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vectors', 'promptpay')

const AID = {
  A000000677010111: ['29', 'credit-transfer', false],
  A000000677010114: ['29', 'credit-transfer', true],
  A000000677010112: ['30', 'bill-payment', false],
  A000000677012006: ['30', 'bill-payment', true],
}

function check(id, what, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${id}: ${what} is ${JSON.stringify(actual)} per promptparse, expected ${JSON.stringify(expected)}`)
  }
}

let checked = 0
for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  const v = JSON.parse(readFileSync(join(DIR, name), 'utf8'))
  if (v.kind !== 'valid' && v.kind !== 'lenient') continue
  const qr = parse(v.payload, true)
  if (!qr) throw new Error(`${v.id}: promptparse rejects the payload in strict mode`)
  const e = v.expected
  const tag = e.kind === 'credit-transfer' ? '29' : '30'
  const [aidTag, kind, flag] = AID[qr.getTagValue(tag, '00')] ?? []
  check(v.id, 'merchant template tag', aidTag, tag)
  check(v.id, 'kind', kind, e.kind)
  check(v.id, e.kind === 'credit-transfer' ? 'ota' : 'crossBorder', flag, e.kind === 'credit-transfer' ? e.ota : e.crossBorder)
  for (const [sub, value] of Object.entries(e.subFields)) check(v.id, `${tag}.${sub}`, qr.getTagValue(tag, sub), value)
  const subTags = qr.getTag(tag).subTags.map((t) => t.id).filter((t) => t !== '00')
  check(v.id, `${tag} sub-tags`, subTags.sort().join(','), Object.keys(e.subFields).sort().join(','))
  if (e.kind === 'credit-transfer') {
    const sub = { mobile: '01', nationalId: '02', eWallet: '03', bankAccount: '04' }[e.proxyType]
    check(v.id, 'proxy', qr.getTagValue('29', sub), e.proxy)
    check(v.id, 'otaCode', qr.getTagValue('29', '05'), e.otaCode)
  } else {
    check(v.id, 'billerId', qr.getTagValue('30', '01'), e.billerId)
    check(v.id, 'reference1', qr.getTagValue('30', '02'), e.reference1)
    check(v.id, 'reference2', qr.getTagValue('30', '03'), e.reference2)
  }
  check(v.id, 'initiation', qr.getTagValue('01'), e.initiation === 'dynamic' ? '12' : '11')
  check(v.id, 'currency', qr.getTagValue('53'), e.currency)
  check(v.id, 'country', qr.getTagValue('58'), e.country)
  check(v.id, 'amount', qr.getTagValue('54'), e.amount)
  check(v.id, 'merchantName', qr.getTagValue('59'), e.merchantName)
  check(v.id, 'merchantCity', qr.getTagValue('60'), e.merchantCity)
  check(v.id, 'merchantCategoryCode', qr.getTagValue('52'), e.merchantCategoryCode)
  for (const [sub, value] of Object.entries(e.additionalData ?? {})) check(v.id, `62.${sub}`, qr.getTagValue('62', sub), value)
  checked++
}
console.log(`promptparse agrees with ${checked} PromptPay vectors`)
