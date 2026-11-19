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
