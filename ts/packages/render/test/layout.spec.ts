import { TingQrError } from '@tingqr/core'
import { toMatrix, toSvg, type SvgOptions } from '../src/index.js'
import { layout } from '../src/layout.js'
import { logoBox } from '../src/logo.js'

const TEXT = 'TINGQR LAYOUT TEST'
const HREF = 'data:image/png;base64,AAAA'

function failure(fn: () => unknown): { code: string; message: string } {
  try {
    fn()
  } catch (e) {
    if (e instanceof TingQrError) return { code: e.code, message: e.message }
    throw e
  }
  return { code: 'no error', message: '' }
}

test('defaults: margin 4, black on white, no logo, the plain matrix', () => {
  const l = layout(TEXT, {})
  expect(l.margin).toBe(4)
  expect(l.foreground).toBe('#000000')
  expect(l.background).toBe('#ffffff')
  expect(l.logo).toBeUndefined()
  expect(l.modules).toEqual(toMatrix(TEXT).modules)
  expect(l.size).toBe(toMatrix(TEXT).size)
  expect(l.cleared(Math.floor(l.size / 2), Math.floor(l.size / 2))).toBe(false)
})

test('matrix options and colours are passed through', () => {
  const l = layout(TEXT, { ecc: 'Q', minVersion: 6, margin: 2, foreground: '#123', background: 'transparent' })
  expect(l.modules).toEqual(toMatrix(TEXT, { ecc: 'Q', minVersion: 6 }).modules)
  expect([l.margin, l.foreground, l.background]).toEqual([2, '#123', 'transparent'])
})

test('a logo forces ECC H and clears exactly the logo box', () => {
  const l = layout(TEXT, { minVersion: 5, logo: { href: HREF } })
  expect(l.modules).toEqual(toMatrix(TEXT, { ecc: 'H', minVersion: 5 }).modules)
  const box = logoBox(l.size, 0.2, 1)
  expect(l.logo).toEqual({ href: HREF, background: '#ffffff', box })
  for (let y = 0; y < l.size; y++) {
    for (let x = 0; x < l.size; x++) {
      const inside =
        x >= box.clearStart && x < box.clearStart + box.clearSide && y >= box.clearStart && y < box.clearStart + box.clearSide
      expect(l.cleared(x, y)).toBe(inside)
    }
  }
})

test('the logo background defaults to the QR background and can be its own', () => {
  expect(layout(TEXT, { minVersion: 5, background: '#eee', logo: { href: HREF } }).logo?.background).toBe('#eee')
  expect(layout(TEXT, { minVersion: 5, logo: { href: HREF, background: 'transparent' } }).logo?.background).toBe('transparent')
})

const BAD: [string, Omit<SvgOptions, 'size'>, string?][] = [
  ['margin 17', { margin: 17 }],
  ['margin 1.5', { margin: 1.5 }],
  ['light foreground', { foreground: '#ffffff' }],
  ['named colour', { foreground: 'red' }],
  ['mask 9', { mask: 9 }],
  ['logo href javascript:', { logo: { href: 'javascript:x' } }],
  ['logo size 0.3', { logo: { href: HREF, size: 0.3 } }],
  ['logo padding 9', { logo: { href: HREF, padding: 9 } }],
  ['logo background red', { logo: { href: HREF, background: 'red' } }],
  ['logo with ecc M', { ecc: 'M', logo: { href: HREF } }],
  ['logo on version 1', { logo: { href: HREF } }, 'a'],
  ['logo options before encoding', { logo: { href: 'javascript:x' } }, 'a'.repeat(5000)],
  ['text too long', {}, 'a'.repeat(5000)],
]

test.each(BAD)('%s: same INVALID_VALUE and message as toSvg', (_name, options, text = TEXT) => {
  const fromLayout = failure(() => layout(text, options))
  expect(fromLayout.code).toBe('INVALID_VALUE')
  expect(fromLayout).toEqual(failure(() => toSvg(text, options)))
})

test('layout: logo null means no logo (canvas shares layout with toSvg)', () => {
  const l = layout(TEXT, { logo: null } as unknown as SvgOptions)
  expect(l.logo).toBeUndefined()
  expect(l.modules).toEqual(layout(TEXT).modules)
})
