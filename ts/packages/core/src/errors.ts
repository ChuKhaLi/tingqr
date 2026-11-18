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

export class TingQrError extends Error {
  readonly code: ErrorCode
  declare readonly tag?: string

  constructor(code: ErrorCode, message: string, tag?: string) {
    super(message)
    this.name = 'TingQrError'
    this.code = code
    if (tag !== undefined) this.tag = tag
  }
}

export type Result<T> = { ok: true; value: T; warnings: Warning[] } | { ok: false; error: TingQrError }
