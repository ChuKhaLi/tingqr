import { checkColours, checkLayoutOptions, checkMargin, invalid, layoutChecked, type LayoutOptions } from './layout.js'

export interface SvgOptions extends LayoutOptions {
  /** width/height of the <svg>: a positive number (px) or a length like '40mm', '2in', '100%'. Absent: scales to its box. */
  size?: number | string
}

const LENGTH = /^\d+(\.\d+)?(px|mm|cm|in|pt|%)?$/

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

/** Path data for dark modules, one segment per horizontal run; `skip(x, y)` leaves a module out. */
export function modulePath(modules: boolean[][], margin: number, skip: (x: number, y: number) => boolean = () => false): string {
  let d = ''
  forEachRun(modules, skip, (x, y, len) => {
    d += `M${x + margin} ${y + margin}h${len}v1h-${len}z`
  })
  return d
}

/** Call `run(x, y, length)` for every horizontal run of dark modules not skipped (module coordinates, no margin). */
export function forEachRun(
  modules: boolean[][],
  skip: (x: number, y: number) => boolean,
  run: (x: number, y: number, length: number) => void,
): void {
  modules.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x] || skip(x, y)) {
        x++
        continue
      }
      const start = x
      while (x < row.length && row[x] && !skip(x, y)) x++
      run(start, y, x - start)
    }
  })
}

/**
 * Check SVG options without rendering, e.g. when a route is configured: the same INVALID_VALUE errors and messages as
 * toSvg for every option that does not depend on the text. Options that do (maxVersion too low for the text, a logo
 * too big for a small code) are still only known when toSvg runs.
 */
export function checkSvgOptions(options: SvgOptions = {}): void {
  const { size, ...rest } = options
  checkLayoutOptions(rest)
  sizeAttr(size)
}

/** Render `text` as a QR code SVG string. No DOM: runs in browsers, Node, Workers and SSR. */
export function toSvg(text: string, options: SvgOptions = {}): string {
  const { margin = 4, foreground = '#000000', background = '#ffffff', size, ...rest } = options
  checkMargin(margin)
  checkColours(foreground, background)
  const dimensions = sizeAttr(size)
  const l = layoutChecked(text, rest, margin, foreground, background)
  const w = l.size + 2 * margin
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}"${dimensions} shape-rendering="crispEdges">`
  if (background !== 'transparent') svg += `<rect width="${w}" height="${w}" fill="${escapeAttr(background)}"/>`
  svg += `<path fill="${escapeAttr(foreground)}" d="${modulePath(l.modules, margin, l.cleared)}"/>`
  if (l.logo === undefined) return svg + '</svg>'

  const { href, background: logoBackground, box } = l.logo
  const c = box.clearStart + margin
  if (logoBackground !== 'transparent') {
    svg += `<rect x="${c}" y="${c}" width="${box.clearSide}" height="${box.clearSide}" fill="${escapeAttr(logoBackground)}"/>`
  }
  const p = box.logoStart + margin
  svg +=
    `<image href="${escapeAttr(href)}" x="${p}" y="${p}" width="${box.logoSide}" height="${box.logoSide}"` +
    ' preserveAspectRatio="xMidYMid meet"/>'
  return svg + '</svg>'
}
