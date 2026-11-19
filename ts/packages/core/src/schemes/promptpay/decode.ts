import { TingQrError, type Result, type Warning } from '../../errors.js'
import { readAdditionalData, readExtraFields, readSchemeTemplate } from '../../emv/fields.js'
import { getField, parsePayload, type EmvPayload, type ParseMode } from '../../emv/payload.js'
import type { TlvNode } from '../../emv/tlv.js'
import {
  PROMPTPAY_AID,
  type PromptPayBillPayment,
  type PromptPayCreditTransfer,
  type PromptPayData,
  type PromptPayProxyType,
} from './types.js'

const PROXY_SUBTAGS: readonly [string, PromptPayProxyType][] = [
  ['01', 'mobile'],
  ['02', 'nationalId'],
  ['03', 'eWallet'],
  ['04', 'bankAccount'],
]
const MOBILE = /^0066(\d{9})$/
const DEFAULTS = { '53': '764', '58': 'TH' } as const

function fail(code: TingQrError['code'], message: string, tag?: string): { ok: false; error: TingQrError } {
  return { ok: false, error: new TingQrError(code, message, tag) }
}

function subFields(nodes: TlvNode[]): Record<string, string> {
  return Object.fromEntries(nodes.filter((n) => n.tag !== '00').map((n) => [n.tag, n.value]))
}

/** The first of the given AIDs whose template is present in `tag`, with its sub-fields. */
function findTemplate(p: EmvPayload, tag: string, aids: readonly string[]): [string, TlvNode[]] | undefined {
  for (const aid of aids) {
    const nodes = readSchemeTemplate(p, tag, aid)
    if (nodes) return [aid, nodes]
  }
  return undefined
}

/**
 * Read a Thai PromptPay payload: credit transfer (tag 29) or bill payment (tag 30). Lenient mode (default) fills tags
 * 53/58 when missing and accepts a tag 29 without a proxy, reporting each in `warnings`; `{ mode: 'strict' }` rejects
 * them instead. TrueMoney and other e-wallets are returned as `proxyType: 'eWallet'` without a provider label.
 */
export function decodePromptPayQr(payload: string, options: { mode?: ParseMode } = {}): Result<PromptPayData> {
  const parsed = parsePayload(payload)
  if (!parsed.ok) return parsed
  return readPromptPayQr(parsed.value, parsed.warnings, options.mode ?? 'lenient')
}

/** decodePromptPayQr on a payload already parsed by parsePayload; detect() uses it so the payload is parsed once. */
export function readPromptPayQr(p: EmvPayload, parsedWarnings: readonly Warning[], mode: ParseMode): Result<PromptPayData> {
  const warnings: Warning[] = [...parsedWarnings]

  try {
    let merchant: PromptPayCreditTransfer | PromptPayBillPayment
    let merchantTag: '29' | '30'
    const transfer = findTemplate(p, '29', [PROMPTPAY_AID.creditTransfer, PROMPTPAY_AID.ota])
    const bill = transfer ? undefined : findTemplate(p, '30', [PROMPTPAY_AID.billPayment, PROMPTPAY_AID.billPaymentCrossBorder])
    if (transfer) {
      const [aid, nodes] = transfer
      merchantTag = '29'
      const first = PROXY_SUBTAGS.map(([sub, type]) => [nodes.find((n) => n.tag === sub)?.value, type] as const).find(
        ([value]) => value !== undefined,
      )
      if (!first) {
        if (mode === 'strict') return fail('MISSING_TAG', 'Tag 29 has no proxy (sub-tags 01–04).', '29.01')
        warnings.push({ code: 'MISSING_OPTIONAL_TAG', message: 'Tag 29 has no proxy (sub-tags 01–04).', tag: '29' })
      }
      const [proxy, proxyType] = first ?? ['', 'unknown' as const]
      const ct: PromptPayCreditTransfer = {
        kind: 'credit-transfer',
        ota: aid === PROMPTPAY_AID.ota,
        proxyType,
        proxy: proxy as string,
        subFields: subFields(nodes),
      }
      const mobile = proxyType === 'mobile' ? MOBILE.exec(proxy as string) : null
      if (mobile) ct.mobile = '0' + mobile[1]
      const otaCode = nodes.find((n) => n.tag === '05')?.value
      if (otaCode !== undefined) ct.otaCode = otaCode
      merchant = ct
    } else if (bill) {
      const [aid, nodes] = bill
      merchantTag = '30'
      const billerId = nodes.find((n) => n.tag === '01')?.value
      if (billerId === undefined) return fail('MISSING_TAG', 'Tag 30.01 (biller ID) is missing.', '30.01')
      const bp: PromptPayBillPayment = {
        kind: 'bill-payment',
        crossBorder: aid === PROMPTPAY_AID.billPaymentCrossBorder,
        billerId,
        subFields: subFields(nodes),
      }
      const ref1 = nodes.find((n) => n.tag === '02')?.value
      if (ref1 !== undefined) bp.reference1 = ref1
      const ref2 = nodes.find((n) => n.tag === '03')?.value
      if (ref2 !== undefined) bp.reference2 = ref2
      merchant = bp
    } else {
      return fail('UNSUPPORTED_SCHEME', 'Not a PromptPay payload: no tag 29 or 30 with a PromptPay AID.', '29')
    }

    if (getField(p, '00')?.value !== '01') {
      return fail('INVALID_VALUE', 'Tag 00 (payload format indicator) must be "01".', '00')
    }
    const poi = getField(p, '01')?.value
    if (poi !== '11' && poi !== '12') {
      return fail('INVALID_VALUE', `Tag 01 (point of initiation) is "${poi}", expected 11 or 12.`, '01')
    }

    const required: Partial<Record<'53' | '58', string>> = {}
    for (const tag of ['53', '58'] as const) {
      const value = getField(p, tag)?.value
      if (value !== undefined) {
        required[tag] = value
      } else if (mode === 'strict') {
        return fail('MISSING_TAG', `Tag ${tag} is required.`, tag)
      } else {
        required[tag] = DEFAULTS[tag]
        warnings.push({ code: 'MISSING_OPTIONAL_TAG', message: `Tag ${tag} is missing; assumed "${DEFAULTS[tag]}".`, tag })
      }
    }

    const value: PromptPayData = {
      ...merchant,
      initiation: poi === '12' ? 'dynamic' : 'static',
      currency: required['53'] as string,
      country: required['58'] as string,
    }
    const optional: [string, 'amount' | 'merchantName' | 'merchantCity' | 'merchantCategoryCode'][] = [
      ['54', 'amount'],
      ['59', 'merchantName'],
      ['60', 'merchantCity'],
      ['52', 'merchantCategoryCode'],
    ]
    for (const [tag, key] of optional) {
      const v = getField(p, tag)?.value
      if (v !== undefined) value[key] = v
    }
    const additional = readAdditionalData(p)
    if (additional) value.additionalData = additional
    const interpreted = new Set(['00', '01', merchantTag, '52', '53', '54', '58', '59', '60', '62', '63'])
    const extra = readExtraFields(p, interpreted)
    if (extra) value.extraFields = extra
    return { ok: true, value, warnings }
  } catch (e) {
    if (e instanceof TingQrError) return { ok: false, error: e }
    throw e
  }
}
