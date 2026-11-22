import {
  applyDecorators,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
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
import { checkSvgOptions, toSvg } from '@tingqr/render'
import { catchError, map, throwError, type Observable } from 'rxjs'
import { checkServedLogo, type ResolvedTingQrOptions, type TingQrSvgOptions } from './options.js'
import { TINGQR_OPTIONS } from './tokens.js'

/** Metadata key of the per-route options set by @TingQrSvg. */
export const TINGQR_SVG_ROUTE = 'tingqr:svg-route'

/** Metadata key of Nest's @HttpCode (HTTP_CODE_METADATA in @nestjs/common/constants, not exported from the root). */
const HTTP_CODE = '__httpCode__'

/** Requests whose response a TingQrSvgInterceptor is already rendering. */
const RENDERING = new WeakSet<object>()

/** Where a TingQrError's message goes: the server log, never the response. */
const logger = new Logger('TingQrSvg')

/** SVG served directly is a document: no scripts, no external loads, only inline styles and data: images. */
const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'"

/**
 * Turns the QR payload a handler returns into an SVG image response (the same contract as @tingqr/hono):
 * a string → 200 SVG with safe headers; null, undefined or '' → 404 (NotFoundException); a TingQrError → 500
 * (InternalServerErrorException with `{ error: { code } }`; the message is logged with Nest's Logger, never sent: the app
 * builds the payload, so the message may describe its configuration). Other errors pass through. Use it through @TingQrSvg().
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
    // An image is 200 whatever the method (Nest answers POST with 201), unless the route sets @HttpCode itself.
    const status = this.reflector.get<number | undefined>(HTTP_CODE, context.getHandler()) ?? 200
    return next.handle().pipe(
      map((value: unknown) => {
        if (value === null || value === undefined || value === '') throw new NotFoundException()
        if (typeof value !== 'string') {
          throw new TypeError(`A @TingQrSvg() handler must return a QR payload string, null or undefined; got ${typeof value}.`)
        }
        const svg = toSvg(value, svgOptions)
        const adapter = this.host.httpAdapter
        adapter.status(response, status)
        adapter.setHeader(response, 'Content-Type', 'image/svg+xml; charset=utf-8')
        adapter.setHeader(response, 'X-Content-Type-Options', 'nosniff')
        adapter.setHeader(response, 'Content-Security-Policy', CSP)
        adapter.setHeader(response, 'Cache-Control', cacheControl)
        return svg
      }),
      catchError((e: unknown) => {
        if (e instanceof TingQrError) {
          logger.error(`${e.code}: ${e.message}`, e.stack)
          throw new InternalServerErrorException({ error: { code: e.code } })
        }
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
  if (options !== undefined) {
    const { cacheControl: _cacheControl, ...svgOptions } = options
    // A bad option stops the app at startup, not every request. The route is merged over the module's `svg` options,
    // so a route foreground alone is checked as a colour only: its contrast depends on the module's background. (A
    // route background alone is checked against black, the darkest foreground, so that check holds for any module.)
    const routeOnly = svgOptions.foreground !== undefined && svgOptions.background === undefined
    checkSvgOptions(routeOnly ? { ...svgOptions, background: 'transparent' } : svgOptions)
  }
  return applyDecorators(SetMetadata(TINGQR_SVG_ROUTE, options), UseInterceptors(TingQrSvgInterceptor))
}
