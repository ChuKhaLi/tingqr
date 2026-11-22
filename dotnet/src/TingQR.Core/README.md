# TingQR.Core

C# port of `@tingqr/core`: build and read payment QR payloads (VietQR, VNPAY-QR, PromptPay, KHQR) and look up Vietnamese
banks and banking apps. It does not draw QR images, confirm payments or receive webhooks.

**Status: not released.** Version `0.0.0`, not on NuGet. Targets `net10.0` and `netstandard2.0`; tests also run on
`net481` on Windows. Plan 8a covers this package only; ASP.NET Core and rendering come later.

## Usage

```csharp
using TingQR;

string payload = VietQr.Encode(new VietQrInput { /* bank BIN, account, amount ... */ });

TingQrResult<VietQrData> result = VietQr.Decode(payload);          // never throws on bad data
TingQrResult<VietQrData> strict = VietQr.Decode(payload, ParseMode.Strict);

TingQrResult<DetectResult> any = TingQrDetector.Detect(payload);   // which scheme is it?

Bank? bank = Banks.Find("970422");
string link = BankApps.Link("MB", AppPlatform.Android);
```

Readers return a result carrying `warnings` and an error code instead of throwing; builders throw `TingQrException`
with the shared codes from `conformance/errors.json`. Readers default to lenient mode, like the TypeScript version.

## TypeScript to .NET

| TypeScript (`@tingqr/core`)            | .NET (`TingQR` namespace)                      |
| -------------------------------------- | ---------------------------------------------- |
| `encodeVietQr` / `decodeVietQr`        | `VietQr.Encode` / `VietQr.Decode`              |
| `decodeVnpayQr`                        | `VnpayQr.Decode`                               |
| `encodePromptPayQr` / `decodePromptPayQr` | `PromptPayQr.Encode` / `PromptPayQr.Decode` |
| `encodeKhqr` / `decodeKhqr`            | `Khqr.Encode` / `Khqr.Decode`                  |
| `isKhqrExpired`                        | `Khqr.IsExpired`                               |
| `detect`                               | `TingQrDetector.Detect`                        |
| `BANKS` / `findBank`                   | `Banks.All` / `Banks.Find`                     |
| `BANK_APPS`                            | `BankApps.All`                                 |
| `findBankApp`, `appsForBank`           | `BankApps.Find`, `BankApps.ForBank`            |
| `bankAppLink`                          | `BankApps.Link`                                |
| `removeVietnameseAccents`              | `VietnameseText.RemoveAccents`                 |
| EMV helpers                            | `TingQR.Emv.*` (`Tlv`, `Crc16`, `EmvPayloads`) |
| `{ mode: 'strict' }`                   | `ParseMode.Strict`                             |

## Known limits

- **`BankApps.Link` and `fallbackUrl`.** .NET has no WHATWG URL parser, so a small checker produces the normalised
  URL. It rejects (`INVALID_VALUE`) URLs WHATWG would accept and rewrite: user info, IPv6, non-canonical IPv4, `%` or
  `\` in the host, `\` or `.`/`..` segments in the path, a last host label starting with `0x`, and IPv4 with a trailing
  dot. A lone surrogate in the path becomes U+FFFD; in the host it is `INVALID_VALUE`. Unicode hosts outside the
  vectors may differ from TypeScript (for example `ẞ` gives `xn--zca` here and `ss` in Node) and between Linux (ICU)
  and Windows.
- **Type-check vectors.** Four vectors pass a JSON value of the wrong type, which C# cannot express:
  `vietqr-encode-bin-not-string`, `vietqr-encode-purpose-not-string`, `number-query` (bank-lookup) and
  `promptpay-encode-two-targets`. The runner checks that the value does not convert to the declared type (see
  `conformance/README.md`).
- Both implementations are guaranteed to agree only on the shared vectors in `conformance/vectors/`.
