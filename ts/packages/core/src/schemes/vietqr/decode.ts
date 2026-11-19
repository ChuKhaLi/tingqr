import { TingQrError, type Result, type Warning } from '../../errors.js'
import { readAdditionalData, readExtraFields, readSchemeTemplate } from '../../emv/fields.js'
import { getField, parsePayload, type EmvPayload, type ParseMode } from '../../emv/payload.js'
import { parseTemplate, type TlvNode } from '../../emv/tlv.js'
import { SERVICE_CODE, VIETQR_GUID, type VietQrData, type VietQrService } from './types.js'

function sub(nodes: TlvNode[], tag: string): string | undefined {
  return nodes.find((n) => n.tag === tag)?.value
}

function fail(code: TingQrError['code'], message: string, tag?: string): { ok: false; error: TingQrError } {
  return { ok: false, error: new TingQrError(code, message, tag) }
}

const SERVICE_BY_CODE: ReadonlyMap<string, VietQrService> = new Map(
  (Object.keys(SERVICE_CODE) as VietQrService[]).map((service) => [SERVICE_CODE[service], service]),
)

const INTERPRETED_TAGS: ReadonlySet<string> = new Set(['00', '01', '38', '52', '53', '54', '58', '59', '60', '62', '63'])

/**
 * Read a VietQR payload. Lenient mode (default) fills tags 53/58 when missing and reports every deviation in
 * `warnings`; `{ mode: 'strict' }` rejects them instead (use it to validate codes you generate).
 */
export function decodeVietQr(payload: string, options: { mode?: ParseMode } = {}): Result<VietQrData> {
  const parsed = parsePayload(payload)
  if (!parsed.ok) return parsed
  return readVietQr(parsed.value, parsed.warnings, options.mode ?? 'lenient')
}

/** decodeVietQr on a payload already parsed by parsePayload; detect() uses it so the payload is parsed once. */
export function readVietQr(p: EmvPayload, parsedWarnings: readonly Warning[], mode: ParseMode): Result<VietQrData> {
  const warnings: Warning[] = [...parsedWarnings]

  try {
    const merchant = readSchemeTemplate(p, '38', VIETQR_GUID)
    if (!merchant) {
      return fail('UNSUPPORTED_SCHEME', 'Not a VietQR payload: tag 38 with GUID A000000727 is missing.', '38')
    }

    const beneficiaryValue = sub(merchant, '01')
    if (beneficiaryValue === undefined) return fail('MISSING_TAG', 'Tag 38.01 (beneficiary) is missing.', '38.01')
    const beneficiary = parseTemplate(beneficiaryValue, '38.01')
    const bankBin = sub(beneficiary, '00')
    const accountNumber = sub(beneficiary, '01')
    if (bankBin === undefined || accountNumber === undefined) {
      return fail('MISSING_TAG', 'Tag 38.01 must hold the bank BIN (00) and account number (01).', '38.01')
    }

    const serviceCode = sub(merchant, '02')
    if (serviceCode === undefined) return fail('MISSING_TAG', 'Tag 38.02 (service code) is missing.', '38.02')
    const service = SERVICE_BY_CODE.get(serviceCode)
    if (!service) {
      return fail('INVALID_VALUE', `Service code "${serviceCode}" is not QRIBFTTA or QRIBFTTC.`, '38.02')
    }

    if (getField(p, '00')?.value !== '01') {
      return fail('INVALID_VALUE', 'Tag 00 (payload format indicator) must be "01".', '00')
    }
    const poi = getField(p, '01')?.value
    if (poi !== '11' && poi !== '12') {
      return fail('INVALID_VALUE', `Tag 01 (point of initiation) is "${poi}", expected 11 or 12.`, '01')
    }

    const defaults: Record<'53' | '58', string> = { '53': '704', '58': 'VN' }
    const required: Partial<Record<'53' | '58', string>> = {}
    for (const tag of ['53', '58'] as const) {
      const value = getField(p, tag)?.value
      if (value !== undefined) {
        required[tag] = value
      } else if (mode === 'strict') {
        return fail('MISSING_TAG', `Tag ${tag} is required.`, tag)
      } else {
        required[tag] = defaults[tag]
        warnings.push({
          code: 'MISSING_OPTIONAL_TAG',
          message: `Tag ${tag} is missing; assumed "${defaults[tag]}".`,
          tag,
        })
      }
    }

    const value: VietQrData = {
      bankBin,
      accountNumber,
      service,
      initiation: poi === '12' ? 'dynamic' : 'static',
      currency: required['53'] as string,
      country: required['58'] as string,
    }
    const amount = getField(p, '54')?.value
    if (amount !== undefined) value.amount = amount
    const additional = readAdditionalData(p)
    if (additional) {
      value.additionalData = additional
      if (additional['08'] !== undefined) value.purpose = additional['08']
    }
    const optional: [string, 'merchantName' | 'merchantCity' | 'merchantCategoryCode'][] = [
      ['59', 'merchantName'],
      ['60', 'merchantCity'],
      ['52', 'merchantCategoryCode'],
    ]
    for (const [tag, key] of optional) {
      const v = getField(p, tag)?.value
      if (v !== undefined) value[key] = v
    }
    const extra = readExtraFields(p, INTERPRETED_TAGS)
    if (extra) value.extraFields = extra
    return { ok: true, value, warnings }
  } catch (e) {
    if (e instanceof TingQrError) return { ok: false, error: e }
    throw e
  }
}
