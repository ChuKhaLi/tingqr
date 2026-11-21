import { Inject, Injectable } from '@nestjs/common'
import { encodeVietQr } from '@tingqr/core'
import type { Bank } from '@tingqr/core/banks'
import type { ResolvedTingQrOptions } from './options.js'
import { TINGQR_OPTIONS } from './tokens.js'

/** VietQR codes to the receiving account configured with TingQrModule.forRoot / forRootAsync. */
@Injectable()
export class TingQrService {
  // Explicit @Inject: works without decorator metadata (esbuild, SWC builds).
  constructor(@Inject(TINGQR_OPTIONS) private readonly options: ResolvedTingQrOptions) {}

  /** BIN of the configured bank, e.g. '970422'. */
  get bin(): string {
    return this.options.bin
  }

  /** The configured bank (code, short and full name…), e.g. to show its name next to the code. */
  get bank(): Bank {
    return this.options.bankInfo
  }

  /**
   * VietQR payload to the configured account. Without an amount it is a static code. Bad input throws TingQrError
   * (e.g. INVALID_VALUE for the amount, NON_ASCII for a purpose with accents).
   */
  paymentQr(input: { amount?: number | string; purpose?: string } = {}): string {
    return encodeVietQr({
      bankBin: this.options.bin,
      accountNumber: this.options.accountNumber,
      service: this.options.service,
      amount: input.amount,
      purpose: input.purpose,
    })
  }
}
