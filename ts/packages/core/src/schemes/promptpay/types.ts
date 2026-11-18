/** PromptPay AIDs in sub-tag 00 of tag 29 (credit transfer) or tag 30 (bill payment). */
export const PROMPTPAY_AID = {
  creditTransfer: 'A000000677010111',
  ota: 'A000000677010114',
  billPayment: 'A000000677010112',
  billPaymentCrossBorder: 'A000000677012006',
} as const

export type PromptPayProxyType = 'mobile' | 'nationalId' | 'eWallet' | 'bankAccount' | 'unknown'

interface PromptPayCommon {
  /** Tag 01: '11' static, '12' dynamic. */
  initiation: 'static' | 'dynamic'
  /** Tag 54, verbatim. */
  amount?: string
  /** Tag 53 verbatim; '764' when missing in lenient mode. */
  currency: string
  /** Tag 58 verbatim; 'TH' when missing in lenient mode. */
  country: string
  /** Tag 59. */
  merchantName?: string
  /** Tag 60. */
  merchantCity?: string
  /** Tag 52. */
  merchantCategoryCode?: string
  /** Every sub-tag of tag 62, keyed by sub-tag, verbatim. */
  additionalData?: Record<string, string>
  /** Top-level tags decodePromptPayQr does not interpret, keyed by tag, value verbatim. */
  extraFields?: Record<string, string>
}

export interface PromptPayCreditTransfer {
  kind: 'credit-transfer'
  /** True when tag 29.00 is the OTA AID (…0114). */
  ota: boolean
  /** Which of sub-tags 01 (mobile), 02 (national/tax ID), 03 (e-wallet), 04 (bank account) comes first. */
  proxyType: PromptPayProxyType
  /** Verbatim value of that sub-tag; '' when none is present (lenient mode only). */
  proxy: string
  /** Mobile proxies written as 0066 + 9 digits, as a local number: '0' + 9 digits. */
  mobile?: string
  /** Tag 29.05. */
  otaCode?: string
  /** Every sub-tag of tag 29 except 00, verbatim. */
  subFields: Record<string, string>
}

export interface PromptPayBillPayment {
  kind: 'bill-payment'
  /** True when tag 30.00 is the cross-border AID (…2006). */
  crossBorder: boolean
  /** Tag 30.01. */
  billerId: string
  /** Tag 30.02. */
  reference1?: string
  /** Tag 30.03. */
  reference2?: string
  /** Every sub-tag of tag 30 except 00, verbatim. */
  subFields: Record<string, string>
}

export type PromptPayData = PromptPayCommon & (PromptPayCreditTransfer | PromptPayBillPayment)
