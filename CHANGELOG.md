# Changelog

Two release lines with their own version numbers: the six npm packages share one version (tags `ts-v*`), the four
NuGet packages share another (tags `dotnet-v*`). Nothing has been published yet; see `docs/RELEASING.md`.

## Unreleased (npm)

Planned as 0.1.0, after MoMo and ZaloPay recognition and scans with more banking apps.

### @tingqr/core

- Build and read VietQR (to an account or a card, static or with an amount), read VNPAY-QR, build and read PromptPay
  and KHQR; `detect()` for any payload.
- By default readers accept codes missing tags real codes often omit (each reported in `warnings`); `{ mode: 'strict' }`
  refuses them. Lowercase CRC and surrounding whitespace are accepted in both modes, with a warning.
- Shared error and warning codes (`conformance/errors.json`). Encoders called without an input object throw
  `INVALID_VALUE`, never a `TypeError`; a code without tag 01 is `MISSING_TAG` on `01`.
- KHQR: the tag 64 language code must be 2 letters (ISO 639-1).
- The VietQR `NON_ASCII` message for an accented purpose states tingqr's rule (printable ASCII only) instead of
  claiming that banking apps reject accents; the code is unchanged.
- `@tingqr/core/banks`: Vietnamese banks (`findBank`), banking apps (`findBankApp`, `appsForBank`) and links that open
  them (`bankAppLink`).

### @tingqr/render

- `toMatrix`, `toSvg` (browser, Node, Workers, SSR), with an optional centre logo (provisional limits).
- `@tingqr/render/canvas` (browser, ESM only): `drawQr`, `toPng`, `toPngBlob`, `toPngDataUrl`. An SVG logo that
  reports no size (0×0) fills the logo box instead of failing; Chrome 157 reports a size for such SVGs and draws them
  correctly, an engine reporting 0×0 has not been tried.
- `checkSvgOptions(options)`: check render options without rendering (used by the HTTP integrations at startup).
- `null` options are the defaults in `toMatrix`, `toSvg` and `checkSvgOptions`, and `logo: null` means no logo (also on
  canvas), like .NET; a `null` in another option is still `INVALID_VALUE`. `null` options are the defaults in the
  canvas functions too.
- The canvas functions encode the text once per call (`toPng`, `toPngBlob` and `toPngDataUrl` used to encode it twice).
- A text longer than 7089 UTF-16 units (the most any QR code holds) is `INVALID_VALUE` before the encoder runs; same
  error and message as before.
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

## Unreleased (NuGet, .NET)

Not published. The repository reads `0.0.0`; the first number is chosen when the owner decides to release.

Each .NET release entry names the `conformance/` commit whose vectors it passes (for example "passes `conformance/` at
`abc1234`"), so a reader can tell which shared behaviour a version has. This is a manual step of `docs/RELEASING.md`:
no script checks it.

### TingQR.Core

- C# port of `@tingqr/core` (Plan 8a): VietQR, VNPAY-QR, PromptPay, KHQR, `TingQrDetector.Detect`, banks and bank-app
  links, checked against the same `conformance/` vectors (render vectors are run by TingQR.Rendering; the type-check
  vectors are checked as non-convertible). Targets `net10.0` and `netstandard2.0`.
- Public names reviewed before release (Plan 8c, approved by the owner): `VietQr.Aid` / `VnpayQr.Aid`,
  `EmvPayload.Parse` / `Build` and `payload.GetField(tag)`, `code.ToWireName()`, `VietQrServiceCode`,
  `QrAmount.HasAmount`, `BankApp.VietQrAutofill`. Differences from the TypeScript names are listed in
  `conformance/README.md`.
- `TingQrVersion.Value` equals the package version (`node dotnet/scripts/set-version.mjs` sets both).
- Returned lists and dictionaries are read-only (`Warnings`, `EmvPayload.Fields`, `Tlv.Parse`, `TlvNode.Children`,
  `TingQrException.Fields`, `AlsoMatches`, decoded dictionaries): casting back to `IList<T>`/`IDictionary<,>` and
  writing throws `NotSupportedException`. The constructors of `EmvPayload`, `TingQrException`, `TlvNode` and
  `TingQrResult<T>.Success` copy the list they are given.
- `VietnameseText.RemoveAccents` no longer throws on a lone surrogate (kept as is) and strips combining marks outside
  the BMP after a Latin letter, matching `removeVietnameseAccents`; `null` throws `ArgumentNullException`.
- The VietQR `NON_ASCII` message for an accented purpose states tingqr's rule (printable ASCII only) instead of
  claiming that banking apps reject accents; the code is unchanged.

### TingQR.Rendering

- C# port of `@tingqr/render` (Plan 8b): `TingQrRender.ToMatrix`, `ToSvg`, `CheckSvgOptions`, with the optional centre
  logo (provisional limits). No PNG. The SVG is byte for byte the TypeScript output on 80 golden vectors in
  `conformance/vectors/render/`; the matrices are also checked on the 19 Nayuki matrix vectors and the 8 hand-written
  option-error vectors. Targets `net10.0` and `netstandard2.0`; the encoder is ported from Project Nayuki's generator
  v1.8.0 (MIT).
- `SvgSize` has value equality (`IEquatable<SvgSize>`, `==`, `!=`): same form and same value (pixels by `==` of
  `double`, lengths ordinal).
- A text longer than 7089 UTF-16 units (the most any QR code holds) is `INVALID_VALUE` before the encoder allocates
  buffers sized by the text; same error and message as before.

### TingQR.BankLogos

- The bank logos and app icons of `conformance/banks/logos/`, embedded in the assembly: `BankLogos.Logo(bin)`,
  `Icon(appId)` (data URI or `null`), `OpenLogo`, `OpenIcon`, `LogoBins`, `IconIds` (read-only lists). Exact,
  case-sensitive keys. Images are trademarks, not MIT: the package licence is its `LOGOS-NOTICE.md`, generated from the
  same manifest as the npm notice. Targets `net10.0` and `netstandard2.0`; no dependencies.

### TingQR.AspNetCore

- `AddTingQr` (code or an `IConfiguration` section): the receiving account, app-wide `Svg` options and named profiles
  are checked when the app starts; a mistake stops it with a `TingQrException`. `TingQrService.PaymentQr`.
- Serve SVG with the shared HTTP contract (`conformance/http/svg-response.json`) from Minimal API
  (`WithTingQrSvg`, `TingQrHttpResults.Svg`) and MVC (`[TingQrSvg]`, `[TingQrSvg("profile")]`). A `TingQrException` is
  a `500` with only `{"error":{"code":"…"}}`; the message goes to `ILogger`. A served SVG is always `200`.
  `TingQrHttpResults.Svg` never throws (bad options are a `500`). Only the value an action returns is drawn; a result
  the action builds itself throws `InvalidOperationException`.
- A `CacheControl` with a control character (CR, LF, tab…) or a non-ASCII character stops the app at startup
  (`AddTingQr`, `WithTingQrSvg`, `[TingQrSvg]`), or gives a `500` from `TingQrHttpResults.Svg`.
- Targets `net10.0` only.

### Release (NuGet)

- `node dotnet/scripts/set-version.mjs`, `check-release.mjs`, the release drill (skill `release-drill-dotnet`) and
  `release-dotnet.yml`: only a tag `dotnet-vX.Y.Z` on `main` publishes, after approval in the `nuget-release`
  environment, with NuGet trusted publishing (no stored API key). The `verify` dry run passed on GitHub (PR #11, Ubuntu);
  `publish` has never run; nothing pushed to NuGet.
