# tingqr

Build, read and draw payment QR codes: VietQR first, then cross-border Southeast Asia (PromptPay, KHQR). For
TypeScript and [.NET](#net). Offline, typed, and tested against sourced sample codes.

> **tingqr does not confirm payments and does not receive webhooks.** It only builds, reads and draws QR codes. To know
> that money arrived, use your bank's or a payment provider's notification (for example SePay).

<!-- status:npm -->
**Status: not released yet.** v0.1 waits for MoMo and ZaloPay recognition and for scans with more banking apps. The
npm packages below are complete and tested in this repository; they are not on npm yet.

The goal: read every QR that Vietnamese banking apps can scan. The table below says how far the evidence goes today.

[![CI (TypeScript)](https://github.com/ChuKhaLi/tingqr/actions/workflows/ci-ts.yml/badge.svg)](https://github.com/ChuKhaLi/tingqr/actions/workflows/ci-ts.yml)

## What works, and what has been checked

| QR | Build | Read | Scanned with a real app |
|---|---|---|---|
| VietQR to an account (`QRIBFTTA`), static and with amount | yes | yes | **MB Bank 6.5.31** and **MyVIB 1.80.3** (Android 16), on screen and on paper, with and without a test logo |
| VietQR to a card (`QRIBFTTC`) | yes | yes | **MB Bank 6.5.31** reads our card sample (lookup of the made-up card number fails); **MyVIB 1.80.3 could not read it** (unknown whether the app refuses card QR or the made-up number) |
| VNPAY-QR | — | yes | not yet |
| PromptPay (Thailand) | yes | yes | not yet |
| KHQR (Cambodia) | yes | yes | not yet |
| MoMo, ZaloPay | — | not recognised yet (waiting for real sample codes) | — |

Every scan is a row in [`conformance/scans.md`](conformance/scans.md), filled in by the person who scanned. Scanned a
tingqr code with your app? [Report it](https://github.com/ChuKhaLi/tingqr/issues/new?template=scan-report.yml).

## Packages

| Package | For |
|---|---|
| [`@tingqr/core`](ts/packages/core) | Build and read VietQR, PromptPay, KHQR; read VNPAY-QR; `detect()` any payload; Vietnamese banks and banking-app links (`@tingqr/core/banks`). No dependencies. |
| [`@tingqr/render`](ts/packages/render) | Draw a QR as a module matrix or SVG (browser, Node, Workers, SSR); PNG in the browser (`@tingqr/render/canvas`). |
| [`@tingqr/bank-logos`](ts/packages/bank-logos) | Vietnamese bank logos and banking-app icons, one module per image. Images are trademarks, not MIT. |
| [`@tingqr/angular`](ts/packages/angular) | `<tingqr-code>` component and `tingqrSvg` pipe: SVG in SSR, PNG in the browser. |
| [`@tingqr/hono`](ts/packages/hono) | Serve a QR as SVG from your own Hono routes (Workers, Node). |
| [`@tingqr/nestjs`](ts/packages/nestjs) | Configure the receiving account once, `paymentQr()`, and `@TingQrSvg()` for controllers (Express, Fastify). |

## .NET

<!-- status:nuget -->
**Status: not released yet.** The four NuGet packages below are complete and have tests in this repository; they are not
on NuGet yet. The tests of `TingQR.AspNetCore` and `TingQR.BankLogos` have run only locally so far, not yet on GitHub CI
(see Tests below). Their version number is separate from the npm packages; the four share one version.

| Package | For |
|---|---|
| [`TingQR.Core`](dotnet/src/TingQR.Core) | C# port of `@tingqr/core`: build and read VietQR, PromptPay, KHQR; read VNPAY-QR; `TingQrDetector.Detect`; banks and banking-app links. `net10.0` and `netstandard2.0`, no dependencies. |
| [`TingQR.Rendering`](dotnet/src/TingQR.Rendering) | C# port of `@tingqr/render`: module matrix and SVG, same output as the TypeScript version on the shared vectors. No PNG. `net10.0` and `netstandard2.0`. |
| [`TingQR.BankLogos`](dotnet/src/TingQR.BankLogos) | The same bank logos and app icons as `@tingqr/bank-logos`, embedded, looked up by BIN or app id. Images are trademarks, not MIT. |
| [`TingQR.AspNetCore`](dotnet/src/TingQR.AspNetCore) | `AddTingQr` (receiving account checked at startup), `TingQrService.PaymentQr`, and SVG from Minimal API (`WithTingQrSvg`, `TingQrHttpResults.Svg`) or MVC (`[TingQrSvg]`). `net10.0`. |

```csharp
string payload = VietQr.Encode(new VietQrInput { BankBin = "970422", AccountNumber = "0123456789", Amount = 50000L });
string svg = TingQrRender.ToSvg(payload);
```

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
- Reading returns a result object: `{ ok: true, value, warnings }` or `{ ok: false, error }`. By default readers accept
  codes missing tags the standard requires but real codes often omit (VNPAY codes usually lack tags 52 and 60), with a
  warning; `{ mode: 'strict' }` refuses them. A lowercase CRC and surrounding whitespace are accepted in both modes,
  always with a warning.

## Why you can trust it

- **Sample codes with a source.** Behaviour is pinned by vectors in [`conformance/vectors/`](conformance/vectors), and
  each vector names its source: the output of independent libraries (two that agree where possible; some schemes have
  only one), a sample published with such a library, tingqr's own written rules for invalid input, or a mutation of one
  of these. No vector comes from a captured real-world code yet. The .NET packages run the same vectors (except a few
that check JavaScript types).
- **Real-app scans** are recorded only by the person who scanned ([`conformance/scans.md`](conformance/scans.md)). This
  README claims an app only when that table has a row for it.
- **Tests:** unit tests and conformance vectors on Ubuntu and Windows, Node 20, 22 and 24. Mutation testing (90%
  threshold) for `core` and `render`, except the ported QR encoder and the generated bank data. Each package has a size budget and checks of its dependencies.
  .NET: the CI workflow is set up to run the tests on Ubuntu and Windows (`net10.0`, plus `net481` on Windows for the
  `netstandard2.0` builds), and mutation testing (Stryker.NET, 90% threshold) is set up for all four packages, with the
  same two exceptions; a release drill installs the packed `.nupkg` files into apps outside the repository and uses
  them. What has run so far: CI tests and mutation testing of `TingQR.Core` and `TingQR.Rendering` on GitHub; for
  `TingQR.AspNetCore` and `TingQR.BankLogos`, tests and mutation testing only locally on Windows (no GitHub CI run
  yet); the release drill only locally on Windows.
- **Safe by design:** the server integrations do not build QR codes from URL parameters themselves: your `resolve`
  callback or controller chooses the payload, and their READMEs explain why it must not come from the URL (otherwise
  anyone could show a QR for any account on your domain). The VietQR builder writes only the tags banking apps expect and has no
  option to add others, which apps may reject.

## Licence

MIT, see [`LICENSE`](LICENSE). Exceptions and credits:
- the bank logos and app icons in `@tingqr/bank-logos` and `TingQR.BankLogos` are trademarks of their owners, not
  MIT; see [`LOGOS-NOTICE.md`](ts/packages/bank-logos/LOGOS-NOTICE.md) (npm) and
  [`LOGOS-NOTICE.md`](dotnet/src/TingQR.BankLogos/LOGOS-NOTICE.md) (.NET);
- the QR encoder in `@tingqr/render` and `TingQR.Rendering` is ported from Project Nayuki's QR Code generator (MIT);
- inspired by [`vietqr/vietqr-node`](https://github.com/vietqr/vietqr-node) (MIT, Casso).

Tiếng Việt: [README.vi.md](README.vi.md).
