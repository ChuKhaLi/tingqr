import { TingQrError, type Result, type Warning } from '../../errors.js'
import { readAdditionalData, readExtraFields } from '../../emv/fields.js'
import { getField, parsePayload, type ParseMode } from '../../emv/payload.js'
import { parseTemplate } from '../../emv/tlv.js'
import { VNPAY_GUID, type VnpayQrData } from './types.js'

const INTERPRETED_TAGS: ReadonlySet<string> = new Set(['00', '01', '26', '52', '53', '54', '58', '59', '60', '62', '63'])

/** Tags the EMV standard requires that VNPAY codes often omit, in the order they are checked. */
const STANDARD_TAGS = ['52', '53', '58', '59', '60'] as const
const DEFAULTS: Partial<Record<(typeof STANDARD_TAGS)[number], string>> = { '53': '704', '58': 'VN' }

const ADDITIONAL_NAMES = {
  '01': 'billNumber',
  '02': 'mobileNumber',
  '03': 'store',
  '04': 'loyaltyNumber',
  '05': 'reference',
  '06': 'customerLabel',
  '07': 'terminal',
  '08': 'purpose',
} as const

function fail(code: TingQrError['code'], message: string, tag?: string): { ok: false; error: TingQrError } {
  return { ok: false, error: new TingQrError(code, message, tag) }
}

/**
 * Read a VNPAY-QR merchant payload. Strict mode (default) requires the EMV tags 52, 53, 58, 59 and 60; real VNPAY
 * codes usually lack 52 and 60, so read them with `{ mode: 'lenient' }`, which warns instead.
 */
export function decodeVnpayQr(payload: string, options: { mode?: ParseMode } = {}): Result<VnpayQrData> {
  const mode = options.mode ?? 'strict'
  const parsed = parsePayload(payload)
  if (!parsed.ok) return parsed
  const p = parsed.value
  const warnings: Warning[] = [...parsed.warnings]

  try {
    const providerValue = getField(p, '26')?.value
    const provider = providerValue === undefined ? undefined : parseTemplate(providerValue, '26')
    const guid = provider?.find((n) => n.tag === '00')?.value
    if (!provider || guid?.toUpperCase() !== VNPAY_GUID) {
      return fail('UNSUPPORTED_SCHEME', 'Not a VNPAY-QR payload: tag 26 with GUID A000000775 is missing.', '26')
    }
    const merchantId = provider.find((n) => n.tag === '01')?.value
    if (merchantId === undefined) return fail('MISSING_TAG', 'Tag 26.01 (merchant ID) is missing.', '26.01')

    if (getField(p, '00')?.value !== '01') {
      return fail('INVALID_VALUE', 'Tag 00 (payload format indicator) must be "01".', '00')
    }
    const poi = getField(p, '01')?.value
    if (poi !== '11' && poi !== '12') {
      return fail('INVALID_VALUE', `Tag 01 (point of initiation) is "${poi}", expected 11 or 12.`, '01')
    }

    const standard: Partial<Record<(typeof STANDARD_TAGS)[number], string>> = {}
    for (const tag of STANDARD_TAGS) {
      const value = getField(p, tag)?.value
      if (value !== undefined) {
        standard[tag] = value
        continue
      }
      if (mode === 'strict') return fail('MISSING_TAG', `Tag ${tag} is required by the EMV standard.`, tag)
      const fallback = DEFAULTS[tag]
      if (fallback !== undefined) standard[tag] = fallback
      warnings.push({
        code: 'MISSING_OPTIONAL_TAG',
        message: fallback === undefined ? `Tag ${tag} is missing.` : `Tag ${tag} is missing; assumed "${fallback}".`,
        tag,
      })
    }

    const value: VnpayQrData = {
      merchantId,
      initiation: poi === '12' ? 'dynamic' : 'static',
      currency: standard['53'] as string,
      country: standard['58'] as string,
    }
    const providerData = provider.filter((n) => n.tag !== '00' && n.tag !== '01')
    if (providerData.length > 0) value.providerData = Object.fromEntries(providerData.map((n) => [n.tag, n.value]))
    const amount = getField(p, '54')?.value
    if (amount !== undefined) value.amount = amount
    if (standard['59'] !== undefined) value.merchantName = standard['59']
    if (standard['60'] !== undefined) value.merchantCity = standard['60']
    if (standard['52'] !== undefined) value.merchantCategoryCode = standard['52']

    const additional = readAdditionalData(p)
    if (additional) {
      value.additionalData = additional
      for (const [sub, name] of Object.entries(ADDITIONAL_NAMES)) {
        if (additional[sub] !== undefined) value[name] = additional[sub]
      }
    }
    const extra = readExtraFields(p, INTERPRETED_TAGS)
    if (extra) value.extraFields = extra
    return { ok: true, value, warnings }
  } catch (e) {
    if (e instanceof TingQrError) return { ok: false, error: e }
    throw e
  }
}
