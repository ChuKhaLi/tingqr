import { TingQrError } from '@tingqr/core'
import { contrastRatio, luminance, parseHexColor } from './color.js'
import { checkLogoBox, checkLogoHref, logoBox, type LogoOptions } from './logo.js'
import { toMatrix, type MatrixOptions } from './matrix.js'

export interface SvgOptions extends MatrixOptions {
  /** Quiet zone in modules, 0–16; default 4 (the QR standard). */
  margin?: number
  /** Dark module colour, '#rgb' or '#rrggbb'; default '#000000'. */
  foreground?: string
  /**
   * Background colour, '#rgb', '#rrggbb' or 'transparent'; default '#ffffff'. With 'transparent' no contrast is checked:
   * you are responsible for printing the code on a background light enough for the foreground.
   */
  background?: string
  /** width/height of the <svg>: a positive number (px) or a length like '40mm', '2in', '100%'. Absent: scales to its box. */
  size?: number | string
  /**
   * Centre logo (provisional, see LogoOptions). Forces ECC H (an explicit ecc other than 'H' is rejected) and clears the
   * modules under it.
   */
  logo?: LogoOptions
}

/**
 * Minimum contrast between foreground and background. A heuristic: 4.5:1 is the WCAG text threshold, used here as a
 * conservative bar for phone cameras; not a measured property of banking apps.
 */
const MIN_CONTRAST = 4.5
const LENGTH = /^\d+(\.\d+)?(px|mm|cm|in|pt|%)?$/

function invalid(message: string): TingQrError {
  return new TingQrError('INVALID_VALUE', message)
}

/** Escape a value for an XML attribute in double quotes. */
export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function sizeAttr(size: SvgOptions['size']): string {
  if (size === undefined) return ''
  const ok =
    typeof size === 'number'
      ? Number.isFinite(size) && size > 0
      : typeof size === 'string' && LENGTH.test(size) && parseFloat(size) > 0
  if (!ok) throw invalid(`Option size ${JSON.stringify(size)} must be a positive number or a length like '40mm'.`)
  const v = escapeAttr(String(size))
  return ` width="${v}" height="${v}"`
}

function checkColours(foreground: string, background: string): void {
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

/** Path data for dark modules, one segment per horizontal run; `skip(x, y)` leaves a module out. */
export function modulePath(modules: boolean[][], margin: number, skip: (x: number, y: number) => boolean = () => false): string {
  let d = ''
  modules.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x] || skip(x, y)) {
        x++
        continue
      }
      const start = x
      while (x < row.length && row[x] && !skip(x, y)) x++
      const len = x - start
      d += `M${start + margin} ${y + margin}h${len}v1h-${len}z`
    }
  })
  return d
}

/** Render `text` as a QR code SVG string. No DOM: runs in browsers, Node, Workers and SSR. */
export function toSvg(text: string, options: SvgOptions = {}): string {
  const { margin = 4, foreground = '#000000', background = '#ffffff', size, logo, ...matrixOptions } = options
  if (typeof margin !== 'number' || !Number.isInteger(margin) || margin < 0 || margin > 16) {
    throw invalid('Option margin must be an integer 0–16.')
  }
  checkColours(foreground, background)
  const dimensions = sizeAttr(size)
  if (logo !== undefined) {
    if (matrixOptions.ecc !== undefined && matrixOptions.ecc !== 'H') {
      throw invalid(`A logo needs ECC H; got ecc '${String(matrixOptions.ecc)}'. Leave ecc unset or pass 'H'.`)
    }
    matrixOptions.ecc = 'H'
  }
  const m = toMatrix(text, matrixOptions)
  const w = m.size + 2 * margin
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}"${dimensions} shape-rendering="crispEdges">`
  if (background !== 'transparent') svg += `<rect width="${w}" height="${w}" fill="${escapeAttr(background)}"/>`
  if (logo === undefined) return svg + `<path fill="${escapeAttr(foreground)}" d="${modulePath(m.modules, margin)}"/></svg>`

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
  const box = logoBox(m.size, logoSize, padding)
  checkLogoBox(m.size, box)
  const end = box.clearStart + box.clearSide
  const cleared = (x: number, y: number) => x >= box.clearStart && x < end && y >= box.clearStart && y < end
  svg += `<path fill="${escapeAttr(foreground)}" d="${modulePath(m.modules, margin, cleared)}"/>`
  const c = box.clearStart + margin
  if (logoBackground !== 'transparent') {
    svg += `<rect x="${c}" y="${c}" width="${box.clearSide}" height="${box.clearSide}" fill="${escapeAttr(logoBackground)}"/>`
  }
  const l = box.logoStart + margin
  svg +=
    `<image href="${escapeAttr(href)}" x="${l}" y="${l}" width="${box.logoSide}" height="${box.logoSide}"` +
    ' preserveAspectRatio="xMidYMid meet"/>'
  return svg + '</svg>'
}
