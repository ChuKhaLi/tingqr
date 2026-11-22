# @tingqr/render

Draw payment QR payloads (built with `@tingqr/core`) as a module matrix, an SVG string, or a PNG in the browser. The QR
encoder is ported from Project Nayuki's QR Code generator (MIT, see NOTICE). No runtime dependency besides
`@tingqr/core`.

> tingqr does **not** confirm payments or receive webhooks.
>
> **Not released yet.** See the [repository README](https://github.com/ChuKhaLi/tingqr#readme) for status and for which
> codes have been scanned with real banking apps.

## SVG (browsers, Node, Workers, SSR)

```ts
import { toSvg } from '@tingqr/render'

const svg = toSvg(payload, { margin: 4, size: 240 })
```

Options: `ecc`, `minVersion`, `maxVersion`, `mask`, `margin` (0–16), `foreground`/`background` (hex, checked for
contrast), `size`, `logo` (provisional limits until scanned with real banking apps). Bad input throws `TingQrError`.

## PNG in the browser: `@tingqr/render/canvas`

In-app browsers (Zalo, Messenger, Facebook) often cannot save an SVG; a PNG `<img>` is meant to be long-pressed and saved (not yet tested by tingqr in Zalo or Messenger).

```ts
import { drawQr, toPng, toPngBlob, toPngDataUrl } from '@tingqr/render/canvas'

img.src = await toPngDataUrl(payload, { scale: 8 }) // 8 px per module
const { blob, dataUrl } = await toPng(payload)       // one drawing, both forms
await drawQr(myCanvas, payload)                      // draw on your own canvas, then add your own text
```

- Same options and checks as `toSvg`, plus `scale` (integer 1–64 px per module) instead of `size`.
- **Browser only, ESM only.** On a server use `toSvg`. Errors: `NO_CANVAS` (no canvas, or no PNG encoding),
  `LOGO_LOAD_FAILED` (also when a logo on another origin has no CORS headers), `CANVAS_TAINTED` (a cross-origin image
  tainted the canvas, e.g. a logo redirected to another origin). Prefer data URIs such as `@tingqr/bank-logos`.
- Importing `@tingqr/render` alone never pulls in the canvas code.

## License

MIT. The QR encoder is © Project Nayuki, MIT; see NOTICE.
