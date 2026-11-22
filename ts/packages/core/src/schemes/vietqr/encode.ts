import { requireInput, TingQrError } from '../../errors.js'
import { buildPayload } from '../../emv/payload.js'
import { field, type TlvField } from '../../emv/tlv.js'
import { SERVICE_CODE, VIETQR_GUID, type VietQrInput } from './types.js'

const BIN = /^\d{6}$/
const ACCOUNT = /^[A-Za-z0-9]{3,25}$/
const AMOUNT = /^[1-9]\d{0,12}$/
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/

function amountText(amount: VietQrInput['amount']): string | undefined {
  if (amount === undefined || amount === '') return undefined
  const text = typeof amount === 'number' ? (Number.isInteger(amount) ? String(amount) : 'x') : amount
  if (!AMOUNT.test(text)) {
    throw new TingQrError(
      'INVALID_VALUE',
      `Amount ${JSON.stringify(amount)} must be a whole number of VND, 1–13 digits, greater than zero.`,
      '54',
    )
  }
  return text
}

/** Build a VietQR (NAPAS) payload. Throws TingQrError on invalid input; never silently changes it. */
export function encodeVietQr(input: VietQrInput): string {
  requireInput('encodeVietQr', input)
  if (typeof input.bankBin !== 'string' || !BIN.test(input.bankBin)) {
    throw new TingQrError('INVALID_VALUE', `Bank BIN "${input.bankBin}" must be 6 digits.`, '38')
  }
  if (typeof input.accountNumber !== 'string' || !ACCOUNT.test(input.accountNumber)) {
    throw new TingQrError(
      'INVALID_VALUE',
      `Account number "${input.accountNumber}" must be 3–25 letters or digits.`,
      '38',
    )
  }
  const amount = amountText(input.amount)
  const purpose = input.purpose === '' ? undefined : input.purpose
  if (purpose !== undefined && typeof purpose !== 'string') {
    throw new TingQrError('INVALID_VALUE', 'Purpose must be a string.', '62')
  }
  if (purpose !== undefined && !PRINTABLE_ASCII.test(purpose)) {
    throw new TingQrError(
      'NON_ASCII',
      'Purpose must be printable ASCII; banking apps reject accented text. Use removeVietnameseAccents() first.',
      '62',
    )
  }

  const service = input.service ?? 'account'
  if (!Object.hasOwn(SERVICE_CODE, service)) {
    throw new TingQrError('INVALID_VALUE', `Service "${String(service)}" must be 'account' or 'card'.`, '38')
  }
  const beneficiary = field('00', input.bankBin) + field('01', input.accountNumber)
  const merchant = field('00', VIETQR_GUID) + field('01', beneficiary) + field('02', SERVICE_CODE[service])

  const fields: TlvField[] = [
    { tag: '00', value: '01' },
    { tag: '01', value: amount ? '12' : '11' },
    { tag: '38', value: merchant },
    { tag: '53', value: '704' },
  ]
  if (amount) fields.push({ tag: '54', value: amount })
  fields.push({ tag: '58', value: 'VN' })
  if (purpose !== undefined) fields.push({ tag: '62', value: field('08', purpose) })
  return buildPayload(fields)
}
