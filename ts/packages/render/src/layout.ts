import { TingQrError } from '@tingqr/core'
import { contrastRatio, luminance, parseHexColor } from './color.js'
import { checkLogoBox, checkLogoHref, logoBox, type LogoBox, type LogoOptions } from './logo.js'
import { toMatrix, type MatrixOptions } from './matrix.js'

/** Options shared by every renderer (SVG, canvas). */
export interface LayoutOptions extends MatrixOptions {
  /** Quiet zone in modules, 0–16; default 4 (the QR standard). */
  margin?: number
  /** Dark module colour, '#rgb' or '#rrggbb'; default '#000000'. */
  foreground?: string
  /**
   * Background colour, '#rgb', '#rrggbb' or 'transparent'; default '#ffffff'. With 'transparent' no contrast is checked:
   * you are responsible for printing the code on a background light enough for the foreground.
   */
  background?: string
  /**
   * Centre logo (provisional, see LogoOptions). Forces ECC H (an explicit ecc other than 'H' is rejected) and clears the
   * modules under it.
   */
  logo?: LogoOptions
}

/** A validated, encoded code ready to draw: module grid, colours and the logo box (module coordinates). */
export interface Layout {
  modules: boolean[][]
  size: number
  margin: number
  foreground: string
  /** A hex colour or 'transparent'. */
  background: string
  logo?: { href: string; background: string; box: LogoBox }
  /** True for a module inside the logo's cleared box (always false without a logo). */
  cleared(x: number, y: number): boolean
}

/**
 * Minimum contrast between foreground and background. A heuristic: 4.5:1 is the WCAG text threshold, used here as a
 * conservative bar for phone cameras; not a measured property of banking apps.
 */
const MIN_CONTRAST = 4.5

export function invalid(message: string): TingQrError {
  return new TingQrError('INVALID_VALUE', message)
}

export function checkMargin(margin: unknown): void {
  if (typeof margin !== 'number' || !Number.isInteger(margin) || margin < 0 || margin > 16) {
    throw invalid('Option margin must be an integer 0–16.')
  }
}

export function checkColours(foreground: string, background: string): void {
  const fg = parseHexColor(foreground)
  if (background === 'transparent') return
  const bg = parseHexColor(background)
  if (luminance(fg) >= luminance(bg) || contrastRatio(fg, bg) < MIN_CONTRAST) {
    throw invalid(
      `Foreground ${foreground} must be darker than background ${background} with contrast ≥ ${MIN_CONTRAST}:1; ` +
        'light or inverted QR codes fail in many banking apps.',
    )
  }
}

/** Validate the logo options (no matrix needed) and fill in their defaults. */
function checkLogoOptions(logo: LogoOptions, background: string) {
  const href = checkLogoHref(logo.href)
  const logoSize = logo.size ?? 0.2
  if (typeof logoSize !== 'number' || !(logoSize > 0 && logoSize <= 0.25)) {
    throw invalid('Logo size must be a number in (0, 0.25].')
  }
  const padding = logo.padding ?? 1
  if (typeof padding !== 'number' || !Number.isInteger(padding) || padding < 0 || padding > 4) {
    throw invalid('Logo padding must be an integer 0–4.')
  }
  const logoBackground = logo.background ?? background
  if (logoBackground !== 'transparent') parseHexColor(logoBackground)
  return { href, logoSize, padding, logoBackground }
}

/** Check the logo options and the logo/ECC rule; return the logo parts and the options for toMatrix. */
function checkedParts(options: LayoutOptions, background: string) {
  const { logo, margin: _m, foreground: _f, background: _b, ...matrixOptions } = options
  // Every logo option is checked before encoding, so a bad option is reported even when the text is also too long.
  const logoParts = logo == null ? undefined : checkLogoOptions(logo, background)
  if (logoParts !== undefined) {
    if (matrixOptions.ecc !== undefined && matrixOptions.ecc !== 'H') {
      throw invalid(`A logo needs ECC H; got ecc '${String(matrixOptions.ecc)}'. Leave ecc unset or pass 'H'.`)
    }
    matrixOptions.ecc = 'H'
  }
  return { logoParts, matrixOptions }
}

/**
 * Check every option that does not depend on the text, without rendering: the same errors as layout would throw for
 * them. What depends on the text (too long for maxVersion, a logo too big for a small code) is only known when drawing.
 */
export function checkLayoutOptions(options: LayoutOptions): void {
  const { margin = 4, foreground = '#000000', background = '#ffffff' } = options
  checkMargin(margin)
  checkColours(foreground, background)
  toMatrix('', checkedParts(options, background).matrixOptions) // checks ecc, versions, mask… on an empty text
}

/**
 * Validate everything, encode `text` and place the logo. Margin and colours are checked by the caller first (toSvg checks
 * its size in between); `layout` repeats nothing and is the one place logo and ECC rules live.
 */
export function layoutChecked(text: string, options: LayoutOptions, margin: number, foreground: string, background: string): Layout {
  const { logoParts, matrixOptions } = checkedParts(options, background)
  const m = toMatrix(text, matrixOptions)
  const base = { modules: m.modules, size: m.size, margin, foreground, background }
  if (logoParts === undefined) return { ...base, cleared: () => false }

  const box = logoBox(m.size, logoParts.logoSize, logoParts.padding)
  checkLogoBox(m.size, box)
  const end = box.clearStart + box.clearSide
  return {
    ...base,
    logo: { href: logoParts.href, background: logoParts.logoBackground, box },
    cleared: (x, y) => x >= box.clearStart && x < end && y >= box.clearStart && y < end,
  }
}

/** Validate the options, encode `text` and place the logo. Throws INVALID_VALUE like toSvg, with the same messages. */
export function layout(text: string, options: LayoutOptions = {}): Layout {
  options = options ?? {}
  const { margin = 4, foreground = '#000000', background = '#ffffff' } = options
  checkMargin(margin)
  checkColours(foreground, background)
  return layoutChecked(text, options, margin, foreground, background)
}
