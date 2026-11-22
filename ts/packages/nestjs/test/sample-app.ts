// A small NestJS app using @tingqr/nestjs as a developer would. Explicit @Inject everywhere: these test files are
// compiled by esbuild, which emits no decorator metadata.
import { Controller, Get, HttpCode, Inject, Module, Param, Patch, Post, Put } from '@nestjs/common'
import { TingQrModule, TingQrService, TingQrSvg, type TingQrModuleOptions } from '@tingqr/nestjs'
import { PROMPTPAY } from './payload.js'

@Controller()
class OrdersController {
  constructor(@Inject(TingQrService) private readonly tingqr: TingQrService) {}

  @Get('orders/:id/qr.svg')
  @TingQrSvg()
  async qr(@Param('id') id: string): Promise<string | null> {
    await new Promise((r) => setTimeout(r, 1)) // like a database lookup
    if (id === 'A1') return this.tingqr.paymentQr({ amount: 50000, purpose: 'TINGQR TEST' })
    if (id === 'ACCENT') return this.tingqr.paymentQr({ purpose: 'Tiền' })
    if (id === 'BOOM') throw new Error('database down')
    return null
  }

  @Get('pp.svg')
  @TingQrSvg({ cacheControl: 'no-store' })
  promptpay(): string {
    return PROMPTPAY
  }

  /** Nest answers POST with 201 by default; an image response is 200 whatever the method. */
  @Post('pp.svg')
  @TingQrSvg()
  promptpayPost(): string {
    return PROMPTPAY
  }

  @Put('pp.svg')
  @TingQrSvg()
  promptpayPut(): string {
    return PROMPTPAY
  }

  @Patch('pp.svg')
  @TingQrSvg()
  promptpayPatch(): string {
    return PROMPTPAY
  }

  /** An explicit @HttpCode is the app's choice and is kept. */
  @Post('pp-accepted.svg')
  @HttpCode(202)
  @TingQrSvg()
  promptpayAccepted(): string {
    return PROMPTPAY
  }
}

/** A feature module that renders QR codes without importing TingQrModule. */
@Controller('feature')
class FeatureController {
  @Get('qr.svg')
  @TingQrSvg()
  qr(): string {
    return PROMPTPAY
  }
}
@Module({ controllers: [FeatureController] })
class FeatureModule {}

/** @TingQrSvg on the class (default for every route) and again on a method (override). */
@Controller('both')
@TingQrSvg()
class BothLevelsController {
  @Get('plain.svg')
  plain(): string {
    return PROMPTPAY
  }

  @Get('override.svg')
  @TingQrSvg({ cacheControl: 'no-store' })
  override(): string {
    return PROMPTPAY
  }
}

export function appModule(options: TingQrModuleOptions) {
  @Module({ imports: [TingQrModule.forRoot(options), FeatureModule], controllers: [OrdersController, BothLevelsController] })
  class AppModule {}
  return AppModule
}
