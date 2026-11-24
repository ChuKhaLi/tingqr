import { TingQrError } from '@tingqr/core'
import { checkSvgOptions, toMatrix, toSvg, type SvgOptions } from '../src/index.js'
import { escapeAttr } from '../src/svg.js'

const TEXT = 'TINGQR SVG TEST'

/** Dark cells drawn by the path, as "x,y" in module coordinates (margin removed). */
export function cellsOf(svg: string, margin: number): Set<string> {
  const d = /<path[^>]* d="([^"]*)"/.exec(svg)?.[1] ?? ''
  const cells = new Set<string>()
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
    const [x, y, len, back] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
    expect(back).toBe(len)
    for (let i = 0; i < len; i++) cells.add(`${x - margin + i},${y - margin}`)
  }
  return cells
}
function darkCells(modules: boolean[][]): Set<string> {
  const cells = new Set<string>()
  modules.forEach((row, y) => row.forEach((dark, x) => dark && cells.add(`${x},${y}`)))
  return cells
}
function code(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    if (e instanceof TingQrError) return e.code
    throw e
  }
  return 'no error'
}

test.each([0, 4])('the path draws exactly the dark modules (margin %i)', (margin) => {
  const svg = toSvg(TEXT, { margin })
  expect(cellsOf(svg, margin)).toEqual(darkCells(toMatrix(TEXT).modules))
})

test('runs on one row are merged into one segment', () => {
  const svg = toSvg(TEXT)
  const d = /<path[^>]* d="([^"]*)"/.exec(svg)![1]!
  const segments = [...d.matchAll(/M(\d+) (\d+)h(\d+)/g)].map((m) => `${m[1]},${m[2]},${m[3]}`)
  const byStart = new Set(segments.map((s) => s.split(',').slice(0, 2).join(',')))
  // no segment starts right where another on the same row ends
  for (const s of segments) {
    const [x, y, len] = s.split(',').map(Number) as [number, number, number]
    expect(byStart.has(`${x + len},${y}`)).toBe(false)
  }
})

test('shape: viewBox includes the margin, background rect, one path, crisp edges', () => {
  const m = toMatrix(TEXT)
  const w = m.size + 8
  const svg = toSvg(TEXT)
  expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" shape-rendering="crispEdges">`)).toBe(true)
  expect(svg).toContain(`<rect width="${w}" height="${w}" fill="#ffffff"/>`)
  expect(svg).toContain('<path fill="#000000" d="M')
  expect(svg.endsWith('</svg>')).toBe(true)
  expect(svg).not.toContain('width="' + w + '" height="' + w + '" shape')
  expect(svg.match(/<path/g)).toHaveLength(1)
})

test('matrix options are passed through', () => {
  const svg = toSvg(TEXT, { ecc: 'H', minVersion: 5, margin: 0 })
  expect(cellsOf(svg, 0)).toEqual(darkCells(toMatrix(TEXT, { ecc: 'H', minVersion: 5 }).modules))
})

test.each([
  [300, 'width="300" height="300"'],
  ['40mm', 'width="40mm" height="40mm"'],
  ['2.5in', 'width="2.5in" height="2.5in"'],
  ['100%', 'width="100%" height="100%"'],
])('size %o', (size, attrs) => {
  expect(toSvg(TEXT, { size })).toContain(attrs)
})

test.each([-1, 0, Number.NaN, Number.POSITIVE_INFINITY, '40 mm', '40mm"', '1e3', 'mm', '-5px'])('size %o is rejected', (size) => {
  expect(code(() => toSvg(TEXT, { size } as SvgOptions))).toBe('INVALID_VALUE')
})

test.each([17, -1, 1.5, '4'])('margin %o is rejected', (margin) => {
  expect(code(() => toSvg(TEXT, { margin } as SvgOptions))).toBe('INVALID_VALUE')
})

test('margin 16 is accepted', () => {
  expect(toSvg(TEXT, { margin: 16 })).toContain(`viewBox="0 0 ${toMatrix(TEXT).size + 32}`)
})

test('transparent background: no rect, any hex foreground', () => {
  const svg = toSvg(TEXT, { background: 'transparent', foreground: '#ffffff' })
  expect(svg).not.toContain('<rect')
  expect(svg).toContain('fill="#ffffff"')
})

test.each([
  ['#ffffff', '#ffffff'],
  ['#777777', '#ffffff'],
  ['#ffffff', '#000000'],
  ['#000', 'transparentish'],
  ['red', '#fff'],
])('foreground %s on %s is rejected', (foreground, background) => {
  expect(code(() => toSvg(TEXT, { foreground, background }))).toBe('INVALID_VALUE')
})

test('dark on light colours are accepted as given, either case', () => {
  const svg = toSvg(TEXT, { foreground: '#1A2B3C', background: '#fff' })
  expect(svg).toContain('fill="#1A2B3C"')
  expect(svg).toContain('fill="#fff"')
  expect(toSvg(TEXT, { foreground: '#1a2b3c' })).toContain('fill="#1a2b3c"')
})

test('escapeAttr escapes the five XML-special characters', () => {
  expect(escapeAttr(`<a "b" & 'c'>`)).toBe('&lt;a &quot;b&quot; &amp; &#39;c&#39;&gt;')
})

test('bad text or matrix options surface as INVALID_VALUE', () => {
  expect(code(() => toSvg(42 as unknown as string))).toBe('INVALID_VALUE')
  expect(code(() => toSvg(TEXT, { mask: 9 }))).toBe('INVALID_VALUE')
})

test.each(['0', '0mm', '0.0px'])('a zero length %o is rejected', (size) => {
  expect(code(() => toSvg(TEXT, { size }))).toBe('INVALID_VALUE')
})
test('a non-string size that stringifies to a length is rejected', () => {
  expect(code(() => toSvg(TEXT, { size: { toString: () => '40mm' } } as unknown as SvgOptions))).toBe('INVALID_VALUE')
})
test.each([
  ['40', 'width="40"'],
  ['2.55in', 'width="2.55in"'],
])('size %o (unitless or two decimals) is accepted', (size, attr) => {
  expect(toSvg(TEXT, { size })).toContain(attr)
})

describe('checkSvgOptions: every option that does not depend on the text, checked without rendering', () => {
  const LOGO = 'data:image/png;base64,AAAA'
  const messageOf = (run: () => unknown): string => {
    try {
      run()
    } catch (e) {
      expect(e).toBeInstanceOf(TingQrError)
      expect((e as TingQrError).code).toBe('INVALID_VALUE')
      return (e as Error).message
    }
    return 'no error'
  }
  test.each<[string, SvgOptions]>([
    ['margin', { margin: -1 }],
    ['colours', { foreground: '#ffffff' }],
    ['size', { size: '10furlongs' }],
    ['logo size', { logo: { href: LOGO, size: 0.5 } }],
    ['logo padding', { logo: { href: LOGO, padding: 9 } }],
    ['logo href', { logo: { href: 'javascript:alert(1)' } }],
    ['logo with ecc L', { logo: { href: LOGO }, ecc: 'L' }],
    ['ecc', { ecc: 'X' as never }],
    ['minVersion above maxVersion', { minVersion: 10, maxVersion: 5 }],
  ])('%s: same error and message as toSvg', (_name, options) => {
    const expected = messageOf(() => toSvg('TINGQR', options))
    expect(expected).not.toBe('no error')
    expect(messageOf(() => checkSvgOptions(options))).toBe(expected)
  })
  test.each<[string, SvgOptions | undefined]>([
    ['none', undefined],
    ['empty', {}],
    ['all valid', { margin: 2, size: 240, foreground: '#112233', logo: { href: LOGO, size: 0.2 }, minVersion: 5 }],
  ])('%s: no error', (_name, options) => {
    expect(() => checkSvgOptions(options)).not.toThrow()
  })
})

describe('null options are the defaults, like .NET (conformance/README.md "Mẫu SVG")', () => {
  const LOGO = 'data:image/png;base64,AAAA'
  test('toSvg and checkSvgOptions with null options', () => {
    expect(toSvg('TINGQR', null as unknown as SvgOptions)).toBe(toSvg('TINGQR'))
    expect(() => checkSvgOptions(null as unknown as SvgOptions)).not.toThrow()
  })
  test('logo: null means no logo', () => {
    const options = { minVersion: 5, logo: null } as unknown as SvgOptions
    expect(toSvg('TINGQR', options)).toBe(toSvg('TINGQR', { minVersion: 5 }))
    expect(toSvg('TINGQR', { ...options, ecc: 'L' })).toBe(toSvg('TINGQR', { minVersion: 5, ecc: 'L' }))
    expect(() => checkSvgOptions({ ...options, ecc: 'L' })).not.toThrow()
    expect(toSvg('TINGQR', { minVersion: 5, logo: { href: LOGO } })).not.toBe(toSvg('TINGQR', options))
  })
  test.each(['margin', 'foreground', 'background', 'size', 'minVersion', 'maxVersion', 'mask'])(
    'a null %s is still INVALID_VALUE in TypeScript (.NET reads it as not set)',
    (name) => {
      const options = { [name]: null } as unknown as SvgOptions
      expect(() => toSvg('TINGQR', options)).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
      expect(() => checkSvgOptions(options)).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
    },
  )
})
