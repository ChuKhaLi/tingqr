import { TingQrError, type Result, type Warning } from '../../errors.js'
import { readAdditionalData, readExtraFields } from '../../emv/fields.js'
import { getField, parsePayload, type EmvPayload, type ParseMode } from '../../emv/payload.js'
import { assertUniqueTags, parseTemplate, parseTlv, type TlvNode } from '../../emv/tlv.js'
import type { KhqrData } from './types.js'

/** EMV tags KHQR requires, in the order they are checked. 53 has no default: KHR and USD are both common. */
const REQUIRED_TAGS = ['52', '53', '58', '59', '60'] as const
const CURRENCY: Readonly<Record<string, 'KHR' | 'USD'>> = { '116': 'KHR', '840': 'USD' }
const ADDITIONAL_NAMES = {
  '01': 'billNumber',
  '02': 'mobileNumber',
  '03': 'storeLabel',
  '07': 'terminalLabel',
  '08': 'purpose',
} as const
const TIMESTAMP = /^\d{13}$/
/** name@bank: exactly one '@', with a non-empty name and bank. */
const BAKONG_ACCOUNT = /^[^@]+@[^@]+$/

function fail(code: TingQrError['code'], message: string, tag?: string): { ok: false; error: TingQrError } {
  return { ok: false, error: new TingQrError(code, message, tag) }
}

function sub(nodes: TlvNode[], tag: string): string | undefined {
  return nodes.find((n) => n.tag === tag)?.value
}

/**
 * The sub-fields of tag 29/30 when it is clean TLV whose 00 is a Bakong account ('name@bank'). A PromptPay AID in the
 * same tag never contains '@', so one tag is never read as both; a payload may still carry PromptPay in one of 29/30
 * and KHQR in the other (detect() then reports both).
 */
function readAccount(p: EmvPayload, tag: '29' | '30'): TlvNode[] | undefined {
  const value = getField(p, tag)?.value
  if (value === undefined) return undefined
  let nodes: TlvNode[]
  try {
    nodes = parseTlv(value)
  } catch {
    return undefined
  }
  const account = sub(nodes, '00')
  if (account === undefined || !BAKONG_ACCOUNT.test(account)) return undefined
  assertUniqueTags(nodes, tag)
  return nodes
}

/**
 * Read a Cambodian KHQR (Bakong) payload, individual (tag 29) or merchant (tag 30). Lenient mode (default) accepts
 * codes missing tags 52/58/59/60 or a dynamic code without an expiry (99.01), reporting each in `warnings`;
 * `{ mode: 'strict' }` rejects them. Missing tag 53 is an error in both modes. Never compares with the clock: use
 * `isKhqrExpired(data, now)`.
 */
export function decodeKhqr(payload: string, options: { mode?: ParseMode } = {}): Result<KhqrData> {
  const parsed = parsePayload(payload)
  if (!parsed.ok) return parsed
  return readKhqr(parsed.value, parsed.warnings, options.mode ?? 'lenient')
}

/** decodeKhqr on a payload already parsed by parsePayload; detect() uses it so the payload is parsed once. */
export function readKhqr(p: EmvPayload, parsedWarnings: readonly Warning[], mode: ParseMode): Result<KhqrData> {
  const warnings: Warning[] = [...parsedWarnings]

  try {
    const individual = readAccount(p, '29')
    const merchant = individual ? undefined : readAccount(p, '30')
    const account = individual ?? merchant
    if (!account) {
      return fail('UNSUPPORTED_SCHEME', 'Not a KHQR payload: no tag 29 or 30 holding a Bakong account (name@bank).', '29')
    }
    const accountTag = individual ? '29' : '30'
    if (merchant) {
      for (const [s, what] of [['01', 'merchant ID'], ['02', 'acquiring bank']] as const) {
        if (sub(merchant, s) === undefined) return fail('MISSING_TAG', `Tag 30.${s} (${what}) is missing.`, `30.${s}`)
      }
    }

    if (getField(p, '00')?.value !== '01') {
      return fail('INVALID_VALUE', 'Tag 00 (payload format indicator) must be "01".', '00')
    }
    const poi = getField(p, '01')?.value
    if (poi !== '11' && poi !== '12') {
      return fail('INVALID_VALUE', `Tag 01 (point of initiation) is "${poi}", expected 11 or 12.`, '01')
    }

    const standard: Partial<Record<(typeof REQUIRED_TAGS)[number], string>> = {}
    for (const tag of REQUIRED_TAGS) {
      const value = getField(p, tag)?.value
      if (value !== undefined) {
        standard[tag] = value
        continue
      }
      if (mode === 'strict' || tag === '53') return fail('MISSING_TAG', `Tag ${tag} is required by KHQR.`, tag)
      if (tag === '58') standard[tag] = 'KH'
      warnings.push({
        code: 'MISSING_OPTIONAL_TAG',
        message: tag === '58' ? 'Tag 58 is missing; assumed "KH".' : `Tag ${tag} is missing.`,
        tag,
      })
    }

    const value: KhqrData = {
      accountType: individual ? 'individual' : 'merchant',
      bakongAccountId: sub(account, '00') as string,
      initiation: poi === '12' ? 'dynamic' : 'static',
      currencyCode: standard['53'] as string,
      country: standard['58'] as string,
    }
    const accountFields: [string, 'accountInformation' | 'merchantId' | 'acquiringBank'][] = [
      ['01', individual ? 'accountInformation' : 'merchantId'],
      ['02', 'acquiringBank'],
    ]
    for (const [s, key] of accountFields) {
      const v = sub(account, s)
      if (v !== undefined) value[key] = v
    }
    const currency = CURRENCY[value.currencyCode]
    if (currency) value.currency = currency
    if (standard['52'] !== undefined) value.merchantCategoryCode = standard['52']
    if (standard['59'] !== undefined) value.merchantName = standard['59']
    if (standard['60'] !== undefined) value.merchantCity = standard['60']
    const optional: [string, 'amount' | 'postalCode' | 'unionPay'][] = [
      ['54', 'amount'],
      ['61', 'postalCode'],
      ['15', 'unionPay'],
    ]
    for (const [tag, key] of optional) {
      const v = getField(p, tag)?.value
      if (v !== undefined) value[key] = v
    }

    const additional = readAdditionalData(p)
    if (additional) {
      value.additionalData = additional
      for (const [s, name] of Object.entries(ADDITIONAL_NAMES)) {
        if (additional[s] !== undefined) value[name] = additional[s]
      }
    }
    const language = getField(p, '64')?.value
    if (language !== undefined) {
      const nodes = parseTemplate(language, '64')
      const alt: NonNullable<KhqrData['alternateLanguage']> = {}
      const names = [['00', 'language'], ['01', 'merchantName'], ['02', 'merchantCity']] as const
      for (const [s, key] of names) {
        const v = sub(nodes, s)
        if (v !== undefined) alt[key] = v
      }
      value.alternateLanguage = alt
    }
    const stamp = getField(p, '99')?.value
    const timestamp = stamp === undefined ? undefined : Object.fromEntries(parseTemplate(stamp, '99').map((n) => [n.tag, n.value]))
    if (timestamp) {
      value.timestamp = timestamp
      const times = [['00', 'createdAt'], ['01', 'expiresAt']] as const
      for (const [s, key] of times) {
        const v = timestamp[s]
        if (v === undefined) continue
        if (TIMESTAMP.test(v)) value[key] = Number(v)
        else if (mode === 'strict') return fail('INVALID_VALUE', `Tag 99.${s} must be Unix milliseconds (13 digits).`, `99.${s}`)
      }
    }
    if (value.initiation === 'dynamic' && value.expiresAt === undefined) {
      if (mode === 'strict') return fail('MISSING_TAG', 'A dynamic KHQR must carry an expiry time (99.01).', '99.01')
      warnings.push({
        code: 'MISSING_OPTIONAL_TAG',
        message: 'Dynamic KHQR without a readable expiry time (99.01).',
        tag: '99.01',
      })
    }

    const interpreted = new Set(['00', '01', '15', accountTag, '52', '53', '54', '58', '59', '60', '61', '62', '63', '64', '99'])
    const extra = readExtraFields(p, interpreted)
    if (extra) value.extraFields = extra
    return { ok: true, value, warnings }
  } catch (e) {
    if (e instanceof TingQrError) return { ok: false, error: e }
    throw e
  }
}

/**
 * Whether `data` has expired at `nowMs` (Unix milliseconds): true once `nowMs` is past `expiresAt`, as the Bakong SDK
 * checks. Undefined when the code has no 13-digit expiry time. Pass the time explicitly; tingqr never reads the clock.
 */
export function isKhqrExpired(data: KhqrData, nowMs: number): boolean | undefined {
  return data.expiresAt === undefined ? undefined : nowMs > data.expiresAt
}
