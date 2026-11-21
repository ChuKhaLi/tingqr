# Changelog

All six npm packages share one version. Nothing has been published yet; see `docs/RELEASING.md`.

## Unreleased

Planned as 0.1.0, after MoMo and ZaloPay recognition and scans with more banking apps.

### @tingqr/core

- Build and read VietQR (to an account or a card, static or with an amount), read VNPAY-QR, build and read PromptPay
  and KHQR; `detect()` for any payload.
- Readers accept common real-world deviations by default and report each in `warnings`; `{ mode: 'strict' }` refuses them.
- Shared error and warning codes (`conformance/errors.json`).
- `@tingqr/core/banks`: Vietnamese banks (`findBank`), banking apps (`findBankApp`, `appsForBank`) and links that open
  them (`bankAppLink`).

### @tingqr/render

- `toMatrix`, `toSvg` (browser, Node, Workers, SSR), with an optional centre logo (provisional limits).
- `@tingqr/render/canvas` (browser, ESM only): `drawQr`, `toPng`, `toPngBlob`, `toPngDataUrl`.
- QR encoder ported from Project Nayuki's QR Code generator v1.8.0 (MIT).

### @tingqr/bank-logos

- Vietnamese bank logos and banking-app icons, one module per image (images are trademarks, not MIT).

### @tingqr/angular

- `<tingqr-code>` (modes `auto`, `svg`, `img`; outputs `error`, `png`) and the `tingqrSvg` pipe. Angular 20+, zoneless,
  SSR.

### @tingqr/hono

- `tingqrSvg(c, payload)` and the `tingqr({ resolve })` route: SVG with the shared HTTP contract
  (`conformance/http/svg-response.json`).

### @tingqr/nestjs

- `TingQrModule.forRoot` / `forRootAsync` (receiving account, checked at startup), `TingQrService.paymentQr`,
  `@TingQrSvg()` for controllers. Tested on NestJS 12.6 with Express and Fastify.
