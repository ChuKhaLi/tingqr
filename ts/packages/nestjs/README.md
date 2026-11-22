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
  `TingQrError` (`INVALID_VALUE`). Options that depend on the payload length (`maxVersion`) are only checked per
  request (500).

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

- `@TingQrSvg()` is for HTTP controllers only (not GraphQL resolvers, microservices or WebSocket gateways).
- Options passed to `@TingQrSvg(options)` are checked when the decorator runs, so a bad colour, margin, size or logo
  stops the app at startup. Only what depends on the payload (too long for `maxVersion`, a logo too big for a small
  code) is known per request.
- Route options are merged over the module's `svg` options per request, and each set is checked on its own. A route
  `foreground` without a route `background` is checked only as a colour, since its contrast depends on the module's
  background; a clash between the two sets (for example a module `logo` and a route `ecc: 'L'`) is found per request.

| The handler returns | Response |
|---|---|
| any non-empty string (not validated: build it with tingqr's encoders, e.g. `paymentQr`) | `200`, SVG, whatever the method (also `POST`, where Nest's default is `201`) |
| `null`, `undefined`, `''` | `404` (`NotFoundException`) |
| throws a `TingQrError`, or the string / options cannot be drawn | `500` (`InternalServerErrorException`, body `{ "error": { "code" } }`); the message is logged with Nest's `Logger`, never sent |
| throws anything else | unchanged: your exception filters decide (`500` by default) |

- Your app builds the payload, so a `TingQrError` is a server-side mistake (for example a misconfigured account): its
  message may describe your configuration and stays in the log. If you build a QR from client input and want a `400`,
  validate or encode that input in the handler and answer `400` yourself; errors from drawing the string you return
  (too long, a logo too big) are always `500`.
- 404 and 500 go through Nest's exception layer, so your filters apply (and a global filter may change the body).
  Status codes, the image headers and the error code follow the contract shared with `@tingqr/hono`
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
