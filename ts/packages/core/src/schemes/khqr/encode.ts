import { requireInput, TingQrError } from '../../errors.js'
import { buildPayload } from '../../emv/payload.js'
import { field, type TlvField } from '../../emv/tlv.js'
import type { KhqrInput } from './types.js'

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/
const KHR_AMOUNT = /^\d+$/
const USD_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/
/** Longest tag 54 the SDK accepts (INVALID_LENGTH.AMOUNT). */
const MAX_AMOUNT_LENGTH = 13
const CURRENCY_CODE = { KHR: '116', USD: '840' } as const
/** Accepted `currency` inputs: the alphabetic code, or the numeric code that decodeKhqr returns. */
const CURRENCY_ALPHA: Readonly<Record<string, 'KHR' | 'USD'>> = { KHR: 'KHR', USD: 'USD', '116': 'KHR', '840': 'USD' }
/** name@bank: exactly one '@', with a non-empty name and bank. */
const BAKONG_ACCOUNT = /^[^@]+@[^@]+$/

function invalid(message: string, tag: string): TingQrError {
  return new TingQrError('INVALID_VALUE', message, tag)
}

/** An optional (or, with `required`, mandatory) text field of at most `max` characters. */
function text(value: unknown, name: string, tag: string, max: number, opts: { required?: boolean; ascii?: boolean } = {}) {
  if (value === undefined || value === '') {
    if (opts.required) throw invalid(`${name} is required.`, tag)
    return undefined
  }
  if (typeof value !== 'string') throw invalid(`${name} must be a string.`, tag)
  if (opts.ascii !== false && !PRINTABLE_ASCII.test(value)) {
    throw new TingQrError('NON_ASCII', `${name} must be printable ASCII; only alternateLanguage may hold other scripts.`, tag)
  }
  const length = [...value].length
  if (length > max) throw invalid(`${name} is ${length} characters; the maximum is ${max}.`, tag)
  return value
}

function timestamp(value: unknown, name: string, tag: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !/^\d{13}$/.test(String(value))) {
    throw invalid(`${name} must be Unix milliseconds (13 digits).`, tag)
  }
  return value
}

/** Tag 54 as the SDK writes it: KHR whole, USD whole or with two decimals. Undefined for no amount. */
function amountText(amount: unknown, currency: 'KHR' | 'USD'): string | undefined {
  if (amount === undefined || amount === '') return undefined
  const raw = typeof amount === 'number' || typeof amount === 'string' ? String(amount) : ''
  let out: string | undefined
  if (currency === 'KHR') {
    if (KHR_AMOUNT.test(raw)) out = raw.replace(/^0+(?=\d)/, '')
  } else {
    const m = USD_AMOUNT.exec(raw)
    if (m) out = m[1]!.replace(/^0+(?=\d)/, '') + (m[2] === undefined ? '' : '.' + m[2].padEnd(2, '0'))
  }
  if (out === undefined || /^[0.]+$/.test(out) || out.length > MAX_AMOUNT_LENGTH) {
    throw invalid(
      currency === 'KHR'
        ? `Amount ${JSON.stringify(amount)} must be a whole number of KHR greater than zero.`
        : `Amount ${JSON.stringify(amount)} must be greater than zero with at most 2 decimals.`,
      '54',
    )
  }
  return out
}

function accountTemplate(input: KhqrInput): ['29' | '30', string] {
  const merchant = input.accountType === 'merchant'
  if (!merchant && input.accountType !== 'individual') {
    throw invalid(`accountType ${JSON.stringify(input.accountType)} must be 'individual' or 'merchant'.`, '29')
  }
  const tag = merchant ? '30' : '29'
  const account = text(input.bakongAccountId, 'bakongAccountId', `${tag}.00`, 32, { required: true }) as string
  if (!BAKONG_ACCOUNT.test(account)) throw invalid('bakongAccountId must be name@bank with exactly one "@".', `${tag}.00`)
  if (merchant && input.accountInformation !== undefined) {
    throw invalid('accountInformation is for individual accounts; a merchant uses merchantId.', '30')
  }
  if (!merchant && input.merchantId !== undefined) {
    throw invalid('merchantId is for merchant accounts; an individual uses accountInformation.', '29')
  }
  const first = merchant
    ? text(input.merchantId, 'merchantId', '30.01', 32, { required: true })
    : text(input.accountInformation, 'accountInformation', '29.01', 32)
  const bank = text(input.acquiringBank, 'acquiringBank', `${tag}.02`, 32, { required: merchant })
  let value = field('00', account)
  if (first !== undefined) value += field('01', first)
  if (bank !== undefined) value += field('02', bank)
  return [tag, value]
}

/**
 * Build a Cambodian KHQR payload, in the tag order of the official Bakong SDK (00, 01, 29/30, 52, 53, 54, 58, 59, 60,
 * 62, 64, 99, 63). Timestamps come from `createdAt`/`expiresAt`, never from the clock, so the same input always gives
 * the same payload. Tag 99 is written for a dynamic code, or for a static one when `expiresAt` is given. Throws
 * TingQrError on invalid input; never rounds or silently changes it.
 */
export function encodeKhqr(input: KhqrInput): string {
  requireInput('encodeKhqr', input)
  const [accountTag, account] = accountTemplate(input)
  const mcc = input.merchantCategoryCode ?? '5999'
  if (typeof mcc !== 'string' || !/^\d{4}$/.test(mcc)) throw invalid('merchantCategoryCode must be 4 digits.', '52')
  const currency = typeof input.currency === 'string' && Object.hasOwn(CURRENCY_ALPHA, input.currency) ? CURRENCY_ALPHA[input.currency]! : undefined
  if (!currency) throw invalid("currency must be 'KHR', 'USD', '116' or '840'.", '53')
  const amount = amountText(input.amount, currency)
  const name = text(input.merchantName, 'merchantName', '59', 25, { required: true }) as string
  const city = text(input.merchantCity, 'merchantCity', '60', 15) ?? 'Phnom Penh'

  const extra: [string, string, unknown][] = [
    ['01', 'billNumber', input.billNumber],
    ['02', 'mobileNumber', input.mobileNumber],
    ['03', 'storeLabel', input.storeLabel],
    ['07', 'terminalLabel', input.terminalLabel],
    ['08', 'purpose', input.purpose],
  ]
  let additional = ''
  for (const [sub, key, value] of extra) {
    const v = text(value, key, `62.${sub}`, 25)
    if (v !== undefined) additional += field(sub, v)
  }

  let language = ''
  if (input.alternateLanguage !== undefined) {
    const alt = input.alternateLanguage
    language += field('00', text(alt.language, 'alternateLanguage.language', '64.00', 2, { required: true }) as string)
    const altName = text(alt.merchantName, 'alternateLanguage.merchantName', '64.01', 25, { required: true, ascii: false })
    language += field('01', altName as string)
    const altCity = text(alt.merchantCity, 'alternateLanguage.merchantCity', '64.02', 15, { ascii: false })
    if (altCity !== undefined) language += field('02', altCity)
  }

  const createdAt = timestamp(input.createdAt, 'createdAt', '99.00')
  let expiresAt: number | undefined
  if (input.expiresAt !== undefined) {
    expiresAt = timestamp(input.expiresAt, 'expiresAt', '99.01')
    if (expiresAt <= createdAt) throw invalid('expiresAt must be after createdAt.', '99.01')
  } else if (amount !== undefined) {
    throw invalid('A KHQR with an amount must have expiresAt.', '99.01')
  }

  const fields: TlvField[] = [
    { tag: '00', value: '01' },
    { tag: '01', value: amount ? '12' : '11' },
    { tag: accountTag, value: account },
    { tag: '52', value: mcc },
    { tag: '53', value: CURRENCY_CODE[currency] },
  ]
  if (amount) fields.push({ tag: '54', value: amount })
  fields.push({ tag: '58', value: 'KH' }, { tag: '59', value: name }, { tag: '60', value: city })
  if (additional) fields.push({ tag: '62', value: additional })
  if (language) fields.push({ tag: '64', value: language })
  if (expiresAt !== undefined) fields.push({ tag: '99', value: field('00', String(createdAt)) + field('01', String(expiresAt)) })
  return buildPayload(fields)
}
