import { provideZonelessChangeDetection } from '@angular/core'
import { TestBed, type ComponentFixture } from '@angular/core/testing'
import { TingQrError } from '@tingqr/core'
import { toSvg } from '@tingqr/render'
import { TingQrCode } from '@tingqr/angular'
import { PAYLOAD, PAYLOAD_2 } from './payload.js'

function asHtml(svg: string): string {
  const div = document.createElement('div')
  div.innerHTML = svg
  return div.innerHTML
}

async function create(inputs: Record<string, unknown>): Promise<{ f: ComponentFixture<TingQrCode>; errors: TingQrError[] }> {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] })
  const f = TestBed.createComponent(TingQrCode)
  const errors: TingQrError[] = []
  f.componentInstance.error.subscribe((e) => errors.push(e))
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v)
  await f.whenStable()
  return { f, errors }
}
const host = (f: ComponentFixture<TingQrCode>) => f.nativeElement as HTMLElement

describe('mode svg', () => {
  test('renders the SVG of toSvg', async () => {
    const { f } = await create({ payload: PAYLOAD, mode: 'svg' })
    const svg = host(f).querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.outerHTML).toBe(asHtml(toSvg(PAYLOAD)))
  })

  test('options are passed to toSvg; scale is not an SVG option and is ignored', async () => {
    const { f } = await create({ payload: PAYLOAD, mode: 'svg', options: { margin: 2, scale: 4 } })
    expect(host(f).querySelector('svg')!.outerHTML).toBe(asHtml(toSvg(PAYLOAD, { margin: 2 })))
  })

  test('the host is an image with the label as its accessible name', async () => {
    const { f } = await create({ payload: PAYLOAD, mode: 'svg', label: 'QR 50 000 đ' })
    expect(host(f).getAttribute('role')).toBe('img')
    expect(host(f).getAttribute('aria-label')).toBe('QR 50 000 đ')
  })

  test('no label: no aria-label attribute', async () => {
    const { f } = await create({ payload: PAYLOAD, mode: 'svg' })
    expect(host(f).hasAttribute('aria-label')).toBe(false)
  })

  test('changing the payload changes the SVG', async () => {
    const { f } = await create({ payload: PAYLOAD, mode: 'svg' })
    f.componentRef.setInput('payload', PAYLOAD_2)
    await f.whenStable()
    expect(host(f).querySelector('svg')!.outerHTML).toBe(asHtml(toSvg(PAYLOAD_2)))
  })

  test('a bad option draws nothing and emits error once', async () => {
    const { f, errors } = await create({ payload: PAYLOAD, mode: 'svg', options: { foreground: '#ffffff' } })
    expect(host(f).querySelector('svg')).toBeNull()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(TingQrError)
    expect(errors[0]?.code).toBe('INVALID_VALUE')
    f.detectChanges()
    await f.whenStable()
    expect(errors).toHaveLength(1)
  })

  test('a payload too long for a QR code draws nothing and emits error', async () => {
    const { f, errors } = await create({ payload: 'a'.repeat(5000), mode: 'svg' })
    expect(host(f).querySelector('svg')).toBeNull()
    expect(errors.map((e) => e.code)).toEqual(['INVALID_VALUE'])
  })

  test('an empty payload draws nothing and emits no error', async () => {
    const { f, errors } = await create({ payload: '', mode: 'svg' })
    expect(host(f).querySelector('svg')).toBeNull()
    expect(errors).toEqual([])
  })

  test('after an error, a good payload draws again', async () => {
    const { f } = await create({ payload: 'a'.repeat(5000), mode: 'svg' })
    f.componentRef.setInput('payload', PAYLOAD)
    await f.whenStable()
    expect(host(f).querySelector('svg')).not.toBeNull()
  })
})

describe('null or undefined payload (e.g. `[payload]="order$ | async"` before the first value)', () => {
  test.each([null, undefined])('%o draws nothing and emits no error, like an empty payload', async (payload) => {
    const { f, errors } = await create({ payload, mode: 'svg' })
    expect(host(f).querySelector('svg')).toBeNull()
    expect(errors).toEqual([])
    f.componentRef.setInput('payload', PAYLOAD)
    await f.whenStable()
    expect(host(f).querySelector('svg')).not.toBeNull()
  })
})
