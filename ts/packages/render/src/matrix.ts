import { TingQrError } from '@tingqr/core'
import { QrCode, QrSegment } from './qrcodegen.js'

export type Ecc = 'L' | 'M' | 'Q' | 'H'

export interface MatrixOptions {
  /** Error correction level; default 'M'. 'Q' suits printed signs that get dirty or scratched. */
  ecc?: Ecc
  /** Raise the ECC level while the data still fits the same version (Nayuki's boostEcl); default true. */
  boostEcc?: boolean
  /** Smallest QR version to use, 1–40; default 1. */
  minVersion?: number
  /** Largest QR version to use, 1–40; default 40. */
  maxVersion?: number
  /** Mask pattern 0–7; chosen automatically when absent. */
  mask?: number
}

export interface QrMatrix {
  /** Modules per side: 4 × version + 17. */
  size: number
  version: number
  /** The ECC level actually used (may be higher than requested when boostEcc is on). */
  ecc: Ecc
  mask: number
  /** modules[y][x]; true is a dark module. */
  modules: boolean[][]
}

const ECC: Readonly<Record<Ecc, QrCode.Ecc>> = {
  L: QrCode.Ecc.LOW,
  M: QrCode.Ecc.MEDIUM,
  Q: QrCode.Ecc.QUARTILE,
  H: QrCode.Ecc.HIGH,
}
const ECC_NAME: readonly Ecc[] = ['L', 'M', 'Q', 'H']

function invalid(message: string): TingQrError {
  return new TingQrError('INVALID_VALUE', message)
}

function intOption(value: unknown, name: string, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(`Option ${name} must be an integer ${min}–${max}.`)
  }
  return value
}

/**
 * Encode `text` (any Unicode string; non-alphanumeric text is encoded as UTF-8 bytes) into a QR module matrix, with
 * the encoder ported from Project Nayuki. Throws TingQrError INVALID_VALUE for bad options or text that does not fit.
 */
export function toMatrix(text: string, options: MatrixOptions = {}): QrMatrix {
  if (typeof text !== 'string') throw invalid('Text must be a string.')
  const ecc = options.ecc ?? 'M'
  if (!Object.hasOwn(ECC, ecc)) throw invalid("Option ecc must be 'L', 'M', 'Q' or 'H'.")
  const boostEcc = options.boostEcc ?? true
  if (typeof boostEcc !== 'boolean') throw invalid('Option boostEcc must be a boolean.')
  const minVersion = intOption(options.minVersion, 'minVersion', 1, 40, 1)
  const maxVersion = intOption(options.maxVersion, 'maxVersion', 1, 40, 40)
  if (minVersion > maxVersion) throw invalid('Option minVersion must not exceed maxVersion.')
  const mask = intOption(options.mask, 'mask', 0, 7, -1)

  let qr: QrCode
  try {
    qr = QrCode.encodeSegments(QrSegment.makeSegments(text), ECC[ecc], minVersion, maxVersion, mask, boostEcc)
  } catch (e) {
    if (e instanceof RangeError) {
      throw invalid(`Text is too long for a QR code of version ≤ ${maxVersion} at ECC ${ecc}.`)
    }
    throw e
  }
  const modules: boolean[][] = []
  for (let y = 0; y < qr.size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < qr.size; x++) row.push(qr.getModule(x, y))
    modules.push(row)
  }
  return {
    size: qr.size,
    version: qr.version,
    ecc: ECC_NAME[qr.errorCorrectionLevel.ordinal] as Ecc,
    mask: qr.mask,
    modules,
  }
}
