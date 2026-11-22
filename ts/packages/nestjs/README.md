# @tingqr/nestjs

NestJS module for payment QR codes: configure the receiving account once, build VietQR codes with `TingQrService`, and
serve any QR code (VietQR, PromptPay, KHQR…) as SVG from your own controllers with `@TingQrSvg()`. No network calls.

Tested on NestJS 12.6 with Express and with Fastify (CI). Peer range `>=10`; versions before 12 are not tested.

> tingqr does **not** confirm payments or receive webhooks. It only builds, reads and draws QR codes.
>
> **Not released yet.** See the [repository README](https://github.com/ChuKhaLi/tingqr#readme) for status and for which
> codes have been scanned with real banking apps.

```sh
npm i @tingqr/nestjs @tingqr/core
```

## Configure the receiving account

```ts
import { TingQrModule } from '@tingqr/nestjs'

@Module({
  imports: [TingQrModule.forRoot({ bank: 'MB', accountNumber: '0123456789' })],
})
export class AppModule {}
```

From environment variables, with `@nestjs/config`:

```ts
TingQrModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    bank: config.getOrThrow('PAY_BANK'),
    accountNumber: config.getOrThrow('PAY_ACCOUNT'),
  }),
})
```

- `bank`: a bank code or BIN (`'MB'`, `'vcb'`, `'970422'`…), looked up with `findBank` of `@tingqr/core/banks`.
- `service: 'card'` for a card number; `svg` for default image options; `isGlobal: true` to use the service everywhere.
- **The configuration is checked when the app starts.** An unknown bank, an invalid account, a logo that is not a data
  URI, or `svg` options that cannot render the account's static code (colours, margin, logo size…) stop the app with a
  `TingQrError` (`INVALID_VALUE`). Options that depend on the payload length (`maxVersion`, `ecc`) are only checked per
  request (400).

## Build a code

```ts
constructor(@Inject(TingQrService) private readonly tingqr: TingQrService) {}

const payload = this.tingqr.paymentQr({ amount: 50000, purpose: 'ORDER A1' }) // VietQR string
```

Without `amount` you get a static code. A purpose with Vietnamese accents throws `NON_ASCII` (banking apps reject it).
`tingqr.bin` and `tingqr.bank` give the configured bank.

## Serve the QR as an image

```ts
@Get('orders/:id/qr.svg')
@TingQrSvg()
async qr(@Param('id') id: string) {
  const order = await this.orders.findPending(id)
  return order ? this.tingqr.paymentQr({ amount: order.amount, purpose: order.code }) : null
}
```

| The handler returns | Response |
|---|---|
| any non-empty string (not validated: build it with tingqr's encoders, e.g. `paymentQr`) | `200`, SVG |
| `null`, `undefined`, `''` | `404` (`NotFoundException`) |
| throws a `TingQrError`, or the string / options cannot be drawn | `400` (`BadRequestException`, body `{ "error": { "code", "message" } }`) |
| throws anything else | unchanged: your exception filters decide (`500` by default) |

- 404 and 400 go through Nest's exception layer, so your filters and logging apply (and a global filter may change the
  body). Status codes, the image headers and the 400 error code follow the contract shared with `@tingqr/hono`
  (`conformance/http/svg-response.json`); the 404 body differs.
- Image headers: `Content-Type: image/svg+xml; charset=utf-8`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`, and
  `Cache-Control: private, max-age=300` (the code carries an account number and often an amount; change it with
  `@TingQrSvg({ cacheControl })`).
- `@TingQrSvg(options)` takes the options of `toSvg` from `@tingqr/render`; they override the module's `svg` options key
  by key. A `logo` must be a `data:image/` URI (e.g. from `@tingqr/bank-logos`): an SVG shown as an image cannot load a
  path or URL, so other logos are rejected when the decorator runs.
- `@TingQrSvg()` works without `TingQrModule` (e.g. to serve PromptPay codes); only `TingQrService` needs `forRoot`.
- The module `svg` options apply to every `@TingQrSvg` route in the app, also in modules that do not import
  `TingQrModule`. `@TingQrSvg` may be put on a controller class and on its methods; each request is rendered once,
  with the method options winning.
- An SVG `<img>` may not be savable by long-press in chat apps' in-app browsers (not tested). In the browser, draw a PNG
  with `@tingqr/render/canvas` or `@tingqr/angular`.

### Why there is no open `?acc=&bank=` endpoint

A route that builds a QR from query parameters lets anyone make a code for any account and amount on your domain, which
is what scammers need. Your controller always decides what goes into the code.

## Builds without decorator metadata

The package injects everything with explicit `@Inject(...)`, so it works without decorator metadata (tested with an
esbuild build). In such an app, inject the service the same way: `@Inject(TingQrService)`.

The CommonJS entry loads NestJS 12 (ESM only) through Node's `require(esm)`: Node 20.19+ or 22.12+.

## License

MIT.
