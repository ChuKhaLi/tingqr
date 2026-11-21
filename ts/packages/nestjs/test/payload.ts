import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'

const vector = (scheme: string, id: string) =>
  JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'vectors', scheme, `${id}.json`), 'utf8')) as { payload: string; input: Record<string, string> }

/** Sourced VietQR vector: bank 970422, account 0123456789, amount 50000, purpose "TINGQR TEST" (fake account). */
export const VIETQR = vector('vietqr', 'vietqr-dynamic-amount-purpose')
/** Sourced PromptPay payload, for rendering any QR without TingQrModule. */
export const PROMPTPAY: string = vector('promptpay', 'promptpay-dtinth-amount').payload

/** The shared HTTP contract of the SVG integrations (conformance/http/svg-response.json). */
const CONTRACT = JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'http', 'svg-response.json'), 'utf8')) as {
  success: { headers: Record<string, string> }
}
/** The four 200 headers, names as written in the contract (e.g. 'Content-Type'). */
export const SVG_HEADERS: Record<string, string> = CONTRACT.success.headers
/** The same headers with lowercased names, as fetch() reports them. */
export const SVG_HEADERS_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(SVG_HEADERS).map(([k, v]) => [k.toLowerCase(), v]),
)
