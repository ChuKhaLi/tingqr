/** A Vietnamese bank or wallet from api.vietqr.io/v2/banks (conformance/banks/banks.json). */
export interface Bank {
  /** 6-digit BIN, as in VietQR tag 38.01.00. */
  readonly bin: string
  /** vietqr.io short code, e.g. `MB`. */
  readonly code: string
  readonly shortName: string
  readonly name: string
  readonly swift: string | null
  /** Reference link to the logo on cdn.vietqr.io. Loading it calls the network; @tingqr/bank-logos ships the files. */
  readonly logoUrl: string
}

export interface BankAppAndroid {
  readonly package: string
  readonly scheme: string
  /** What goes between `intent://` and `#Intent` (often empty). */
  readonly host: string
}

/** A bank or wallet app that can be opened by URL scheme (conformance/banks/bank-apps.json). */
export interface BankApp {
  readonly id: string
  readonly name: string
  /** BIN of the bank behind the app, or null. */
  readonly bin: string | null
  readonly ios?: { readonly scheme: string }
  readonly android?: BankAppAndroid
  /** `multi-source`: at least two independent sources list the app. See conformance/banks/bank-apps.json for them. */
  readonly confidence: 'multi-source' | 'single-source'
  /** dl.vietqr.io can pre-fill amount and message for this app (per vietqr.io). tingqr itself only opens apps. */
  readonly vietqrAutofill: boolean
}

export type AppPlatform = 'android' | 'ios'
