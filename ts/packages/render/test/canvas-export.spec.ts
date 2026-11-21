import { TingQrError } from '@tingqr/core'
import { drawQr, toPngBlob, toPngDataUrl } from '../src/canvas.js'
import { toMatrix } from '../src/index.js'
import { logoBox } from '../src/logo.js'
import { ExportingCanvas, FakeCanvas, fakeImageClass } from './fake-canvas.js'

const TEXT = 'TINGQR CANVAS LOGO'
const DATA_HREF = 'data:image/png;base64,AAAA'
const HTTP_HREF = 'https://example.com/logo.png'

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    if (e instanceof TingQrError) return e.code
    throw e
  }
  return 'no error'
}

const g = globalThis as Record<string, unknown>
afterEach(() => {
  delete g.Image
  delete g.document
})

/** Install a fake `Image` and `document.createElement('canvas')`; `setup` adjusts each new canvas. */
function installDom(image = fakeImageClass({ width: 10, height: 10 }), setup: (c: ExportingCanvas) => void = () => {}) {
  const canvases: ExportingCanvas[] = []
  g.Image = image.FakeImage
  g.document = {
    createElement: (tag: string) => {
      expect(tag).toBe('canvas')
      const c = new ExportingCanvas()
      setup(c)
      canvases.push(c)
      return c
    },
  }
  return { ...image, canvases }
}

function boxOf(text: string) {
  return logoBox(toMatrix(text, { ecc: 'H', minVersion: 5 }).size, 0.2, 1)
}

describe('logo on canvas', () => {
  test('a square logo is drawn once over the logo box, scaled and offset by the margin', async () => {
    const { created } = installDom()
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { minVersion: 5, scale: 3, logo: { href: DATA_HREF } })
    const box = boxOf(TEXT)
    const p = (box.logoStart + 4) * 3
    const draws = c.calls.filter((k) => k.op === 'drawImage')
    expect(draws).toEqual([{ op: 'drawImage', image: created[0], x: p, y: p, w: box.logoSide * 3, h: box.logoSide * 3 }])
    expect(created[0]?.src).toBe(DATA_HREF)
    expect(created[0]?.crossOrigin).toBeNull()
  })

  test('the logo is drawn last, over its background', async () => {
    installDom()
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { minVersion: 5, logo: { href: DATA_HREF, background: '#eeeeee' } })
    expect(c.calls.at(-1)?.op).toBe('drawImage')
    expect(c.calls.at(-2)).toMatchObject({ op: 'fillRect', fill: '#eeeeee' })
  })

  test('a wide logo keeps its aspect ratio and is centred vertically (xMidYMid meet)', async () => {
    installDom(fakeImageClass({ width: 200, height: 100 }))
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { minVersion: 5, scale: 2, logo: { href: DATA_HREF } })
    const box = boxOf(TEXT)
    const side = box.logoSide * 2
    const p = (box.logoStart + 4) * 2
    expect(c.calls.find((k) => k.op === 'drawImage')).toMatchObject({ x: p, y: p + side / 4, w: side, h: side / 2 })
  })

  test('a tall logo is centred horizontally', async () => {
    installDom(fakeImageClass({ width: 50, height: 100 }))
    const c = new FakeCanvas()
    await drawQr(c, TEXT, { minVersion: 5, scale: 2, logo: { href: DATA_HREF } })
    const box = boxOf(TEXT)
    const side = box.logoSide * 2
    const p = (box.logoStart + 4) * 2
    expect(c.calls.find((k) => k.op === 'drawImage')).toMatchObject({ x: p + side / 4, y: p, w: side / 2, h: side })
  })

  test('an http(s) logo is requested with crossOrigin anonymous', async () => {
    const { created } = installDom()
    await drawQr(new FakeCanvas(), TEXT, { minVersion: 5, logo: { href: HTTP_HREF } })
    expect(created[0]?.crossOrigin).toBe('anonymous')
  })

  test('a logo that fails to load is LOGO_LOAD_FAILED and nothing is drawn', async () => {
    installDom(fakeImageClass({ width: 10, height: 10 }, true))
    const c = new FakeCanvas()
    expect(await code(drawQr(c, TEXT, { minVersion: 5, logo: { href: DATA_HREF } }))).toBe('LOGO_LOAD_FAILED')
    expect(c.calls).toEqual([])
  })

  test('a logo with no size after decoding is LOGO_LOAD_FAILED', async () => {
    installDom(fakeImageClass({ width: 0, height: 0 }))
    expect(await code(drawQr(new FakeCanvas(), TEXT, { minVersion: 5, logo: { href: DATA_HREF } }))).toBe('LOGO_LOAD_FAILED')
  })

  test('no Image constructor when a logo is needed is NO_CANVAS', async () => {
    expect(await code(drawQr(new FakeCanvas(), TEXT, { minVersion: 5, logo: { href: DATA_HREF } }))).toBe('NO_CANVAS')
  })
})

describe('PNG export', () => {
  test('toPngBlob draws on a new canvas and returns its PNG blob', async () => {
    const { canvases } = installDom()
    const blob = await toPngBlob(TEXT, { scale: 2 })
    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe(`png ${(toMatrix(TEXT).size + 8) * 2}`)
    expect(canvases).toHaveLength(1)
    expect(canvases[0]?.calls.length).toBeGreaterThan(1)
  })

  test('toPngDataUrl returns a PNG data URL of the drawn canvas', async () => {
    installDom()
    const url = await toPngDataUrl(TEXT, { scale: 2 })
    expect(url).toBe(`data:image/png;base64,${Buffer.from(`png ${(toMatrix(TEXT).size + 8) * 2}`).toString('base64')}`)
  })

  test('maps SecurityError from toBlob to CANVAS_TAINTED', async () => {
    installDom(undefined, (c) => {
      c.exportError = new DOMException('tainted', 'SecurityError')
    })
    expect(await code(toPngBlob(TEXT))).toBe('CANVAS_TAINTED')
    expect(await code(toPngDataUrl(TEXT))).toBe('CANVAS_TAINTED')
  })

  test('other export errors are not hidden', async () => {
    installDom(undefined, (c) => {
      c.exportError = new RangeError('boom')
    })
    await expect(toPngBlob(TEXT)).rejects.toThrow(RangeError)
    await expect(toPngDataUrl(TEXT)).rejects.toThrow(RangeError)
  })

  test('toBlob giving null is NO_CANVAS', async () => {
    installDom(undefined, (c) => {
      c.blobResult = 'null'
    })
    expect(await code(toPngBlob(TEXT))).toBe('NO_CANVAS')
  })

  test('no document is NO_CANVAS', async () => {
    expect(await code(toPngBlob(TEXT))).toBe('NO_CANVAS')
    expect(await code(toPngDataUrl(TEXT))).toBe('NO_CANVAS')
  })

  test('bad options are INVALID_VALUE before any canvas is needed', async () => {
    expect(await code(toPngBlob(TEXT, { scale: 0 }))).toBe('INVALID_VALUE')
    expect(await code(toPngDataUrl(TEXT, { foreground: '#fff' }))).toBe('INVALID_VALUE')
  })
})
