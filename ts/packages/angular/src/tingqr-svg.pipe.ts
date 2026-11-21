import { inject, isDevMode, Pipe, type PipeTransform } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { TingQrError } from '@tingqr/core'
import { toSvg, type SvgOptions } from '@tingqr/render'

/**
 * Render a payload as an SVG QR code for `[innerHTML]`: `<div [innerHTML]="payload | tingqrSvg"></div>`.
 *
 * A bad payload or option gives an empty result (never a wrong code, never a broken page); in dev mode the TingQrError
 * is logged. Use `<tingqr-code>` to receive errors as an output.
 *
 * Why bypassing the sanitizer is safe here: Angular's sanitizer strips SVG from innerHTML. This SVG is built by toSvg
 * from validated options only: every attribute value is escaped, colours are checked hex, and a logo href must be a
 * data:image URI, an http(s) URL or a relative path (checkLogoHref). No caller text reaches the markup unescaped.
 */
@Pipe({ name: 'tingqrSvg' })
export class TingQrSvgPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer)

  transform(payload: string | null | undefined, options?: SvgOptions): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgOrEmpty(payload, options))
  }
}

function svgOrEmpty(payload: string | null | undefined, options: SvgOptions | undefined): string {
  if (payload === null || payload === undefined || payload === '') return ''
  try {
    return toSvg(payload, options)
  } catch (e) {
    if (!(e instanceof TingQrError)) throw e
    if (isDevMode()) console.error('tingqrSvg:', e)
    return ''
  }
}
