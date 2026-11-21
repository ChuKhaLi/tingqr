import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TingQrError } from '@tingqr/core'
import { toSvg } from '@tingqr/render'
import { Hono } from 'hono'
import { tingqr, tingqrSvg } from '../src/index.js'
import { CONFORMANCE_DIR } from './conformance-root.js'

// A sourced VietQR payload (fake account), not made up here.
const PAYLOAD: string = JSON.parse(
  readFileSync(join(CONFORMANCE_DIR, 'vectors', 'vietqr', 'vietqr-dynamic-amount-purpose.json'), 'utf8'),
).payload

const SVG_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  'cache-control': 'private, max-age=300',
}

function headersOf(res: Response, names: string[]): Record<string, string | null> {
  return Object.fromEntries(names.map((n) => [n, res.headers.get(n)]))
}

describe('tingqrSvg', () => {
  test('returns the SVG of toSvg with safe headers', async () => {
    const app = new Hono().get('/qr.svg', (c) => tingqrSvg(c, PAYLOAD))
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(toSvg(PAYLOAD))
    expect(headersOf(res, Object.keys(SVG_HEADERS))).toEqual(SVG_HEADERS)
  })

  test('render options are passed through and cacheControl is overridable', async () => {
    const app = new Hono().get('/qr.svg', (c) => tingqrSvg(c, PAYLOAD, { margin: 2, size: 240, cacheControl: 'no-store' }))
    const res = await app.request('/qr.svg')
    expect(await res.text()).toBe(toSvg(PAYLOAD, { margin: 2, size: 240 }))
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  test('bad options throw TingQrError instead of returning a response', async () => {
    let thrown: unknown
    const app = new Hono().get('/qr.svg', (c) => {
      try {
        return tingqrSvg(c, PAYLOAD, { foreground: '#ffffff' })
      } catch (e) {
        thrown = e
        return c.text('caught', 500)
      }
    })
    await app.request('/qr.svg')
    expect(thrown).toBeInstanceOf(TingQrError)
    expect((thrown as TingQrError).code).toBe('INVALID_VALUE')
  })
})

describe('tingqr route', () => {
  test('serves the payload resolve returns', async () => {
    const app = new Hono().get('/orders/:id/qr.svg', tingqr({ resolve: (c) => (c.req.param('id') === 'A1' ? PAYLOAD : null) }))
    const res = await app.request('/orders/A1/qr.svg')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(toSvg(PAYLOAD))
    expect(headersOf(res, Object.keys(SVG_HEADERS))).toEqual(SVG_HEADERS)
  })

  test('an async resolve works', async () => {
    const app = new Hono().get('/qr.svg', tingqr({ resolve: async () => PAYLOAD }))
    expect((await app.request('/qr.svg')).status).toBe(200)
  })

  test.each([null, undefined, ''])('resolve returning %o is 404 with no image', async (value) => {
    const app = new Hono().get('/qr.svg', tingqr({ resolve: () => value }))
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).not.toContain('svg')
  })

  test('the route never reads the query string', async () => {
    const app = new Hono().get('/qr', tingqr({ resolve: () => PAYLOAD }))
    const res = await app.request('/qr?acc=9999999999&bank=970436&amount=1&margin=0&foreground=%23ff0000')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(toSvg(PAYLOAD)) // the query changed nothing: same code, default options
  })

  test('render options and cacheControl apply', async () => {
    const app = new Hono().get('/qr.svg', tingqr({ resolve: () => PAYLOAD, margin: 1, cacheControl: 'no-store' }))
    const res = await app.request('/qr.svg')
    expect(await res.text()).toBe(toSvg(PAYLOAD, { margin: 1 }))
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  test('a TingQrError is 400 JSON with the code, not an image', async () => {
    const app = new Hono().get('/qr.svg', tingqr({ resolve: () => PAYLOAD, foreground: '#ffffff' }))
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toMatch(/^application\/json/)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('INVALID_VALUE')
    expect(body.error.message).toMatch(/Foreground/)
  })

  test('a payload too long for a QR code is 400', async () => {
    const app = new Hono().get('/qr.svg', tingqr({ resolve: () => 'a'.repeat(5000) }))
    expect((await app.request('/qr.svg')).status).toBe(400)
  })

  test('passes non-TingQrError from resolve to onError', async () => {
    const boom = new Error('db')
    let seen: unknown
    const app = new Hono()
      .get('/qr.svg', tingqr({ resolve: () => Promise.reject(boom) }))
      .onError((err, c) => {
        seen = err
        return c.text('down', 503)
      })
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(503)
    expect(seen).toBe(boom)
  })

  test('resolve sees the app bindings and route params with their types', async () => {
    type AppEnv = { Bindings: { ACCOUNT: string } }
    const app = new Hono<AppEnv>().get(
      '/orders/:id/qr.svg',
      tingqr<AppEnv, '/orders/:id/qr.svg'>({
        resolve: (c) => {
          const account: string = c.env.ACCOUNT
          // @ts-expect-error -- c.env is the app's Bindings, not any: a misspelled binding does not compile
          void c.env.ACCOUNTX
          const id: string = c.req.param('id') // typed param (string | undefined without the path generic)
          return id === 'A1' && account === 'ok' ? PAYLOAD : null
        },
      }),
    )
    expect((await app.request('/orders/A1/qr.svg', {}, { ACCOUNT: 'ok' })).status).toBe(200)
  })

  test('a TingQrError thrown by resolve itself is also 400', async () => {
    const app = new Hono().get(
      '/qr.svg',
      tingqr({
        resolve: () => {
          throw new TingQrError('NON_ASCII', 'Purpose has accents.')
        },
      }),
    )
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NON_ASCII')
  })
})
