# tingqr

Build, read and draw payment QR codes: VietQR first, then cross-border Southeast Asia (PromptPay, KHQR). TypeScript
today, .NET next. Offline, typed, and tested against sourced sample codes.

> **tingqr does not confirm payments and does not receive webhooks.** It only builds, reads and draws QR codes. To know
> that money arrived, use your bank's or a payment provider's notification (for example SePay).

**Status: not released yet.** v0.1 waits for MoMo and ZaloPay recognition and for scans with more banking apps. The
packages below are complete and tested in this repository; they are not on npm yet.

The goal: read every QR that Vietnamese banking apps can scan. The table below says how far the evidence goes today.

[![CI (TypeScript)](https://github.com/ChuKhaLi/tingqr/actions/workflows/ci-ts.yml/badge.svg)](https://github.com/ChuKhaLi/tingqr/actions/workflows/ci-ts.yml)

## What works, and what has been checked

| QR | Build | Read | Scanned with a real app |
|---|---|---|---|
| VietQR to an account (`QRIBFTTA`), static and with amount | yes | yes | **MB Bank 6.5.31** and **MyVIB 1.80.3** (Android 16), on screen and on paper, with and without a test logo |
| VietQR to a card (`QRIBFTTC`) | yes | yes | MyVIB 1.80.3 **could not read** our card sample (unknown whether the app refuses card QR or the made-up card number) |
| VNPAY-QR | — | yes | not yet |
| PromptPay (Thailand) | yes | yes | not yet |
| KHQR (Cambodia) | yes | yes | not yet |
| MoMo, ZaloPay | — | not recognised yet (waiting for real sample codes) | — |

Every scan is a row in [`conformance/scans.md`](conformance/scans.md), filled in by the person who scanned. Scanned a
tingqr code with your app? [Report it](https://github.com/ChuKhaLi/tingqr/issues/new?template=scan-report.yml).

## Packages

| Package | For |
|---|---|
| [`@tingqr/core`](ts/packages/core) | Build and read VietQR, VNPAY-QR, PromptPay, KHQR; `detect()` any payload; Vietnamese banks and banking-app links (`@tingqr/core/banks`). No dependencies. |
| [`@tingqr/render`](ts/packages/render) | Draw a QR as a module matrix or SVG (browser, Node, Workers, SSR); PNG in the browser (`@tingqr/render/canvas`). |
| [`@tingqr/bank-logos`](ts/packages/bank-logos) | Vietnamese bank logos and banking-app icons, one module per image. Images are trademarks, not MIT. |
| [`@tingqr/angular`](ts/packages/angular) | `<tingqr-code>` component and `tingqrSvg` pipe: SVG in SSR, PNG in the browser. |
| [`@tingqr/hono`](ts/packages/hono) | Serve a QR as SVG from your own Hono routes (Workers, Node). |
| [`@tingqr/nestjs`](ts/packages/nestjs) | Configure the receiving account once, `paymentQr()`, and `@TingQrSvg()` for controllers (Express, Fastify). |

## A quick look

```ts
import { encodeVietQr, detect } from '@tingqr/core'
import { toSvg } from '@tingqr/render'

// The receiver's bank BIN (MB Bank), a made-up account, an amount in VND and a transfer note.
const payload = encodeVietQr({ bankBin: '970422', accountNumber: '0123456789', amount: 50000, purpose: 'TINGQR TEST' })

const svg = toSvg(payload) // an <svg> string, no DOM needed

const found = detect(payload)
if (found.ok && found.value.scheme === 'vietqr') {
  console.log(found.value.data.accountNumber, found.value.data.amount) // '0123456789' '50000'
}
```

- Building throws a `TingQrError` with a code from [`conformance/errors.json`](conformance/errors.json) for bad input.
  For example, a transfer note with Vietnamese accents is `NON_ASCII`, because banking apps reject it.
- Reading returns a result object: `{ ok: true, value, warnings }` or `{ ok: false, error }`. Readers accept the small
  deviations found in real codes by default (each one is reported in `warnings`); pass `{ mode: 'strict' }` to refuse
  them.

## Why you can trust it

- **Sample codes with a source.** Every behaviour is pinned by a vector in [`conformance/vectors/`](conformance/vectors).
  Each vector names where it came from: a specification, a real code, or the output of independent MIT libraries that
  agree. Nothing is made up. The same vectors will test the .NET version.
- **Real-app scans** are recorded only by the person who scanned ([`conformance/scans.md`](conformance/scans.md)). This
  README claims an app only when that table has a row for it.
- **Tests:** unit tests and conformance vectors on Ubuntu and Windows, Node 20, 22 and 24. Mutation testing (90%
  threshold) for `core` and `render`. Each package has a size budget and checks of its dependencies.
- **Safe by design:** the server integrations never build a QR from URL parameters, so your domain cannot be used to
  show a QR for someone else's account. The VietQR builder writes only the tags banking apps expect and has no
  option to add others, which apps may reject.

## Licence

MIT, see [`LICENSE`](LICENSE). Exceptions and credits:
- the bank logos and app icons in `@tingqr/bank-logos` are trademarks of their owners, not MIT; see its
  [`LOGOS-NOTICE.md`](ts/packages/bank-logos/LOGOS-NOTICE.md);
- the QR encoder in `@tingqr/render` is ported from Project Nayuki's QR Code generator (MIT);
- inspired by [`vietqr/vietqr-node`](https://github.com/vietqr/vietqr-node) (MIT, Casso).

Tiếng Việt: [README.vi.md](README.vi.md).
