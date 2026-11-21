import type { TlvNode } from './emv/tlv.js'

/** Error codes shared with every tingqr implementation. Must equal `conformance/errors.json`. */
export const ERROR_CODES = [
  'CRC_MISSING',
  'CRC_MISMATCH',
  'BAD_TAG',
  'BAD_LENGTH',
  'TRUNCATED',
  'FIELD_TOO_LONG',
  'NON_ASCII',
  'DUPLICATE_TAG',
  'MISSING_TAG',
  'INVALID_VALUE',
  'UNSUPPORTED_SCHEME',
  'UNKNOWN_SCHEME',
  'LOGO_LOAD_FAILED',
  'CANVAS_TAINTED',
  'NO_CANVAS',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/** Warning codes shared with every tingqr implementation. Must equal `conformance/errors.json`. */
export const WARNING_CODES = ['TRIMMED_WHITESPACE', 'MISSING_OPTIONAL_TAG', 'LOWERCASE_CRC'] as const
export type WarningCode = (typeof WARNING_CODES)[number]

export interface Warning {
  code: WarningCode
  message: string
  tag?: string
}

/** Shared across copies of this module (a CJS subpath bundle carries its own copy of the class). */
const BRAND: unique symbol = Symbol.for('tingqr.TingQrError') as never

export class TingQrError extends Error {
  readonly code: ErrorCode
  declare readonly tag?: string
  /** Top-level fields already read, when the error is about the payload as a whole (e.g. UNKNOWN_SCHEME). */
  declare readonly fields?: TlvNode[]

  /**
   * `err instanceof TingQrError` is true for an error thrown by any copy of the class, e.g. one from
   * `require('@tingqr/core/banks')` checked against `require('@tingqr/core').TingQrError`. Subclasses keep the usual
   * prototype check.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    if (this !== TingQrError) return Function.prototype[Symbol.hasInstance].call(this, value)
    return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[BRAND] === true
  }

  constructor(code: ErrorCode, message: string, tag?: string, fields?: TlvNode[]) {
    super(message)
    Object.defineProperty(this, BRAND, { value: true })
    this.name = 'TingQrError'
    this.code = code
    if (tag !== undefined) this.tag = tag
    if (fields !== undefined) this.fields = fields
  }
}

export type Result<T> = { ok: true; value: T; warnings: Warning[] } | { ok: false; error: TingQrError }
