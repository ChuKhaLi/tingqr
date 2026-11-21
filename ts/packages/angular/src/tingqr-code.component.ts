import { isPlatformBrowser } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { TingQrError } from '@tingqr/core'
import { toSvg } from '@tingqr/render'
import { toPng, type CanvasOptions } from '@tingqr/render/canvas'

export type TingQrMode = 'auto' | 'svg' | 'img'

type SvgState = { svg: SafeHtml } | { error: TingQrError } | null

/**
 * A payment QR code. `payload` is a QR string built with @tingqr/core (any scheme).
 *
 * - `mode="svg"`: inline SVG, also in server-side rendering.
 * - `mode="img"`: an `<img>` with a PNG drawn in the browser (long-press savable in chat apps' in-app browsers);
 *   nothing on the server.
 * - `mode="auto"` (default): SVG on the server and at first paint, replaced by the PNG once it is drawn in the browser.
 *
 * A bad payload or option draws nothing and emits `error`; an empty payload draws nothing. Never a wrong code: when the
 * payload changes, the old image goes at once, and a PNG that finishes drawing for an old payload is dropped.
 */
@Component({
  selector: 'tingqr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'label() ?? null' },
  styles: ':host{display:inline-block}:host>span{display:contents}:host>img{display:block;width:100%;height:auto}',
  template: `
    @if (pngUrl(); as src) {
      <img [src]="src" [alt]="label() ?? ''" />
    } @else if (mode() !== 'img') {
      @if (svgState(); as s) {
        @if ('svg' in s) {
          <span [innerHTML]="s.svg"></span>
        }
      }
    }
  `,
})
export class TingQrCode {
  readonly payload = input.required<string>()
  readonly options = input<CanvasOptions>({})
  readonly mode = input<TingQrMode>('auto')
  /** Accessible name of the code (e.g. the amount and the order); also the PNG's alt text. */
  readonly label = input<string | undefined>(undefined)
  /** A TingQrError for a payload or option that cannot be drawn, or a PNG that cannot be made (e.g. CANVAS_TAINTED). */
  readonly error = output<TingQrError>()
  /** The PNG now shown (modes img and auto), e.g. to enable a "Save" or share button. */
  readonly png = output<Blob>()

  private readonly sanitizer = inject(DomSanitizer)
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID))
  /** Data URL of the PNG for the current payload and options; null while drawing or when there is none. */
  protected readonly pngUrl = signal<string | null>(null)
  private drawing = 0

  /** The SVG for the current payload and options, or the error; null for an empty payload. */
  protected readonly svgState = computed<SvgState>(() => {
    const payload = this.payload()
    if (payload === '') return null
    const { scale: _scale, ...svgOptions } = this.options()
    try {
      // Safe to bypass the sanitizer: see TingQrSvgPipe for why toSvg output contains no unescaped caller text.
      return { svg: this.sanitizer.bypassSecurityTrustHtml(toSvg(payload, svgOptions)) }
    } catch (e) {
      if (e instanceof TingQrError) return { error: e }
      throw e
    }
  })

  constructor() {
    effect(() => {
      const state = this.svgState()
      if (state !== null && 'error' in state) untracked(() => this.error.emit(state.error))
    })
    effect(() => {
      // The SVG check already validated payload and options: draw only a code that can be drawn.
      const state = this.svgState()
      const wantPng = this.browser && this.mode() !== 'svg' && state !== null && 'svg' in state
      const payload = this.payload()
      const options = this.options()
      const run = ++this.drawing
      untracked(() => {
        this.pngUrl.set(null)
        if (wantPng) void this.draw(run, payload, options)
      })
    })
  }

  private async draw(run: number, payload: string, options: CanvasOptions): Promise<void> {
    try {
      const { blob, dataUrl } = await toPng(payload, options)
      if (run !== this.drawing) return
      this.pngUrl.set(dataUrl)
      this.png.emit(blob)
    } catch (e) {
      if (run !== this.drawing) return
      if (e instanceof TingQrError) this.error.emit(e)
      else throw e
    }
  }
}
