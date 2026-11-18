/** NAPAS VietQR GUID in tag 38.00. */
export const VIETQR_GUID = 'A000000727'

/** `account` = QRIBFTTA (transfer to account), `card` = QRIBFTTC (transfer to card). */
export type VietQrService = 'account' | 'card'

export const SERVICE_CODE: Record<VietQrService, string> = { account: 'QRIBFTTA', card: 'QRIBFTTC' }

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
