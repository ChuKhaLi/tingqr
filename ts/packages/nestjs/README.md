# @tingqr/nestjs

NestJS module for payment QR codes: configure the receiving account once, build VietQR codes with `TingQrService`, and
serve any QR code (VietQR, PromptPay, KHQR…) as SVG from your own controllers with `@TingQrSvg()`. No network calls.

Tested on NestJS 12.6 with Express and with Fastify (CI). Peer range `>=10`; versions before 12 are not tested.

> tingqr does **not** confirm payments or receive webhooks. It only builds, reads and draws QR codes.

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
- **The configuration is checked when the app starts.** An unknown bank, an invalid account or bad `svg` options stop
  the app with a `TingQrError` (`INVALID_VALUE`), instead of failing at the first request.

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
| a QR string (any scheme) | `200`, SVG |
| `null`, `undefined`, `''` | `404` (`NotFoundException`) |
| throws a `TingQrError`, or the string / options cannot be drawn | `400` (`BadRequestException`, body `{ "error": { "code", "message" } }`) |
| throws anything else | unchanged: your exception filters decide (`500` by default) |

- 404 and 400 go through Nest's exception layer, so your filters and logging apply (and a global filter may change the
  body). Status codes, image headers and error codes match `@tingqr/hono`.
- Image headers: `Content-Type: image/svg+xml; charset=utf-8`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`, and
  `Cache-Control: private, max-age=300` (the code carries an account number and often an amount; change it with
  `@TingQrSvg({ cacheControl })`).
- `@TingQrSvg(options)` takes the options of `toSvg` from `@tingqr/render`; they override the module's `svg` options key
  by key. A `logo` must be a `data:image/` URI (e.g. from `@tingqr/bank-logos`): an SVG shown as an image cannot load a
  path or URL, so other logos are rejected when the decorator runs.
- `@TingQrSvg()` works without `TingQrModule` (e.g. to serve PromptPay codes); only `TingQrService` needs `forRoot`.
- An SVG `<img>` may not be savable by long-press in chat apps' in-app browsers (not tested). In the browser, draw a PNG
  with `@tingqr/render/canvas` or `@tingqr/angular`.

### Why there is no open `?acc=&bank=` endpoint

A route that builds a QR from query parameters lets anyone make a code for any account and amount on your domain, which
is what scammers need. Your controller always decides what goes into the code.

## Builds without decorator metadata

The package injects everything with explicit `@Inject(...)`, so it works in apps built with esbuild or SWC. In such an
app, inject the service the same way: `@Inject(TingQrService)`.

## License

MIT.
