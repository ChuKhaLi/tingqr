import { HttpException, InternalServerErrorException, Logger, NotFoundException, type CallHandler, type ExecutionContext } from '@nestjs/common'
import { HttpAdapterHost, Reflector } from '@nestjs/core'
import { TingQrError } from '@tingqr/core'
import { toSvg } from '@tingqr/render'
import { TingQrSvg, TingQrSvgInterceptor, TINGQR_OPTIONS } from '@tingqr/nestjs'
import { defer, firstValueFrom, from, of, throwError } from 'rxjs'
import { SVG_HEADERS, VIETQR } from './payload.js'

const PAYLOAD = VIETQR.payload
const HEADERS = SVG_HEADERS

class Routes {
  @TingQrSvg()
  plain() {}
  @TingQrSvg({ cacheControl: 'no-store' })
  noStore() {}
}

/** Run the interceptor around a handler whose result stream is `result`, on route `route` of Routes. */
async function run(
  result: () => ReturnType<CallHandler['handle']>,
  opts: { route?: keyof Routes; moduleSvg?: object | null; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = opts.headers ?? {}
  const response = { fake: 'response' }
  const statuses: number[] = []
  const request = { fake: 'request' }
  const host = {
    httpAdapter: {
      setHeader: (res: unknown, name: string, value: string) => (expect(res).toBe(response), (headers[name] = value)),
      status: (res: unknown, code: number) => (expect(res).toBe(response), statuses.push(code)),
    },
  }
  const options = opts.moduleSvg === null ? undefined : { bank: 'MB', accountNumber: '0123456789', bin: '970422', svg: opts.moduleSvg ?? undefined }
  const interceptor = new TingQrSvgInterceptor(host as unknown as HttpAdapterHost, new Reflector(), options as never)
  const context = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    getHandler: () => Routes.prototype[opts.route ?? 'plain'],
    getClass: () => Routes,
  } as unknown as ExecutionContext
  const body = await firstValueFrom(interceptor.intercept(context, { handle: result }))
  return { body, headers, statuses }
}

async function failure(result: () => ReturnType<CallHandler['handle']>, opts?: Parameters<typeof run>[1]): Promise<{ error: unknown; headers: Record<string, string> }> {
  const headers: Record<string, string> = {}
  try {
    await run(result, { ...opts, headers })
  } catch (error) {
    return { error, headers }
  }
  throw new Error('no error')
}

test('a payload becomes the SVG of toSvg with the four headers', async () => {
  const { body, headers, statuses } = await run(() => of(PAYLOAD))
  expect(body).toBe(toSvg(PAYLOAD))
  expect(headers).toEqual(HEADERS)
  expect(statuses).toEqual([200])
})

test.each([
  // next.handle() of NestJS emits the resolved value of an async handler (Promise or Observable), later.
  ['a promise', () => from(new Promise<string>((r) => setTimeout(() => r(PAYLOAD), 5)))],
  ['a deferred observable', () => defer(() => of(PAYLOAD))],
])('a value that arrives later (%s) gives the same result', async (_name, handle) => {
  const { body, headers } = await run(handle as never)
  expect(body).toBe(toSvg(PAYLOAD))
  expect(headers).toEqual(HEADERS)
})

test('route options override module svg options, key by key', async () => {
  // Overlapping key (cacheControl): the route wins; other module keys (margin) still apply.
  const { body, headers } = await run(() => of(PAYLOAD), { route: 'noStore', moduleSvg: { margin: 2, cacheControl: 'public, max-age=60' } })
  expect(body).toBe(toSvg(PAYLOAD, { margin: 2 }))
  expect(headers['Cache-Control']).toBe('no-store')
})

test('works without TingQrModule (no options): toSvg defaults', async () => {
  const { body } = await run(() => of(PAYLOAD), { moduleSvg: null })
  expect(body).toBe(toSvg(PAYLOAD))
})

test.each([null, undefined, ''])('%o is 404 and sets no header', async (value) => {
  const { error, headers } = await failure(() => of(value))
  expect(error).toBeInstanceOf(NotFoundException)
  expect(headers).toEqual({})
})

test('a payload that cannot be drawn is 500 with only the code, logged, and no image header', async () => {
  const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
  const { error, headers } = await failure(() => of('a'.repeat(5000)))
  expect(error).toBeInstanceOf(InternalServerErrorException)
  expect((error as InternalServerErrorException).getResponse()).toEqual({ error: { code: 'INVALID_VALUE' } })
  expect(headers).toEqual({})
  expect(log).toHaveBeenCalledTimes(1)
  log.mockRestore()
})

test('a TingQrError from the handler is 500 with only its code; the message goes to the log', async () => {
  const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
  const { error } = await failure(() => throwError(() => new TingQrError('NON_ASCII', 'account 0123456789 has accents')))
  expect((error as HttpException).getStatus()).toBe(500)
  expect((error as HttpException).getResponse()).toEqual({ error: { code: 'NON_ASCII' } })
  expect(JSON.stringify((error as HttpException).getResponse())).not.toMatch(/0123456789/)
  expect(log.mock.calls[0]?.[0]).toMatch(/NON_ASCII.*account 0123456789 has accents/)
  log.mockRestore()
})

test('any other error passes through unchanged', async () => {
  const boom = new Error('db')
  expect((await failure(() => throwError(() => boom))).error).toBe(boom)
})

test.each([42, {}, ['x']])('a handler result of %o is a programming error, not an HTTP 4xx', async (value) => {
  const { error } = await failure(() => of(value))
  expect(error).toBeInstanceOf(Error)
  expect(error).not.toBeInstanceOf(HttpException)
})

test('a non-data: logo on a route is rejected when the decorator is applied', () => {
  expect(() => TingQrSvg({ logo: { href: 'https://example.com/l.png' } })).toThrow(
    expect.objectContaining({ code: 'INVALID_VALUE' }),
  )
})

test.each([{ margin: -1 }, { foreground: '#ffffff', background: '#ffffff' }, { size: 'big' }, { logo: { href: 'data:image/png;base64,AA', size: 0.9 } }])(
  'a bad route option %o is rejected when the decorator is applied, not per request',
  (options) => {
    expect(() => TingQrSvg(options as never)).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
  },
)

test('TINGQR_OPTIONS is exported for advanced wiring', () => {
  expect(typeof TINGQR_OPTIONS).toBe('symbol')
})

describe('route colours are checked at startup only as far as the route alone decides them', () => {
  test('a route foreground that needs the module background (transparent) is accepted', () => {
    expect(() => TingQrSvg({ foreground: '#888888' })).not.toThrow()
    expect(() => toSvg(PAYLOAD, { background: 'transparent', foreground: '#888888' })).not.toThrow()
  })
  test('a route foreground that is not a colour is still rejected', () => {
    expect(() => TingQrSvg({ foreground: 'grey' })).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
  })
  test('both colours on the route: the contrast is checked', () => {
    expect(() => TingQrSvg({ foreground: '#888888', background: '#999999' })).toThrow(
      expect.objectContaining({ code: 'INVALID_VALUE' }),
    )
  })
})
