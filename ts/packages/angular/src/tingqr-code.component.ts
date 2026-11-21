import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { TingQrError } from '@tingqr/core'
import { toSvg } from '@tingqr/render'
import type { CanvasOptions } from '@tingqr/render/canvas'

export type TingQrMode = 'auto' | 'svg' | 'img'

type SvgState = { svg: SafeHtml } | { error: TingQrError } | null

/**
 * A payment QR code. `payload` is a QR string built with @tingqr/core (any scheme).
 *
 * - `mode="svg"`: inline SVG, also in server-side rendering.
 * - `mode="img"`: an `<img>` with a PNG drawn in the browser (long-press savable in chat apps' in-app browsers).
 * - `mode="auto"` (default): SVG first (server and first paint), then the PNG once it is drawn in the browser.
 *
 * A bad payload or option draws nothing and emits `error`; an empty payload draws nothing. Never a wrong code.
 */
@Component({
  selector: 'tingqr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'label() ?? null' },
  styles: ':host{display:inline-block}:host>span{display:contents}',
  template: `
    @if (svgState(); as s) {
      @if (showSvg() && 'svg' in s) {
        <span [innerHTML]="s.svg"></span>
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
  /** A TingQrError for a payload or option that cannot be drawn. */
  readonly error = output<TingQrError>()

  private readonly sanitizer = inject(DomSanitizer)

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

  protected readonly showSvg = computed(() => this.mode() !== 'img')

  constructor() {
    effect(() => {
      const state = this.svgState()
      if (state !== null && 'error' in state) untracked(() => this.error.emit(state.error))
    })
  }
}
