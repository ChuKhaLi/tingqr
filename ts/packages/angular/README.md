# @tingqr/angular

Angular component and pipe for payment QR codes (VietQR, PromptPay, KHQR…). Standalone, signals, zoneless, safe in
server-side rendering. Angular 20 or later: CI tests Angular 20.3; Angular 21.2 was tried in one app (`mode="img"`, in
the browser, not in CI).

> tingqr does **not** confirm payments or receive webhooks. It only builds, reads and draws QR codes.
>
> **Not released yet.** See the [repository README](https://github.com/ChuKhaLi/tingqr#readme) for status and for which
> codes have been scanned with real banking apps.

```sh
npm i @tingqr/angular @tingqr/core
```

## `<tingqr-code>`

```ts
import { Component } from '@angular/core'
import { encodeVietQr } from '@tingqr/core'
import { TingQrCode } from '@tingqr/angular'

@Component({
  imports: [TingQrCode],
  template: `<tingqr-code [payload]="payload" label="QR 50,000 VND, order A1" (png)="pngReady($event)" (error)="log($event)" />`,
})
export class Pay {
  payload = encodeVietQr({ bankBin: '970422', accountNumber: '0123456789', amount: 50000, purpose: 'A1' })
  pngReady(blob: Blob) { /* e.g. enable a Save button */ }
  log(e: unknown) { console.error(e) }
}
```

| Input | |
|---|---|
| `payload` (required) | QR string from `@tingqr/core`, any scheme. `''`, `null` and `undefined` (e.g. `order$ | async` before its first value) draw nothing. Pass a stable `options` object: a new object redraws the PNG. |
| `mode` | `'auto'` (default): SVG on the server and at first paint, then a PNG `<img>` drawn in the browser. `'svg'`: always SVG. `'img'`: PNG only (nothing on the server). |
| `options` | Options of `toSvg` / `@tingqr/render/canvas` (`margin`, colours, `logo`, `scale`…). |
| `label` | Accessible name (`role="img"` on the host) and the PNG's `alt`. |

| Output | |
|---|---|
| `error` | `TingQrError` for a payload or option that cannot be drawn, or a PNG that cannot be made (`CANVAS_TAINTED`…). Input that fails validation draws nothing. |
| `png` | The `Blob` of the PNG now shown. |

When `payload` changes, the old image disappears at once; a PNG still drawing for an old payload is dropped. The component
draws whatever valid payload you give it: building the right payload is up to your code and `@tingqr/core`.

Why PNG: the in-app browsers of chat apps often cannot save an SVG, while a PNG `<img>` is meant to be long-pressed and saved.
That this works in Zalo and Messenger is **not yet tested** by tingqr.

## Pipe

```html
<div [innerHTML]="payload | tingqrSvg: { margin: 2 }"></div>
```

A bad payload or option gives an empty result (the `TingQrError` is logged in dev mode). The pipe bypasses Angular's
sanitizer for the SVG it builds: every attribute is escaped and a logo `href` must be a `data:image` URI, an http(s) URL
or a relative path.

## License

MIT.
