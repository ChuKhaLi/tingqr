import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'

/** A sourced VietQR payload (fake account), not made up here. */
export const PAYLOAD: string = JSON.parse(
  readFileSync(join(CONFORMANCE_DIR, 'vectors', 'vietqr', 'vietqr-dynamic-amount-purpose.json'), 'utf8'),
).payload

/** A second sourced payload, to test changes. */
export const PAYLOAD_2: string = JSON.parse(
  readFileSync(join(CONFORMANCE_DIR, 'vectors', 'vietqr', 'vietqr-card.json'), 'utf8'),
).payload
