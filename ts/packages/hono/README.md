# @tingqr/hono

Serve payment QR codes (VietQR, PromptPay, KHQR…) as SVG from your own [Hono](https://hono.dev) routes. Tested on Node (unit
tests) and Cloudflare Workers (`wrangler dev`, one app); no `node:*` imports, so Bun and Deno are expected to work but
are untested. No network calls.

> tingqr does **not** confirm payments or receive webhooks. It only builds, reads and draws QR codes.
>
> **Not released yet.** See the [repository README](https://github.com/ChuKhaLi/tingqr#readme) for status and for which
> codes have been scanned with real banking apps.

```sh
npm i @tingqr/hono @tingqr/core hono
```

## A route for your orders

```ts
import { Hono } from 'hono'
import { encodeVietQr } from '@tingqr/core'
import { tingqr } from '@tingqr/hono'

const app = new Hono()

app.get(
  '/orders/:id/qr.svg',
  tingqr({
    // Your app decides what the code says: look the order up, return null when there is nothing to pay.
    resolve: async (c) => {
      const order = await findPendingOrder(c.req.param('id'))
      if (!order) return null
      return encodeVietQr({ bankBin: '970422', accountNumber: '0123456789', amount: String(order.amount), purpose: order.code })
    },
  }),
)
```

- `resolve` returns a payload → `200` SVG.
- `resolve` returns `null`, `undefined` or `''` → `404`.
- A `TingQrError` (bad payload or option, also when thrown by `resolve`) → `500` JSON `{ "error": { "code": "INVALID_VALUE" } }`.
  Your app builds the payload, so this is a server-side mistake (for example a misconfigured account): the message is
  written with `console.error`, never sent to the client. If you build a QR from client input and want a `400`, catch
  the error in `resolve`. A broken image is never served.
- Any other error from `resolve` goes to `app.onError` unchanged.

Render options (`margin`, `foreground`, `background`, `size`, `logo`, `ecc`…) are those of `toSvg` from
`@tingqr/render`. A `logo` must be a `data:image/` URI (e.g. from `@tingqr/bank-logos`): an SVG shown as an
image cannot load a path or URL, so tingqr rejects those (`INVALID_VALUE`, when the route is created) instead of serving a
blank logo.

Pass your app's Hono env and the route path as type arguments so `resolve` sees typed bindings and params:
`tingqr<AppEnv, '/orders/:id/qr.svg'>({ resolve: (c) => … c.env.DB … c.req.param('id') … })`.

## In your own handler

```ts
import { tingqrSvg } from '@tingqr/hono'

app.get('/qr.svg', (c) => tingqrSvg(c, payload, { size: 240 }))
```

`tingqrSvg` throws `TingQrError` for a payload or option it cannot render.

## Headers

| Header | Value |
|---|---|
| `Content-Type` | `image/svg+xml; charset=utf-8` |
| `X-Content-Type-Options` | `nosniff` |
| `Content-Security-Policy` | `default-src 'none'; img-src data:; style-src 'unsafe-inline'` (an SVG opened directly is a document) |
| `Cache-Control` | `private, max-age=300` by default: the code carries an account number and often an amount, so shared caches must not keep it. Change it with `cacheControl`. |

## Why there is no open `?acc=&bank=` endpoint

A route that builds a QR from query parameters lets anyone make a QR for **any** account and amount, served from your
domain. Scammers use exactly that to make a fake payment request look trustworthy. The route always asks your code
(`resolve`) what to put in the QR.

## SVG and "save image" in chat apps

An SVG in an `<img>` may not be savable by long-press in the in-app browsers of Zalo, Messenger or Facebook (not yet
tested by tingqr). For a code people need to save, draw a PNG in the browser with `@tingqr/render/canvas`
(`toPngDataUrl`), and keep this route as a fallback.

## License

MIT.
