import { Component, provideZonelessChangeDetection, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { TingQrError } from '@tingqr/core'
import { toSvg, type SvgOptions } from '@tingqr/render'
import { TingQrSvgPipe } from '@tingqr/angular'
import { PAYLOAD } from './payload.js'

@Component({
  imports: [TingQrSvgPipe],
  template: '<div [innerHTML]="payload() | tingqrSvg: options()"></div>',
})
// A test host compiled JIT from this file: plain signals, because JIT does not see signal inputs.
class Host {
  readonly payload = signal<string | null | undefined>(undefined)
  readonly options = signal<SvgOptions | undefined>(undefined)
}

async function render(payload: string | null | undefined, options?: SvgOptions): Promise<HTMLElement> {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] })
  const f = TestBed.createComponent(Host)
  f.componentInstance.payload.set(payload)
  f.componentInstance.options.set(options)
  await f.whenStable()
  return (f.nativeElement as HTMLElement).querySelector('div')!
}

/** The same SVG string, parsed by the DOM, for comparison with what Angular put in the page. */
function asHtml(svg: string): string {
  const div = document.createElement('div')
  div.innerHTML = svg
  return div.innerHTML
}

afterEach(() => vi.restoreAllMocks())

test('a valid payload becomes the SVG of toSvg, kept intact by the sanitizer', async () => {
  const div = await render(PAYLOAD)
  expect(div.innerHTML).toBe(asHtml(toSvg(PAYLOAD)))
  expect(div.querySelector('svg path')).not.toBeNull()
})

test('options are passed to toSvg', async () => {
  const div = await render(PAYLOAD, { margin: 1, size: 200 })
  expect(div.innerHTML).toBe(asHtml(toSvg(PAYLOAD, { margin: 1, size: 200 })))
})

test.each(['', null, undefined])('%o gives an empty result', async (payload) => {
  expect((await render(payload)).innerHTML).toBe('')
})

test('a bad option gives an empty result, does not throw, and logs the TingQrError in dev mode', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const div = await render(PAYLOAD, { foreground: '#ffffff' })
  expect(div.innerHTML).toBe('')
  const logged = log.mock.calls.flat().find((a) => a instanceof TingQrError) as TingQrError | undefined
  expect(logged?.code).toBe('INVALID_VALUE')
})
