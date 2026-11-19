import { TingQrError } from '@tingqr/core'
import { checkLogoBox, checkLogoHref, logoBox } from '../src/logo.js'
import { toMatrix, toSvg, type SvgOptions } from '../src/index.js'
import { cellsOf } from './svg.spec.js'

const HREF = 'data:image/png;base64,AAAA'
// 61 bytes of byte-mode text: version 7 at ECC H, so the version-information area exists.
const TEXT = 'tingqr logo test: the quick brown fox jumps over the lazy dog'

function code(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    if (e instanceof TingQrError) return e.code
    throw e
  }
  return 'no error'
}

describe('logoBox geometry', () => {
  test('version 5 (37), size 0.2, padding 1', () => {
    expect(logoBox(37, 0.2, 1)).toEqual({ logoStart: 14, logoSide: 9, clearStart: 13, clearSide: 11 })
  })
  test('version 3 (29), size 0.2, padding 1', () => {
    expect(logoBox(29, 0.2, 1)).toEqual({ logoStart: 11, logoSide: 7, clearStart: 10, clearSide: 9 })
  })
  test('the logo side has the parity of the matrix so it sits on whole modules', () => {
    for (const size of [21, 25, 29, 57]) for (const s of [0.05, 0.1, 0.17, 0.25]) expect(logoBox(size, s, 0).logoSide % 2).toBe(size % 2)
  })
})

describe('checkLogoBox', () => {
  test('9.6% of the area and clearStart 10 is accepted (version 3 defaults)', () => {
    expect(() => checkLogoBox(29, logoBox(29, 0.2, 1))).not.toThrow()
  })
  test('above 10% of the area is rejected (version 4, padding 2: 11.1%)', () => {
    expect(code(() => checkLogoBox(33, logoBox(33, 0.2, 2)))).toBe('INVALID_VALUE')
  })
  test('version 1 with defaults is rejected', () => {
    expect(code(() => checkLogoBox(21, logoBox(21, 0.2, 1)))).toBe('INVALID_VALUE')
  })
  test('a small box that reaches row/column 8 (format information) is rejected; row 9 is accepted', () => {
    expect(code(() => checkLogoBox(21, logoBox(21, 0.2, 0)))).toBe('INVALID_VALUE') // 5×5 at 8
    expect(() => checkLogoBox(21, logoBox(21, 0.1, 0))).not.toThrow() // 3×3 at 9, 2% of the area
  })
  test('the message gives the numbers and a way out', () => {
    expect(() => checkLogoBox(33, logoBox(33, 0.2, 2))).toThrow(/11\.1% of the code \(max 10%\).*minVersion/)
  })
})

describe('checkLogoHref', () => {
  test.each(['data:image/png;base64,AAAA', 'data:image/svg+xml,<svg/>', 'data:image/jpeg;base64,x', 'data:image/webp;base64,x', 'https://x.vn/a.png', 'http://x.vn/a.png', 'logo.svg', 'img/logo.png', './a.png', '../a.png?v=1#x'])(
    'accepts %s',
    (href) => {
      expect(checkLogoHref(href)).toBe(href)
    },
  )
  test.each(['javascript:alert(1)', 'JAVASCRIPT:x', 'data:text/html,x', 'data:image/gif;base64,x', '//evil.com/a.png', 'vbscript:x', ' javascript:x', '', 'a:b/c', 'file:///etc/passwd'])(
    'rejects %o',
    (href) => {
      expect(code(() => checkLogoHref(href))).toBe('INVALID_VALUE')
    },
  )
})

describe('toSvg with a logo', () => {
  test('no dark module inside the cleared box; every module outside it is unchanged', () => {
    const m = toMatrix(TEXT, { ecc: 'H' })
    const box = logoBox(m.size, 0.2, 1)
    const inBox = (x: number, y: number) =>
      x >= box.clearStart && x < box.clearStart + box.clearSide && y >= box.clearStart && y < box.clearStart + box.clearSide
    const cells = cellsOf(toSvg(TEXT, { margin: 0, logo: { href: HREF } }), 0)
    m.modules.forEach((row, y) =>
      row.forEach((dark, x) => expect(cells.has(`${x},${y}`), `${x},${y}`).toBe(dark && !inBox(x, y))),
    )
  })

  test('an image over the logo area and a background rect over the cleared box, offset by the margin', () => {
    const m = toMatrix(TEXT, { ecc: 'H' })
    const box = logoBox(m.size, 0.2, 1)
    const svg = toSvg(TEXT, { logo: { href: HREF } })
    const c = box.clearStart + 4
    const l = box.logoStart + 4
    expect(svg).toContain(`<rect x="${c}" y="${c}" width="${box.clearSide}" height="${box.clearSide}" fill="#ffffff"/>`)
    expect(svg).toContain(
      `<image href="${HREF}" x="${l}" y="${l}" width="${box.logoSide}" height="${box.logoSide}" preserveAspectRatio="xMidYMid meet"/>`,
    )
    expect(svg.indexOf('<path')).toBeLessThan(svg.indexOf('<image'))
  })

  test('logo background: own colour, or none when transparent', () => {
    expect(toSvg(TEXT, { logo: { href: HREF, background: '#eeeeee' } })).toContain('fill="#eeeeee"/><image')
    const none = toSvg(TEXT, { background: 'transparent', logo: { href: HREF } })
    expect(none).not.toContain('<rect')
    expect(code(() => toSvg(TEXT, { logo: { href: HREF, background: 'white' } }))).toBe('INVALID_VALUE')
  })

  test('ECC: H when not given; H accepted; anything else rejected', () => {
    expect(cellsOf(toSvg(TEXT, { margin: 0, logo: { href: HREF, size: 0.01, padding: 0 } }), 0).size).toBeGreaterThan(0)
    const plain = toMatrix(TEXT, { ecc: 'H' })
    const box = logoBox(plain.size, 0.2, 1)
    expect(toSvg(TEXT, { ecc: 'H', logo: { href: HREF } })).toBe(toSvg(TEXT, { logo: { href: HREF } }))
    expect(toSvg(TEXT, { logo: { href: HREF } })).toContain(`width="${box.logoSide}"`)
    expect(code(() => toSvg(TEXT, { ecc: 'M', logo: { href: HREF } }))).toBe('INVALID_VALUE')
    expect(code(() => toSvg(TEXT, { ecc: 'L', logo: { href: HREF } }))).toBe('INVALID_VALUE')
  })

  test('the matrix under a logo is the ECC H matrix', () => {
    const m = toMatrix(TEXT, { ecc: 'H' })
    const svg = toSvg(TEXT, { margin: 0, logo: { href: HREF } })
    expect(svg).toContain(`viewBox="0 0 ${m.size} ${m.size}"`)
  })

  test.each([0, 0.26, -0.1, Number.NaN, '0.2'])('logo size %o is rejected', (size) => {
    expect(code(() => toSvg(TEXT, { logo: { href: HREF, size } } as SvgOptions))).toBe('INVALID_VALUE')
  })
  test('logo size 0.25 with padding 0 is accepted when it fits', () => {
    expect(toSvg(TEXT, { minVersion: 10, logo: { href: HREF, size: 0.25, padding: 0 } })).toContain('<image')
  })
  test.each([5, 1.5, -1])('logo padding %o is rejected', (padding) => {
    expect(code(() => toSvg(TEXT, { logo: { href: HREF, padding } }))).toBe('INVALID_VALUE')
  })
  test('a logo on a version 1 code is rejected, not silently enlarged', () => {
    expect(code(() => toSvg('A', { logo: { href: HREF } }))).toBe('INVALID_VALUE')
  })

  test('an href with a quote is escaped and cannot add attributes', () => {
    const svg = toSvg(TEXT, { logo: { href: 'logo.svg" onload="alert(1)' } })
    expect(svg).toContain('href="logo.svg&quot; onload=&quot;alert(1)"')
    expect(svg).not.toContain('" onload="')
  })
  test('a javascript: href is rejected', () => {
    expect(code(() => toSvg(TEXT, { logo: { href: 'javascript:alert(1)' } }))).toBe('INVALID_VALUE')
  })
})

describe('checkLogoHref anchoring', () => {
  test.each(['javascript:alert(1)//https://x.vn/a.png', 'javascript:x//data:image/png;base64,AAAA', 'x data:image/png,AA'])(
    'rejects %o (the safe prefix must be at the start)',
    (href) => {
      expect(code(() => checkLogoHref(href))).toBe('INVALID_VALUE')
    },
  )
  test('rejects a non-string that stringifies to a safe href', () => {
    const fake = { toString: () => 'logo.png', length: 8 } as unknown as string
    expect(code(() => checkLogoHref(fake))).toBe('INVALID_VALUE')
  })
})

describe('logo size and padding bounds on a large code (area limit not reached)', () => {
  test('size 0.26 is rejected even when it would fit', () => {
    expect(() => toSvg(TEXT, { minVersion: 40, logo: { href: HREF, size: 0.26, padding: 0 } })).toThrow(/size must be/)
  })
  test('padding 5 is rejected even when it would fit; padding 4 is accepted', () => {
    expect(() => toSvg(TEXT, { minVersion: 40, logo: { href: HREF, size: 0.05, padding: 5 } })).toThrow(/padding must be/)
    expect(toSvg(TEXT, { minVersion: 40, logo: { href: HREF, size: 0.05, padding: 4 } })).toContain('<image')
  })
})

test('an SVG with a logo is a complete document', () => {
  const svg = toSvg(TEXT, { logo: { href: HREF } })
  expect(svg.startsWith('<svg ')).toBe(true)
  expect(svg.endsWith('</svg>')).toBe(true)
  expect(svg.match(/<\/svg>/g)).toHaveLength(1)
})
