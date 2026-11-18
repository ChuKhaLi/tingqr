/** VNPAY GUID in tag 26.00. */
export const VNPAY_GUID = 'A000000775'

export interface VnpayQrData {
  /** Tag 26.01. */
  merchantId: string
  /** Sub-tags of tag 26 other than 00 and 01. */
  providerData?: Record<string, string>
  /** Tag 01: '11' static (VNPAY uses it even with an amount), '12' dynamic. */
  initiation: 'static' | 'dynamic'
  /** Tag 54, verbatim. */
  amount?: string
  /** Tag 53 verbatim; '704' when missing in lenient mode. */
  currency: string
  /** Tag 58 verbatim; 'VN' when missing in lenient mode. */
  country: string
  /** Tag 59. */
  merchantName?: string
  /** Tag 60. */
  merchantCity?: string
  /** Tag 52. */
  merchantCategoryCode?: string
  /** Every sub-tag of tag 62, keyed by sub-tag. */
  additionalData?: Record<string, string>
  /** 62.01 */
  billNumber?: string
  /** 62.02 */
  mobileNumber?: string
  /** 62.03 */
  store?: string
  /** 62.04 */
  loyaltyNumber?: string
  /** 62.05 */
  reference?: string
  /** 62.06 */
  customerLabel?: string
  /** 62.07 */
  terminal?: string
  /** 62.08 */
  purpose?: string
  /** Top-level tags decodeVnpayQr does not interpret, keyed by tag, value verbatim. */
  extraFields?: Record<string, string>
}
