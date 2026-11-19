import { TingQrError } from '@tingqr/core'
import { contrastRatio, parseHexColor } from '../src/color.js'

test('parses #rgb and #rrggbb, either case', () => {
  expect(parseHexColor('#fff')).toEqual([255, 255, 255])
  expect(parseHexColor('#1A2b3C')).toEqual([26, 43, 60])
  expect(parseHexColor('#000')).toEqual([0, 0, 0])
})

test.each(['fff', '#ffff', 'red', '#ggg', '#fff" onload="x', '', '#12345', '#1234567'])('rejects %o', (c) => {
  expect(() => parseHexColor(c)).toThrow(TingQrError)
})

test('WCAG contrast ratio', () => {
  expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
  expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5)
  expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBe(1)
  // #777777 on white is the classic "just below AA" grey (4.48).
  expect(contrastRatio([0x77, 0x77, 0x77], [255, 255, 255])).toBeLessThan(4.5)
  expect(contrastRatio([0x76, 0x76, 0x76], [255, 255, 255])).toBeGreaterThanOrEqual(4.5)
})

test('rejects a colour with text before the #, and non-strings that stringify to a colour', () => {
  expect(() => parseHexColor('x#fff')).toThrow(TingQrError)
  expect(() => parseHexColor({ toString: () => '#fff' } as unknown as string)).toThrow(TingQrError)
})

test('dark channels use the linear segment of the sRGB curve', () => {
  // #050505: channel 5/255 is below 0.03928, so it is divided by 12.92 (luminance ≈ 0.00152).
  expect(contrastRatio([5, 5, 5], [255, 255, 255])).toBeCloseTo(20.38, 2)
})
