import { requireInput, TingQrError } from '../../errors.js'
import { buildPayload } from '../../emv/payload.js'
import { field, type TlvField } from '../../emv/tlv.js'
import { PROMPTPAY_AID, type PromptPayInput } from './types.js'

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/
const AMOUNT = /^(\d{1,10})(?:\.(\d{1,2}))?$/
const MOBILE = /^(?:0|66|0066)(\d{9})$/

function invalid(message: string, tag: string): TingQrError {
  return new TingQrError('INVALID_VALUE', message, tag)
}

function digits(value: unknown, lengths: readonly number[], what: string, tag: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !lengths.includes(value.length)) {
    throw invalid(`${what} ${JSON.stringify(value)} must be ${lengths.join(' or ')} digits.`, tag)
  }
  return value
}

function reference(value: unknown, name: string, tag: string): string | undefined {
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw invalid(`${name} must be a string.`, tag)
  if (!PRINTABLE_ASCII.test(value)) throw new TingQrError('NON_ASCII', `${name} must be printable ASCII.`, tag)
  if (value.length > 20) throw invalid(`${name} is ${value.length} characters; the maximum is 20.`, tag)
  return value
}

/** Tag 54 text: two decimals, no float arithmetic. Undefined for no amount. */
function amountText(amount: unknown): string | undefined {
  if (amount === undefined || amount === '') return undefined
  const text = typeof amount === 'number' || typeof amount === 'string' ? String(amount) : ''
  const m = AMOUNT.exec(text)
  const whole = m ? m[1]!.replace(/^0+(?=\d)/, '') : ''
  const cents = m ? (m[2] ?? '').padEnd(2, '0') : ''
  if (!m || (/^0+$/.test(whole) && cents === '00')) {
    throw invalid(
      `Amount ${JSON.stringify(amount)} must be greater than zero, at most 9999999999.99, with at most 2 decimals.`,
      '54',
    )
  }
  return `${whole}.${cents}`
}

function merchantTemplate(target: PromptPayInput['target'] | undefined): ['29' | '30', string] {
  const t = (target ?? {}) as Record<string, unknown>
  const kinds = ['mobile', 'nationalId', 'eWallet', 'billerId'].filter((k) => k in t)
  if (kinds.length > 1) throw invalid(`Target has ${kinds.join(' and ')}; give exactly one recipient.`, '29')
  if ('mobile' in t) {
    const raw = typeof t.mobile === 'string' ? t.mobile.replace(/\D/g, '') : ''
    const m = MOBILE.exec(raw)
    if (!m) throw invalid(`Mobile ${JSON.stringify(t.mobile)} must be a Thai number: 0, 66 or 0066 + 9 digits.`, '29.01')
    return ['29', field('00', PROMPTPAY_AID.creditTransfer) + field('01', '0066' + m[1])]
  }
  if ('nationalId' in t) {
    const id = digits(t.nationalId, [13], 'National or tax ID', '29.02')
    return ['29', field('00', PROMPTPAY_AID.creditTransfer) + field('02', id)]
  }
  if ('eWallet' in t) {
    const id = digits(t.eWallet, [15], 'E-wallet ID', '29.03')
    return ['29', field('00', PROMPTPAY_AID.creditTransfer) + field('03', id)]
  }
  if ('billerId' in t) {
    const biller = digits(t.billerId, [13, 15], 'Biller ID', '30.01')
    const ref1 = reference(t.reference1, 'reference1', '30.02')
    const ref2 = reference(t.reference2, 'reference2', '30.03')
    let value = field('00', PROMPTPAY_AID.billPayment) + field('01', biller)
    if (ref1 !== undefined) value += field('02', ref1)
    if (ref2 !== undefined) value += field('03', ref2)
    return ['30', value]
  }
  throw invalid('Target must be { mobile }, { nationalId }, { eWallet } or { billerId }.', '29')
}

/**
 * Build a Thai PromptPay payload. Tags are written in ascending order (00, 01, 29/30, 53, 54, 58, 63). Throws
 * TingQrError on invalid input; never rounds or silently changes it.
 */
export function encodePromptPayQr(input: PromptPayInput): string {
  requireInput('encodePromptPayQr', input)
  const [tag, merchant] = merchantTemplate(input.target)
  const amount = amountText(input.amount)
  const fields: TlvField[] = [
    { tag: '00', value: '01' },
    { tag: '01', value: amount ? '12' : '11' },
    { tag, value: merchant },
    { tag: '53', value: '764' },
  ]
  if (amount) fields.push({ tag: '54', value: amount })
  fields.push({ tag: '58', value: 'TH' })
  return buildPayload(fields)
}
