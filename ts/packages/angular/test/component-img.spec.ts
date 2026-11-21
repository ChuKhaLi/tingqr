import { provideZonelessChangeDetection } from '@angular/core'
import { TestBed, type ComponentFixture } from '@angular/core/testing'
import { TingQrError } from '@tingqr/core'
import { TingQrCode } from '@tingqr/angular'
import { PAYLOAD, PAYLOAD_2 } from './payload.js'

/**
 * jsdom has no canvas: document.createElement('canvas') returns a fake whose PNG is named after the canvas number
 * (first canvas created → "png-1"). toBlob callbacks wait in `pending` until released, to control finishing order.
 */
let created = 0
let pending: { id: number; release: () => void }[] = []
let failExport: unknown = undefined
/** Blob made by each canvas, to name the Blob the component emits (jsdom's Blob has no text()). */
const blobName = new Map<Blob, string>()
const realCreate = document.createElement.bind(document)
beforeEach(() => {
  created = 0
  pending = []
  failExport = undefined
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
    if (tag !== 'canvas') return realCreate(tag, opts)
    const id = ++created
    const ctx = { fillStyle: '', fillRect() {}, clearRect() {}, drawImage() {} }
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: () => {
        if (failExport !== undefined) throw failExport
        return `data:image/png;base64,${btoa(`png-${id}`)}`
      },
      toBlob: (cb: (b: Blob) => void) => {
        pending.push({
          id,
          release: () => {
            const blob = new Blob([`png-${id}`], { type: 'image/png' })
            blobName.set(blob, `png-${id}`)
            cb(blob)
          },
        })
      },
    }
  }) as typeof document.createElement)
})
afterEach(() => vi.restoreAllMocks())

const releaseAll = () => {
  for (const p of pending.splice(0)) p.release()
}

async function create(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] })
  const f = TestBed.createComponent(TingQrCode)
  const errors: TingQrError[] = []
  const pngs: string[] = []
  f.componentInstance.error.subscribe((e) => errors.push(e))
  f.componentInstance.png.subscribe((b) => pngs.push(blobName.get(b) ?? 'unknown blob'))
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v)
  await f.whenStable()
  return { f, errors, pngs }
}
const el = (f: ComponentFixture<TingQrCode>) => f.nativeElement as HTMLElement
const img = (f: ComponentFixture<TingQrCode>) => el(f).querySelector('img')
const settle = async (f: ComponentFixture<TingQrCode>) => {
  await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0))
  releaseAll()
  await vi.waitFor(async () => {
    await f.whenStable()
    expect(img(f)).not.toBeNull()
  })
}

describe('mode img', () => {
  test('nothing until the PNG is drawn, then an <img> with the PNG and the label as alt', async () => {
    const { f, pngs } = await create({ payload: PAYLOAD, mode: 'img', label: 'QR 50 000 đ' })
    expect(img(f)).toBeNull()
    expect(el(f).querySelector('svg')).toBeNull()
    await settle(f)
    expect(img(f)!.getAttribute('src')).toBe(`data:image/png;base64,${btoa('png-1')}`)
    expect(img(f)!.getAttribute('alt')).toBe('QR 50 000 đ')
    await vi.waitFor(() => expect(pngs).toEqual(['png-1']))
  })

  test('no label: an empty alt (the host carries the role)', async () => {
    const { f } = await create({ payload: PAYLOAD, mode: 'img' })
    await settle(f)
    expect(img(f)!.getAttribute('alt')).toBe('')
  })

  test('changing the payload removes the old image at once', async () => {
    const { f } = await create({ payload: PAYLOAD, mode: 'img' })
    await settle(f)
    f.componentRef.setInput('payload', PAYLOAD_2)
    await f.whenStable()
    expect(img(f)).toBeNull()
    await settle(f)
    expect(img(f)!.getAttribute('src')).toBe(`data:image/png;base64,${btoa('png-2')}`)
  })

  test('discards a stale PNG when payload changes mid-draw', async () => {
    const { f, pngs } = await create({ payload: PAYLOAD, mode: 'img' })
    await vi.waitFor(() => expect(pending.map((p) => p.id)).toEqual([1]))
    f.componentRef.setInput('payload', PAYLOAD_2)
    await f.whenStable()
    await vi.waitFor(() => expect(pending.map((p) => p.id)).toEqual([1, 2]))
    pending[1]!.release() // the new code finishes first
    await vi.waitFor(async () => {
      await f.whenStable()
      expect(img(f)?.getAttribute('src')).toBe(`data:image/png;base64,${btoa('png-2')}`)
    })
    pending[0]!.release() // then the old one: must be ignored
    await new Promise((r) => setTimeout(r, 20))
    await f.whenStable()
    expect(img(f)!.getAttribute('src')).toBe(`data:image/png;base64,${btoa('png-2')}`)
    expect(pngs).toEqual(['png-2'])
  })

  test('a drawing error is emitted and nothing is shown', async () => {
    failExport = new DOMException('tainted', 'SecurityError')
    const { f, errors } = await create({ payload: PAYLOAD, mode: 'img' })
    await vi.waitFor(() => expect(errors.map((e) => e.code)).toEqual(['CANVAS_TAINTED']))
    await f.whenStable()
    expect(img(f)).toBeNull()
    expect(el(f).querySelector('svg')).toBeNull()
  })

  test('a bad payload emits one error and never starts drawing', async () => {
    const { f, errors } = await create({ payload: 'a'.repeat(5000), mode: 'img' })
    await new Promise((r) => setTimeout(r, 20))
    expect(errors.map((e) => e.code)).toEqual(['INVALID_VALUE'])
    expect(created).toBe(0)
    expect(img(f)).toBeNull()
  })

  test('an empty payload draws nothing', async () => {
    const { f, errors } = await create({ payload: '', mode: 'img' })
    await new Promise((r) => setTimeout(r, 20))
    expect([created, errors.length, img(f)]).toEqual([0, 0, null])
  })
})

describe('mode auto (default)', () => {
  test('SVG first, then only the PNG', async () => {
    const { f } = await create({ payload: PAYLOAD })
    expect(el(f).querySelector('svg')).not.toBeNull()
    expect(img(f)).toBeNull()
    await settle(f)
    expect(el(f).querySelector('svg')).toBeNull()
  })

  test('changing the payload shows the new SVG at once, never the old PNG', async () => {
    const { f } = await create({ payload: PAYLOAD })
    await settle(f)
    f.componentRef.setInput('payload', PAYLOAD_2)
    await f.whenStable()
    expect(img(f)).toBeNull()
    expect(el(f).querySelector('svg')).not.toBeNull()
  })

  test('a drawing error keeps the SVG (still a correct code, only not savable)', async () => {
    failExport = new DOMException('tainted', 'SecurityError')
    const { f, errors } = await create({ payload: PAYLOAD })
    await vi.waitFor(() => expect(errors.map((e) => e.code)).toEqual(['CANVAS_TAINTED']))
    await f.whenStable()
    expect(el(f).querySelector('svg')).not.toBeNull()
    expect(img(f)).toBeNull()
  })
})

test('mode svg never draws a PNG', async () => {
  await create({ payload: PAYLOAD, mode: 'svg' })
  await new Promise((r) => setTimeout(r, 20))
  expect(created).toBe(0)
})
