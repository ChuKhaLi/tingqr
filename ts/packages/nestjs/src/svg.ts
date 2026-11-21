import {
  applyDecorators,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  SetMetadata,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { HttpAdapterHost, Reflector } from '@nestjs/core'
import { TingQrError } from '@tingqr/core'
import { toSvg } from '@tingqr/render'
import { catchError, map, throwError, type Observable } from 'rxjs'
import { checkServedLogo, type ResolvedTingQrOptions, type TingQrSvgOptions } from './options.js'
import { TINGQR_OPTIONS } from './tokens.js'

/** Metadata key of the per-route options set by @TingQrSvg. */
export const TINGQR_SVG_ROUTE = 'tingqr:svg-route'

/** Requests whose response a TingQrSvgInterceptor is already rendering. */
const RENDERING = new WeakSet<object>()

/** SVG served directly is a document: no scripts, no external loads, only inline styles and data: images. */
const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'"

/**
 * Turns the QR payload a handler returns into an SVG image response (the same contract as @tingqr/hono):
 * a string → 200 SVG with safe headers; null, undefined or '' → 404 (NotFoundException); a TingQrError → 400
 * (BadRequestException with `{ error: { code, message } }`). Other errors pass through. Use it through @TingQrSvg().
 */
@Injectable()
export class TingQrSvgInterceptor implements NestInterceptor {
  // Explicit @Inject: works without decorator metadata (esbuild, SWC builds). TINGQR_OPTIONS is optional, so the
  // interceptor also renders any QR (PromptPay, KHQR…) in apps that never call TingQrModule.forRoot.
  constructor(
    @Inject(HttpAdapterHost) private readonly host: HttpAdapterHost,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional() @Inject(TINGQR_OPTIONS) private readonly options?: ResolvedTingQrOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<string> {
    // @TingQrSvg on a class and on one of its methods adds this interceptor twice. Render once per request (the outer
    // instance, which runs first); otherwise the SVG markup would be rendered again as if it were the payload.
    const request = context.switchToHttp().getRequest<object>()
    if (RENDERING.has(request)) return next.handle() as Observable<string>
    RENDERING.add(request)
    const route = this.reflector.getAllAndOverride<TingQrSvgOptions | undefined>(TINGQR_SVG_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ])
    const { cacheControl = 'private, max-age=300', ...svgOptions } = { ...this.options?.svg, ...route }
    const response: unknown = context.switchToHttp().getResponse()
    return next.handle().pipe(
      map((value: unknown) => {
        if (value === null || value === undefined || value === '') throw new NotFoundException()
        if (typeof value !== 'string') {
          throw new TypeError(`A @TingQrSvg() handler must return a QR payload string, null or undefined; got ${typeof value}.`)
        }
        const svg = toSvg(value, svgOptions)
        const adapter = this.host.httpAdapter
        adapter.setHeader(response, 'Content-Type', 'image/svg+xml; charset=utf-8')
        adapter.setHeader(response, 'X-Content-Type-Options', 'nosniff')
        adapter.setHeader(response, 'Content-Security-Policy', CSP)
        adapter.setHeader(response, 'Cache-Control', cacheControl)
        return svg
      }),
      catchError((e: unknown) => {
        if (e instanceof TingQrError) throw new BadRequestException({ error: { code: e.code, message: e.message } })
        return throwError(() => e)
      }),
    )
  }
}

/**
 * Serve the QR payload this route returns as an SVG image. `options` (those of toSvg, plus cacheControl) override the
 * module's `svg` options key by key. A logo must be a data:image/ URI; anything else is rejected right here.
 *
 * ```ts
 * @Get('orders/:id/qr.svg')
 * @TingQrSvg()
 * qr(@Param('id') id: string) { return this.orders.pending(id) ? this.tingqr.paymentQr({ … }) : null }
 * ```
 */
export function TingQrSvg(options?: TingQrSvgOptions): MethodDecorator & ClassDecorator {
  checkServedLogo(options)
  return applyDecorators(SetMetadata(TINGQR_SVG_ROUTE, options), UseInterceptors(TingQrSvgInterceptor))
}
