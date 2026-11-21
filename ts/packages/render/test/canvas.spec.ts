import { TingQrError } from '@tingqr/core'
import { drawQr, type CanvasOptions } from '../src/canvas.js'
import { toMatrix } from '../src/index.js'
import { darkCells, FakeCanvas, paintedCells } from './fake-canvas.js'

const TEXT = 'TINGQR CANVAS TEST'

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    if (e instanceof TingQrError) return e.code
    throw e
  }
  return 'no error'
}

describe('drawQr', () => {
  test('sizes the canvas to whole pixels per module, margin included', async () => {
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { scale: 3 })
    const side = (toMatrix(TEXT).size + 8) * 3
    expect([c.width, c.height]).toEqual([side, side])
  })

  test('paints the background over the whole image first', async () => {
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { scale: 3, background: '#fafafa' })
    const side = c.width
    expect(c.calls[0]).toEqual({ op: 'fillRect', x: 0, y: 0, w: side, h: side, fill: '#fafafa' })
  })

  test.each([1, 3, 8])('the dark rectangles are exactly the dark modules (scale %i)', async (scale) => {
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { scale })
    expect(paintedCells(c.calls, '#000000', scale, 4)).toEqual(darkCells(toMatrix(TEXT).modules))
  })

  test('default scale is 8 and margin and colours are honoured', async () => {
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { margin: 2, foreground: '#102030' })
    expect(c.width).toBe((toMatrix(TEXT).size + 4) * 8)
    expect(paintedCells(c.calls, '#102030', 8, 2)).toEqual(darkCells(toMatrix(TEXT).modules))
  })

  test('one rectangle per horizontal run', async () => {
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { scale: 1 })
    const runs = toMatrix(TEXT).modules.reduce(
      (n, row) => n + row.filter((dark, x) => dark && !row[x - 1]).length,
      0,
    )
    expect(c.calls.filter((k) => k.op === 'fillRect' && k.fill === '#000000')).toHaveLength(runs)
  })

  test('transparent background clears instead of painting', async () => {
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { scale: 2, background: 'transparent' })
    expect(c.calls[0]).toEqual({ op: 'clearRect', x: 0, y: 0, w: c.width, h: c.width, fill: undefined })
    expect(c.calls.some((k) => k.op === 'fillRect' && k.fill !== '#000000')).toBe(false)
  })

  test.each([0, 65, 2.5, Number.NaN, '8'])('scale %o is rejected', async (scale) => {
    expect(await code(drawQr(new FakeCanvas(), TEXT, { scale } as CanvasOptions))).toBe('INVALID_VALUE')
  })

  test('scale 64 is accepted', async () => {
    const c = new FakeCanvas()
    await drawQr(c, 'x', { scale: 64 })
    expect(c.width).toBe((toMatrix('x').size + 8) * 64)
  })

  test('bad layout options are INVALID_VALUE and nothing is drawn', async () => {
    const c = new FakeCanvas()
    expect(await code(drawQr(c, TEXT, { foreground: '#fff' }))).toBe('INVALID_VALUE')
    expect(c.calls).toEqual([])
  })

  test('a canvas without a 2D context is NO_CANVAS', async () => {
    const c = new FakeCanvas()
    c.context = null
    expect(await code(drawQr(c, TEXT))).toBe('NO_CANVAS')
  })
})
