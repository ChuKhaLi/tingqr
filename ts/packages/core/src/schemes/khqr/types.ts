export interface KhqrData {
  /** Tag 29 (individual) or 30 (merchant). */
  accountType: 'individual' | 'merchant'
  /** Sub-tag 00 of tag 29/30: the Bakong account, 'name@bank'. */
  bakongAccountId: string
  /** Tag 29.01. */
  accountInformation?: string
  /** Tag 30.01. */
  merchantId?: string
  /** Tag 29.02 / 30.02. */
  acquiringBank?: string
  /** Tag 01: '11' static, '12' dynamic. */
  initiation: 'static' | 'dynamic'
  /** Tag 53 verbatim ('116' KHR, '840' USD). */
  currencyCode: string
  /** Derived from currencyCode; absent for codes other than 116 and 840. */
  currency?: 'KHR' | 'USD'
  /** Tag 54, verbatim. */
  amount?: string
  /** Tag 52. */
  merchantCategoryCode?: string
  /** Tag 59. */
  merchantName?: string
  /** Tag 60. */
  merchantCity?: string
  /** Tag 61. */
  postalCode?: string
  /** Tag 15. */
  unionPay?: string
  /** Tag 58 verbatim; 'KH' when missing in lenient mode. */
  country: string
  /** Every sub-tag of tag 62, keyed by sub-tag, verbatim. */
  additionalData?: Record<string, string>
  /** 62.01 */
  billNumber?: string
  /** 62.02 */
  mobileNumber?: string
  /** 62.03 */
  storeLabel?: string
  /** 62.07 */
  terminalLabel?: string
  /** 62.08 */
  purpose?: string
  /** Tag 64: 00 language code (verbatim, e.g. 'km' or 'KM'), 01 merchant name, 02 city. */
  alternateLanguage?: { language?: string; merchantName?: string; merchantCity?: string }
  /** Tag 99.00 as Unix milliseconds, when it is 13 digits. */
  createdAt?: number
  /** Tag 99.01 as Unix milliseconds, when it is 13 digits. */
  expiresAt?: number
  /** Every sub-tag of tag 99, verbatim. */
  timestamp?: Record<string, string>
  /** Top-level tags decodeKhqr does not interpret, keyed by tag, value verbatim. */
  extraFields?: Record<string, string>
}

export interface KhqrInput {
  accountType: 'individual' | 'merchant'
  /** Bakong account 'name@bank': exactly one '@', at most 32 characters. */
  bakongAccountId: string
  /** Individual only (29.01), at most 32 characters. */
  accountInformation?: string
  /** Merchant only and required (30.01), at most 32 characters. */
  merchantId?: string
  /** Required for a merchant (30.02), optional for an individual (29.02); at most 32 characters. */
  acquiringBank?: string
  /** Tag 59, 1–25 characters. */
  merchantName: string
  /** Tag 60, at most 15 characters; 'Phnom Penh' by default. */
  merchantCity?: string
  /** Tag 52, 4 digits; '5999' by default. */
  merchantCategoryCode?: string
  currency: 'KHR' | 'USD'
  /** KHR: a whole number > 0. USD: > 0 with at most 2 decimals. Absent: a static code. */
  amount?: number | string
  /** 62.01, 62.02, 62.03, 62.07, 62.08: each at most 25 characters. */
  billNumber?: string
  mobileNumber?: string
  storeLabel?: string
  terminalLabel?: string
  purpose?: string
  /** Tag 64, the only text that may be non-ASCII: language code (1–2 characters), name (≤ 25), city (≤ 15). */
  alternateLanguage?: { language: string; merchantName: string; merchantCity?: string }
  /**
   * Unix milliseconds (13 digits). Required so the output never depends on the clock. Written to 99.00 only together
   * with `expiresAt`: like the Bakong SDK, a static code without `expiresAt` has no tag 99, so this value is checked
   * and then left out.
   */
  createdAt: number
  /** Unix milliseconds (13 digits), after createdAt. Required with an amount. */
  expiresAt?: number
}
