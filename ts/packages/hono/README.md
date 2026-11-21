# @tingqr/hono

Serve payment QR codes (VietQR, PromptPay, KHQR…) as SVG from your own [Hono](https://hono.dev) routes. Runs wherever
Hono runs: Cloudflare Workers, Node, Bun, Deno. No network calls.

> tingqr does **not** confirm payments or receive webhooks. It only builds, reads and draws QR codes.

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
- A `TingQrError` (bad payload or option, also when thrown by `resolve`) → `400` JSON
  `{ "error": { "code": "INVALID_VALUE", "message": "…" } }`. A broken image is never served.
- Any other error from `resolve` goes to `app.onError` unchanged.

Render options (`margin`, `foreground`, `background`, `size`, `logo`, `ecc`…) are those of `toSvg` from
`@tingqr/render`.

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
