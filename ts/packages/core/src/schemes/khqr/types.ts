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
