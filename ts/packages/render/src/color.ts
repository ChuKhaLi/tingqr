import { TingQrError } from '@tingqr/core'

export type Rgb = [number, number, number]

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** '#rgb' or '#rrggbb' (either case) as [r, g, b] 0–255. Anything else is INVALID_VALUE. */
export function parseHexColor(value: string): Rgb {
  const m = typeof value === 'string' ? HEX.exec(value) : null
  if (!m) throw new TingQrError('INVALID_VALUE', `Colour ${JSON.stringify(value)} must be #rgb or #rrggbb.`)
  const hex = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb
}

/** WCAG 2.x relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG 2.x contrast ratio, 1–21, independent of argument order. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
