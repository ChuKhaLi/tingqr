import { TingQrError, type Result, type Warning } from './errors.js'
import { parsePayload, type EmvPayload, type ParseMode } from './emv/payload.js'
import { readKhqr } from './schemes/khqr/decode.js'
import type { KhqrData } from './schemes/khqr/types.js'
import { readPromptPayQr } from './schemes/promptpay/decode.js'
import type { PromptPayData } from './schemes/promptpay/types.js'
import { readVietQr } from './schemes/vietqr/decode.js'
import type { VietQrData } from './schemes/vietqr/types.js'
import { readVnpayQr } from './schemes/vnpay/decode.js'
import type { VnpayQrData } from './schemes/vnpay/types.js'

export type Detected =
  | { scheme: 'vietqr'; data: VietQrData }
  | { scheme: 'vnpay'; data: VnpayQrData }
  | { scheme: 'promptpay'; data: PromptPayData }
  | { scheme: 'khqr'; data: KhqrData }

export type DetectResult = Detected & {
  /** Later schemes in the try order that also recognise the payload (e.g. a shop QR with both VietQR and VNPAY). */
  alsoMatches: Detected['scheme'][]
}

type Reader = (p: EmvPayload, warnings: readonly Warning[], mode: ParseMode) => Result<unknown>

/** Try order. A reader "recognises" a payload unless it returns UNSUPPORTED_SCHEME. */
const READERS: readonly [Detected['scheme'], Reader][] = [
  ['vietqr', readVietQr],
  ['vnpay', readVnpayQr],
  ['promptpay', readPromptPayQr],
  ['khqr', readKhqr],
]

/**
 * Read any payment QR tingqr supports. The payload is parsed once; schemes are tried in the order VietQR, VNPAY,
 * PromptPay, KHQR, in lenient mode. The first scheme that recognises the payload gives the result, or its error (an
 * error is not a reason to try the next scheme). No scheme: UNKNOWN_SCHEME with the top-level fields in `error.fields`.
 */
export function detect(payload: string): Result<DetectResult> {
  const parsed = parsePayload(payload)
  if (!parsed.ok) return parsed
  let found: { scheme: Detected['scheme']; data: unknown; warnings: Warning[] } | undefined
  const alsoMatches: Detected['scheme'][] = []
  for (const [scheme, read] of READERS) {
    const r = read(parsed.value, parsed.warnings, 'lenient')
    if (!r.ok && r.error.code === 'UNSUPPORTED_SCHEME') continue
    if (found) {
      alsoMatches.push(scheme)
      continue
    }
    if (!r.ok) return r
    found = { scheme, data: r.value, warnings: r.warnings }
  }
  if (!found) {
    return {
      ok: false,
      error: new TingQrError(
        'UNKNOWN_SCHEME',
        'Not a payment QR tingqr knows (VietQR, VNPAY, PromptPay, KHQR).',
        undefined,
        parsed.value.fields,
      ),
    }
  }
  const value = { scheme: found.scheme, data: found.data, alsoMatches } as DetectResult
  return { ok: true, value, warnings: found.warnings }
}
