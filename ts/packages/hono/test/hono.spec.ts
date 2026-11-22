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

// The shared HTTP contract of the SVG integrations (conformance/http/svg-response.json), header names lowercased.
const CONTRACT = JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'http', 'svg-response.json'), 'utf8')) as {
  success: { headers: Record<string, string> }
  tingQrError: { status: number }
}
const SVG_HEADERS = Object.fromEntries(Object.entries(CONTRACT.success.headers).map(([k, v]) => [k.toLowerCase(), v]))

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

  test('a TingQrError is a 500 with only the code; the message goes to the server log, not the client', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const secret = new TingQrError('INVALID_VALUE', 'account 0123456789 is misconfigured')
    const app = new Hono().get(
      '/qr.svg',
      tingqr({
        resolve: () => {
          throw secret
        },
      }),
    )
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(CONTRACT.tingQrError.status)
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toMatch(/^application\/json/)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ error: { code: 'INVALID_VALUE' } })
    expect(text).not.toMatch(/0123456789|misconfigured/)
    expect(log).toHaveBeenCalledWith(secret)
    log.mockRestore()
  })

  test('a payload too long for a QR code is a 500 with its code, logged', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = new Hono().get('/qr.svg', tingqr({ resolve: () => 'a'.repeat(5000) }))
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(500)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_VALUE')
    expect(log).toHaveBeenCalledTimes(1)
    log.mockRestore()
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

  test('a TingQrError thrown by resolve itself is also 500 with the code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = new Hono().get(
      '/qr.svg',
      tingqr({
        resolve: () => {
          throw new TingQrError('NON_ASCII', 'Purpose has accents.')
        },
      }),
    )
    const res = await app.request('/qr.svg')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: { code: 'NON_ASCII' } })
    vi.restoreAllMocks()
  })
})

describe('logos over HTTP', () => {
  // An SVG served as an image never loads outside resources (and the CSP allows only data: images): a path or URL
  // logo would come out as an empty square. tingqr never serves a code without the logo that was asked for.
  test.each(['/logo.png', 'https://example.com/logo.png'])('tingqrSvg rejects logo %s with INVALID_VALUE', async (href) => {
    let thrown: unknown
    const app = new Hono().get('/qr.svg', (c) => {
      try {
        return tingqrSvg(c, PAYLOAD, { minVersion: 5, logo: { href } })
      } catch (e) {
        thrown = e
        return c.text('caught', 500)
      }
    })
    await app.request('/qr.svg')
    expect((thrown as TingQrError).code).toBe('INVALID_VALUE')
    expect((thrown as TingQrError).message).toMatch(/data:image/)
  })

  test('a data: URI logo is served', async () => {
    const href = 'data:image/png;base64,AAAA'
    const app = new Hono().get('/qr.svg', (c) => tingqrSvg(c, PAYLOAD, { minVersion: 5, logo: { href } }))
    expect((await app.request('/qr.svg')).status).toBe(200)
  })

  test('the route rejects a non-data: logo when it is created, not on every request', () => {
    expect(() => tingqr({ resolve: () => PAYLOAD, logo: { href: '/logo.png' } })).toThrow(TingQrError)
  })
})
