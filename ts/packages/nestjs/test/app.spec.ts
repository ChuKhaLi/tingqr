import type { INestApplication } from '@nestjs/common'
import { NestFactory, type AbstractHttpAdapter } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { TingQrError } from '@tingqr/core'
import { toSvg } from '@tingqr/render'
import { PROMPTPAY, SVG_HEADERS_LOWER, VIETQR } from './payload.js'
import { appModule } from './sample-app.js'

const HEADERS = SVG_HEADERS_LOWER
const ADAPTERS = [
  ['express', () => new ExpressAdapter()],
  ['fastify', () => new FastifyAdapter()],
] as const

describe.each(ADAPTERS)('same contract on %s', (_name, adapter) => {
  let app: INestApplication
  let base: string
  beforeAll(async () => {
    app = await NestFactory.create(appModule({ bank: 'MB', accountNumber: '0123456789' }), adapter() as AbstractHttpAdapter, { logger: false })
    await app.listen(0, '127.0.0.1')
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1')
  })
  afterAll(() => app.close())
  const get = (path: string) => fetch(base + path)

  test('a pending order: 200, the SVG of its VietQR, the four headers exactly', async () => {
    const res = await get('/orders/A1/qr.svg')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(toSvg(VIETQR.payload))
    for (const [name, value] of Object.entries(HEADERS)) expect([name, res.headers.get(name)]).toEqual([name, value])
  })

  test('no order: 404, not an image', async () => {
    const res = await get('/orders/NONE/qr.svg')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type') ?? '').not.toContain('svg')
  })

  test('a TingQrError from the handler: 400 JSON with the code', async () => {
    const res = await get('/orders/ACCENT/qr.svg')
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NON_ASCII')
  })

  test('another error: 500 (Nest default), not 400', async () => {
    expect((await get('/orders/BOOM/qr.svg')).status).toBe(500)
  })

  test('the query string changes nothing', async () => {
    const res = await get('/orders/A1/qr.svg?acc=9999999999&bank=970436&amount=1&margin=0')
    expect(await res.text()).toBe(toSvg(VIETQR.payload))
  })

  test('any QR (PromptPay) with route options', async () => {
    const res = await get('/pp.svg')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(toSvg(PROMPTPAY))
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  test('a module that does not import TingQrModule can use @TingQrSvg', async () => {
    const res = await get('/feature/qr.svg')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(toSvg(PROMPTPAY))
  })
})

test.each(ADAPTERS)('a bad bank stops the app before it serves anything (%s)', async (_name, adapter) => {
  let error: unknown
  try {
    const app = await NestFactory.create(appModule({ bank: 'NOPE', accountNumber: '0123456789' }), adapter() as AbstractHttpAdapter, {
      logger: false,
      abortOnError: false,
    })
    await app.close()
  } catch (e) {
    error = e
  }
  expect(error).toBeInstanceOf(TingQrError)
  expect((error as TingQrError).code).toBe('INVALID_VALUE')
})
