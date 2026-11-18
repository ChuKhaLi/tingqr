/** NAPAS VietQR GUID in tag 38.00. */
export const VIETQR_GUID = 'A000000727'

/** `account` = QRIBFTTA (transfer to account), `card` = QRIBFTTC (transfer to card). */
export type VietQrService = 'account' | 'card'

export const SERVICE_CODE: Record<VietQrService, string> = { account: 'QRIBFTTA', card: 'QRIBFTTC' }

export interface VietQrData {
  bankBin: string
  accountNumber: string
  service: VietQrService
  /** Tag 01: '11' static, '12' dynamic. */
  initiation: 'static' | 'dynamic'
  /** Tag 54, verbatim. */
  amount?: string
  /** Tag 62.08. */
  purpose?: string
  /** Every sub-tag of tag 62 (including '08'), keyed by sub-tag. */
  additionalData?: Record<string, string>
  /** Tag 59. */
  merchantName?: string
  /** Tag 60. */
  merchantCity?: string
  /** Tag 52. */
  merchantCategoryCode?: string
  /** Top-level tags decodeVietQr does not interpret (e.g. 26, 80), keyed by tag, value verbatim. */
  extraFields?: Record<string, string>
  /** Tag 53 verbatim; '704' when missing in lenient mode. */
  currency: string
  /** Tag 58 verbatim; 'VN' when missing in lenient mode. */
  country: string
}

export interface VietQrInput {
  /** 6-digit bank BIN, e.g. '970422'. */
  bankBin: string
  /** Account or card number, 3–25 letters or digits. */
  accountNumber: string
  /** Defaults to 'account'. */
  service?: VietQrService
  /** Whole VND, 1–13 digits, greater than zero. Omit (or '') for a static QR. */
  amount?: number | string
  /** Transfer note (tag 62.08). Printable ASCII only, at most 95 characters. */
  purpose?: string
}
