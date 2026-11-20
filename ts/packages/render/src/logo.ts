import { TingQrError } from '@tingqr/core'

/**
 * Centre logo. **Provisional:** the limits below (logo size ≤ 0.25, cleared area ≤ 10%, clearing the centre alignment
 * pattern on version 7+) are not yet verified by scans with real banking apps; see conformance/scans.md.
 */
export interface LogoOptions {
  /** Logo image: data:image/(png|jpeg|webp|svg+xml), http(s): URL, or a relative path. */
  href: string
  /** Logo side as a fraction of the QR side (quiet zone excluded), in (0, 0.25]; default 0.2. */
  size?: number
  /** Blank modules around the logo, integer 0–4; default 1. */
  padding?: number
  /** Colour behind the logo, '#rgb', '#rrggbb' or 'transparent'; default: the QR background. */
  background?: string
}

/** Square areas in module coordinates (quiet zone not added). */
export interface LogoBox {
  logoStart: number
  logoSide: number
  clearStart: number
  clearSide: number
}

/** Largest share of the code's modules that may be cleared (provisional until real-app scans, design 5.4). */
export const MAX_CLEARED_SHARE = 0.1
/**
 * First row/column the cleared box may start at. Rows and columns 0–8 hold the top-left finder, its separator, the
 * format information (row/column 8) and the timing pattern (row/column 6); the box is centred, so the same bound keeps
 * it off the other two finders. The version information (versions ≥ 7) sits in rows 0–5 beside the top-right finder and
 * columns 0–5 beside the bottom-left one, so a box starting at row/column 9 or later never touches it either.
 */
export const MIN_CLEAR_START = 9

function invalid(message: string): TingQrError {
  return new TingQrError('INVALID_VALUE', message)
}

/** Centre box for a logo of `size` (fraction of `matrixSize`) plus `padding` modules on each side. */
export function logoBox(matrixSize: number, size: number, padding: number): LogoBox {
  let logoSide = Math.ceil(size * matrixSize)
  if (logoSide % 2 !== matrixSize % 2) logoSide += 1
  const logoStart = (matrixSize - logoSide) / 2
  return { logoStart, logoSide, clearStart: logoStart - padding, clearSide: logoSide + 2 * padding }
}

/** Throw INVALID_VALUE when the cleared box is too large or reaches the finder, format or timing modules. */
export function checkLogoBox(matrixSize: number, box: LogoBox): void {
  const share = (box.clearSide * box.clearSide) / (matrixSize * matrixSize)
  const hint = 'use a smaller logo size or padding, or a larger minVersion.'
  if (share > MAX_CLEARED_SHARE) {
    throw invalid(
      `Logo area is ${(share * 100).toFixed(1)}% of the code (max ${MAX_CLEARED_SHARE * 100}%); ${hint}`,
    )
  }
  if (box.clearStart < MIN_CLEAR_START) {
    throw invalid(`Logo area reaches the finder, format or timing modules of this ${matrixSize}×${matrixSize} code; ${hint}`)
  }
}

const DATA_IMAGE = /^data:image\/(png|jpeg|webp|svg\+xml)(;base64)?,/
const HTTP = /^https?:\/\//
/** Relative path: no scheme (no ':' before the first '/', '?' or '#') and not protocol-relative ('//host'). */
const RELATIVE = /^(?!\/\/)[^:/?#]*(?:[/?#]|$)/

/** Return `href` when it is a safe image reference, else throw INVALID_VALUE. */
export function checkLogoHref(href: string): string {
  const ok =
    typeof href === 'string' &&
    href.length > 0 &&
    (DATA_IMAGE.test(href) ||
      // Browsers read '\' as '/' in http(s) and relative URLs, so '/\host/x' would load from another host.
      (!href.includes('\\') && (HTTP.test(href) || (RELATIVE.test(href) && !/^\s/.test(href)))))
  if (!ok) {
    throw invalid('Logo href must be a data:image/(png|jpeg|webp|svg+xml) URI, an http(s) URL or a relative path.')
  }
  return href
}
