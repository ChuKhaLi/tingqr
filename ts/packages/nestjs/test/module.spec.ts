import { Inject, Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { encodeVietQr, TingQrError } from '@tingqr/core'
import { TingQrModule, TingQrService } from '@tingqr/nestjs'
import { VIETQR } from './payload.js'

async function serviceFor(module: unknown): Promise<TingQrService> {
  const ref = await Test.createTestingModule({ imports: [module as never] }).compile()
  return ref.get(TingQrService)
}

async function startupError(module: unknown): Promise<TingQrError> {
  try {
    await Test.createTestingModule({ imports: [module as never] }).compile()
  } catch (e) {
    if (e instanceof TingQrError) return e
    throw e
  }
  throw new Error('compiled without error')
}

describe('forRoot', () => {
  test('paymentQr builds the VietQR of the configured account', async () => {
    const s = await serviceFor(TingQrModule.forRoot({ bank: 'MB', accountNumber: '0123456789' }))
    expect(s.bin).toBe('970422')
    expect(s.bank.bin).toBe('970422')
    expect(s.paymentQr({ amount: 50000, purpose: 'TINGQR TEST' })).toBe(VIETQR.payload)
    expect(s.paymentQr()).toBe(encodeVietQr({ bankBin: '970422', accountNumber: '0123456789' }))
  })

  test.each(['mb', '970422'])('bank %s is found too', async (bank) => {
    expect((await serviceFor(TingQrModule.forRoot({ bank, accountNumber: '0123456789' }))).bin).toBe('970422')
  })

  test('service card builds a QRIBFTTC code', async () => {
    const s = await serviceFor(TingQrModule.forRoot({ bank: 'MB', accountNumber: '9704220123456789', service: 'card' }))
    const want = encodeVietQr({ bankBin: '970422', accountNumber: '9704220123456789', service: 'card', amount: 1000 })
    expect(s.paymentQr({ amount: 1000 })).toBe(want)
    expect(want).toContain('QRIBFTTC')
  })

  test.each([
    ['unknown bank', { bank: 'NOPE', accountNumber: '0123456789' }, /NOPE/],
    ['bad account', { bank: 'MB', accountNumber: '12' }, /./],
    ['logo that is not a data URI', { bank: 'MB', accountNumber: '0123456789', svg: { logo: { href: '/logo.png' } } }, /data:image/],
    ['light foreground', { bank: 'MB', accountNumber: '0123456789', svg: { foreground: '#ffffff' } }, /Foreground/],
  ])('%s: the app does not start (INVALID_VALUE)', async (_name, options, message) => {
    const e = await startupError(TingQrModule.forRoot(options))
    expect(e.code).toBe('INVALID_VALUE')
    expect(e.message).toMatch(message)
  })

  test('bad payment input throws the core error', async () => {
    const s = await serviceFor(TingQrModule.forRoot({ bank: 'MB', accountNumber: '0123456789' }))
    expect(() => s.paymentQr({ purpose: 'Tiền hàng' })).toThrow(expect.objectContaining({ code: 'NON_ASCII' }))
  })
})

describe('forRootAsync', () => {
  test('useFactory (async)', async () => {
    const s = await serviceFor(TingQrModule.forRootAsync({ useFactory: async () => ({ bank: 'VCB', accountNumber: '0123456789' }) }))
    expect(s.bin).toBe('970436')
  })

  test('inject a config provider from an imported module', async () => {
    const CONFIG = 'CONFIG'
    @Module({ providers: [{ provide: CONFIG, useValue: { bank: 'TCB', account: '0123456789' } }], exports: [CONFIG] })
    class ConfigModule {}
    const s = await serviceFor(
      TingQrModule.forRootAsync({
        imports: [ConfigModule],
        inject: [CONFIG],
        useFactory: (c: { bank: string; account: string }) => ({ bank: c.bank, accountNumber: c.account }),
      }),
    )
    expect(s.bin).toBe('970407')
  })

  test('inject accepts an optional dependency, as Nest factory providers do', async () => {
    const s = await serviceFor(
      TingQrModule.forRootAsync({
        inject: [{ token: 'MISSING_CONFIG', optional: true }],
        useFactory: (c?: { account: string }) => ({ bank: 'VCB', accountNumber: c?.account ?? '0123456789' }),
      }),
    )
    expect(s.bin).toBe('970436')
  })

  test('a factory that rejects stops the app', async () => {
    const boom = new Error('no config')
    await expect(Test.createTestingModule({ imports: [TingQrModule.forRootAsync({ useFactory: async () => Promise.reject(boom) })] }).compile()).rejects.toBe(boom)
  })

  test('a factory with a bad bank stops the app', async () => {
    expect((await startupError(TingQrModule.forRootAsync({ useFactory: () => ({ bank: 'NOPE', accountNumber: '0123456789' }) }))).code).toBe('INVALID_VALUE')
  })
})

test('isGlobal: a module that does not import TingQrModule can inject TingQrService', async () => {
  @Injectable()
  class Pay {
    constructor(@Inject(TingQrService) readonly tingqr: TingQrService) {}
  }
  @Module({ providers: [Pay] })
  class Feature {}
  const ref = await Test.createTestingModule({
    imports: [TingQrModule.forRoot({ bank: 'MB', accountNumber: '0123456789', isGlobal: true }), Feature],
  }).compile()
  expect(ref.get(Pay).tingqr.bin).toBe('970422')
})
