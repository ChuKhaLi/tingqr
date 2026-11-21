import { TingQrError } from '@tingqr/core'
import { toSvg, type SvgOptions } from '@tingqr/render'
import type { Context, Env, Handler } from 'hono'

export interface TingQrSvgOptions extends SvgOptions {
  /**
   * Cache-Control header; default 'private, max-age=300'. A payment QR carries an account number and often an amount,
   * so shared caches (CDNs) must not keep it.
   */
  cacheControl?: string
}

/** `E` and `P` are your app's Hono env and the route path, so `resolve` sees typed bindings and params. */
export interface TingQrRouteOptions<E extends Env = any, P extends string = any> extends TingQrSvgOptions {
  /**
   * Return the QR payload for this request (e.g. built from an order your app looked up), or null/undefined/'' for 404.
   * Never build it from query parameters: an open "?acc=&bank=" endpoint lets anyone put a QR for any account on your
   * domain.
   */
  resolve: (c: Context<E, P>) => string | null | undefined | Promise<string | null | undefined>
}

/** SVG served directly is a document: no scripts, no external loads, only inline styles and data: images. */
const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'"

/**
 * An SVG used as an image never loads outside resources (and the CSP above allows only data: images), so a path or URL
 * logo would be served as an empty square. Never serve a code without the logo that was asked for.
 */
function checkServedLogo(options: SvgOptions): void {
  const href: unknown = options.logo?.href
  if (options.logo !== undefined && !(typeof href === 'string' && href.startsWith('data:image/'))) {
    throw new TingQrError(
      'INVALID_VALUE',
      'A logo in an SVG served over HTTP must be a data:image/ URI (e.g. from @tingqr/bank-logos): an SVG shown as an ' +
        'image cannot load a path or URL, so the logo would be blank.',
    )
  }
}

/**
 * Respond with `payload` rendered as an SVG QR code. Throws TingQrError (e.g. INVALID_VALUE) for a payload or option
 * that cannot be rendered; it never returns a broken image.
 */
export function tingqrSvg<E extends Env>(c: Context<E>, payload: string, options: TingQrSvgOptions = {}): Response {
  checkServedLogo(options)
  const { cacheControl = 'private, max-age=300', ...svgOptions } = options
  const svg = toSvg(payload, svgOptions)
  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': CSP,
    'Cache-Control': cacheControl,
  })
}

/**
 * A route handler that serves the QR code for whatever `resolve` returns:
 * 200 SVG; 404 when resolve gives nothing; 400 JSON `{ error: { code, message } }` for a TingQrError.
 * Any other error from resolve goes to Hono's error handling (app.onError) unchanged.
 */
export function tingqr<E extends Env = any, P extends string = any>(options: TingQrRouteOptions<E, P>): Handler<E, P> {
  const { resolve, ...svgOptions } = options
  checkServedLogo(svgOptions) // a config mistake fails when the route is created, not as a 400 on every request
  return async (c) => {
    try {
      const payload = await resolve(c)
      if (payload === null || payload === undefined || payload === '') return c.notFound()
      return tingqrSvg(c, payload, svgOptions)
    } catch (e) {
      if (e instanceof TingQrError) return c.json({ error: { code: e.code, message: e.message } }, 400)
      throw e
    }
  }
}
