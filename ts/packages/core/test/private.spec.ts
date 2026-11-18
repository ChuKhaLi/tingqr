// Local-only: reads real QR captures from conformance/private/*.txt (never committed). Skipped when absent.
// Privacy: test names and assertion messages contain file names only; values are never compared with toEqual or
// printed, so a failure cannot echo a real payload.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { decodeVietQr, decodeVnpayQr } from '../src/index.js'
import { CONFORMANCE_DIR } from './conformance-root.js'

// TINGQR_PRIVATE_DIR lets the spec be checked against a temporary folder of public samples.
const PRIVATE = process.env.TINGQR_PRIVATE_DIR ?? join(CONFORMANCE_DIR, 'private')
const files = existsSync(PRIVATE) ? readdirSync(PRIVATE).filter((f) => f.toLowerCase().endsWith('.txt')).sort() : []

function decoderFor(payload: string) {
  if (payload.toUpperCase().includes('A000000727')) return decodeVietQr
  if (payload.toUpperCase().includes('A000000775')) return decodeVnpayQr
  return undefined
}

describe.skipIf(files.length === 0)('real captures in conformance/private (local only)', () => {
  test.each(files)('%s decodes in lenient mode', (file) => {
    const payload = readFileSync(join(PRIVATE, file), 'utf8').trim()
    const decode = decoderFor(payload)
    if (file.startsWith('other__')) return // other schemes are recorded for later, not decoded yet
    expect(decode !== undefined, `${file}: neither VietQR nor VNPAY GUID found`).toBe(true)
    const ok = decode!(payload, { mode: 'lenient' }).ok
    expect(ok, `${file}: decode failed (inspect its recipe vector, not the capture)`).toBe(true)
  })
})
