import { TingQrError } from '@tingqr/core'
import { contrastRatio, luminance, parseHexColor } from './color.js'
import { toMatrix, type MatrixOptions } from './matrix.js'

export interface SvgOptions extends MatrixOptions {
  /** Quiet zone in modules, 0–16; default 4 (the QR standard). */
  margin?: number
  /** Dark module colour, '#rgb' or '#rrggbb'; default '#000000'. */
  foreground?: string
  /** Background colour, '#rgb', '#rrggbb' or 'transparent'; default '#ffffff'. */
  background?: string
  /** width/height of the <svg>: a positive number (px) or a length like '40mm', '2in', '100%'. Absent: scales to its box. */
  size?: number | string
}

/** Minimum WCAG contrast between foreground and background; below it many phone scanners struggle. */
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
  const { margin = 4, foreground = '#000000', background = '#ffffff', size, ...matrixOptions } = options
  if (typeof margin !== 'number' || !Number.isInteger(margin) || margin < 0 || margin > 16) {
    throw invalid('Option margin must be an integer 0–16.')
  }
  checkColours(foreground, background)
  const dimensions = sizeAttr(size)
  const m = toMatrix(text, matrixOptions)
  const w = m.size + 2 * margin
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}"${dimensions} shape-rendering="crispEdges">`
  if (background !== 'transparent') svg += `<rect width="${w}" height="${w}" fill="${escapeAttr(background)}"/>`
  svg += `<path fill="${escapeAttr(foreground)}" d="${modulePath(m.modules, margin)}"/>`
  return svg + '</svg>'
}
