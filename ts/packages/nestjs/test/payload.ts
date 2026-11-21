import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'

const vector = (scheme: string, id: string) =>
  JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'vectors', scheme, `${id}.json`), 'utf8')) as { payload: string; input: Record<string, string> }

/** Sourced VietQR vector: bank 970422, account 0123456789, amount 50000, purpose "TINGQR TEST" (fake account). */
export const VIETQR = vector('vietqr', 'vietqr-dynamic-amount-purpose')
/** Sourced PromptPay payload, for rendering any QR without TingQrModule. */
export const PROMPTPAY: string = vector('promptpay', 'promptpay-dtinth-amount').payload
