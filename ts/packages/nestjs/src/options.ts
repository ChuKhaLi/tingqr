import { encodeVietQr, TingQrError, type VietQrService } from '@tingqr/core'
import { findBank, type Bank } from '@tingqr/core/banks'
import { toSvg, type SvgOptions } from '@tingqr/render'

/** SVG options for @TingQrSvg (those of toSvg) plus the Cache-Control header. Same shape as @tingqr/hono. */
export interface TingQrSvgOptions extends SvgOptions {
  /**
   * Cache-Control header; default 'private, max-age=300'. A payment QR carries an account number and often an amount,
   * so shared caches (CDNs) must not keep it.
   */
  cacheControl?: string
}

/** The receiving account, configured once for the app. */
export interface TingQrModuleOptions {
  /** Bank code or BIN, looked up with findBank of @tingqr/core/banks: 'MB', 'mb', '970422', 'VCB'… */
  bank: string
  /** Receiving account (or card) number. */
  accountNumber: string
  /** 'account' (default) or 'card', as VietQrInput.service. */
  service?: VietQrService
  /** Default options for @TingQrSvg routes. */
  svg?: TingQrSvgOptions
}

/** Options checked at startup, with the bank resolved. */
export interface ResolvedTingQrOptions extends TingQrModuleOptions {
  bin: string
  bankInfo: Bank
}

/**
 * An SVG used as an image never loads outside resources (and the response CSP allows only data: images), so a path or
 * URL logo would be served as an empty square. Never serve a code without the logo that was asked for.
 */
export function checkServedLogo(options: SvgOptions | undefined): void {
  const logo = options?.logo
  if (logo === undefined) return
  const href: unknown = logo.href
  if (!(typeof href === 'string' && href.startsWith('data:image/'))) {
    throw new TingQrError(
      'INVALID_VALUE',
      'A logo in an SVG served over HTTP must be a data:image/ URI (e.g. from @tingqr/bank-logos): an SVG shown as an ' +
        'image cannot load a path or URL, so the logo would be blank.',
    )
  }
}

/**
 * Check the whole configuration so a mistake stops the app at startup, not at the first request:
 * the bank must be known, the account must make a valid VietQR, and the SVG options must render.
 */
export function resolveOptions(options: TingQrModuleOptions): ResolvedTingQrOptions {
  const bankInfo = typeof options?.bank === 'string' ? findBank(options.bank) : undefined
  if (bankInfo === undefined) {
    throw new TingQrError(
      'INVALID_VALUE',
      `TingQrModule: bank ${JSON.stringify(options?.bank)} is not a known bank code or BIN (e.g. 'MB', 'VCB', '970422').`,
    )
  }
  // The static code of the account: invalid account or service throws the core error here.
  const staticCode = encodeVietQr({ bankBin: bankInfo.bin, accountNumber: options.accountNumber, service: options.service })
  checkServedLogo(options.svg)
  if (options.svg !== undefined) {
    const { cacheControl: _cacheControl, ...svgOptions } = options.svg
    toSvg(staticCode, svgOptions)
  }
  return { ...options, bin: bankInfo.bin, bankInfo }
}
