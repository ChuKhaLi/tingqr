import { Module, type DynamicModule, type FactoryProvider, type ModuleMetadata, type Provider } from '@nestjs/common'
import { resolveOptions, type TingQrModuleOptions } from './options.js'
import { TingQrService } from './service.js'
import { TINGQR_OPTIONS } from './tokens.js'

export interface TingQrModuleAsyncOptions {
  imports?: ModuleMetadata['imports']
  /** Tokens for useFactory's arguments, as in a Nest factory provider (`{ token, optional: true }` too). */
  inject?: FactoryProvider['inject']
  useFactory: (...args: any[]) => TingQrModuleOptions | Promise<TingQrModuleOptions>
  /** Register TingQrService for the whole app. Default false. */
  isGlobal?: boolean
}

/**
 * Configure the receiving account once. The configuration is checked when the app starts: an unknown bank, an invalid
 * account, a non-data: logo or SVG options that cannot render the account's static code stop the app with a TingQrError.
 * Options that depend on payload length (maxVersion, ecc) are only checked per request.
 */
@Module({})
export class TingQrModule {
  static forRoot(options: TingQrModuleOptions & { isGlobal?: boolean }): DynamicModule {
    const { isGlobal = false, ...moduleOptions } = options
    return TingQrModule.build(isGlobal, [], { provide: TINGQR_OPTIONS, useFactory: () => resolveOptions(moduleOptions) })
  }

  static forRootAsync(options: TingQrModuleAsyncOptions): DynamicModule {
    return TingQrModule.build(options.isGlobal ?? false, options.imports ?? [], {
      provide: TINGQR_OPTIONS,
      inject: options.inject ?? [],
      useFactory: async (...args: unknown[]) => resolveOptions(await options.useFactory(...args)),
    })
  }

  private static build(global: boolean, imports: NonNullable<ModuleMetadata['imports']>, optionsProvider: Provider): DynamicModule {
    return {
      module: TingQrModule,
      global,
      // The options live in an always-global module, so @TingQrSvg in any module (one that never imports TingQrModule)
      // gets the module's svg defaults. TingQrService itself is global only with isGlobal.
      imports: [{ module: TingQrOptionsModule, global: true, imports, providers: [optionsProvider], exports: [TINGQR_OPTIONS] }],
      providers: [TingQrService],
      exports: [TingQrService],
    }
  }
}

/** Holds the validated options (TINGQR_OPTIONS) for the whole app. Internal. */
@Module({})
class TingQrOptionsModule {}
