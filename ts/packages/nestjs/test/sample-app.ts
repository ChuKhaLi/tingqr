// A small NestJS app using @tingqr/nestjs as a developer would. Explicit @Inject everywhere: these test files are
// compiled by esbuild, which emits no decorator metadata.
import { Controller, Get, Inject, Module, Param } from '@nestjs/common'
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

export function appModule(options: TingQrModuleOptions) {
  @Module({ imports: [TingQrModule.forRoot(options), FeatureModule], controllers: [OrdersController] })
  class AppModule {}
  return AppModule
}
