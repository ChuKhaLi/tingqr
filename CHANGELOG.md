# Changelog

All six npm packages share one version. Nothing has been published yet; see `docs/RELEASING.md`. Whether the .NET
packages (Plan 8) share that version or have their own is decided in Plan 8.

## Unreleased

Planned as 0.1.0, after MoMo and ZaloPay recognition and scans with more banking apps.

### @tingqr/core

- Build and read VietQR (to an account or a card, static or with an amount), read VNPAY-QR, build and read PromptPay
  and KHQR; `detect()` for any payload.
- By default readers accept codes missing tags real codes often omit (each reported in `warnings`); `{ mode: 'strict' }`
  refuses them. Lowercase CRC and surrounding whitespace are accepted in both modes, with a warning.
- Shared error and warning codes (`conformance/errors.json`). Encoders called without an input object throw
  `INVALID_VALUE`, never a `TypeError`; a code without tag 01 is `MISSING_TAG` on `01`.
- KHQR: the tag 64 language code must be 2 letters (ISO 639-1).
- `@tingqr/core/banks`: Vietnamese banks (`findBank`), banking apps (`findBankApp`, `appsForBank`) and links that open
  them (`bankAppLink`).

### @tingqr/render

- `toMatrix`, `toSvg` (browser, Node, Workers, SSR), with an optional centre logo (provisional limits).
- `@tingqr/render/canvas` (browser, ESM only): `drawQr`, `toPng`, `toPngBlob`, `toPngDataUrl`. An SVG logo that
  reports no size (0×0) fills the logo box instead of failing; Chrome 157 reports a size for such SVGs and draws them
  correctly, an engine reporting 0×0 has not been tried.
- `checkSvgOptions(options)`: check render options without rendering (used by the HTTP integrations at startup).
- QR encoder ported from Project Nayuki's QR Code generator v1.8.0 (MIT).

### @tingqr/bank-logos

- Vietnamese bank logos and banking-app icons, one module per image (images are trademarks, not MIT).

### @tingqr/angular

- `<tingqr-code>` (modes `auto`, `svg`, `img`; outputs `error`, `png`) and the `tingqrSvg` pipe. Angular 20+, zoneless,
  SSR. The code's accessible name defaults to `'Payment QR code'` (`label` overrides it).

### @tingqr/hono

- `tingqrSvg(c, payload)` and the `tingqr({ resolve })` route: SVG with the shared HTTP contract
  (`conformance/http/svg-response.json`). A `TingQrError` is a `500` with only `{ error: { code } }`; the message is
  logged with `console.error`, never sent. Bad render options fail when the route is created.

### @tingqr/nestjs

- `TingQrModule.forRoot` / `forRootAsync` (receiving account, checked at startup), `TingQrService.paymentQr`,
  `@TingQrSvg()` for HTTP controllers. Tested on NestJS 12.6 with Express and Fastify.
- `@TingQrSvg()` answers `200` for every method (also `POST`), checks its options when applied, and turns a
  `TingQrError` into a `500` with only `{ error: { code } }`; the message goes to Nest's `Logger`.
- `forRootAsync` accepts the same `inject` entries as a Nest factory provider (`{ token, optional: true }` too).

### Release workflow

- Only a tag that points to a commit on `main` publishes, and two releases never run at once (GitHub keeps one waiting
  run per group, so push one tag at a time). Not yet run on GitHub.
