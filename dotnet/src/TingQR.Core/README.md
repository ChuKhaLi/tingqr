# TingQR.Core

C# port of `@tingqr/core`: build and read payment QR payloads (VietQR, VNPAY-QR, PromptPay, KHQR) and look up Vietnamese
banks and banking apps. It does not draw QR images, confirm payments or receive webhooks.

**Status: not released.** Version `0.0.0`, not on NuGet. Targets `net10.0` and `netstandard2.0`. Tests run on `net10.0`
(Ubuntu and Windows) and `net481` (Windows) in `ci-dotnet`; first green run on PR #10, 2026-11-23, together with
`mutation-dotnet`. Drawing QR images is in `TingQR.Rendering`, bank logos in `TingQR.BankLogos`, the ASP.NET Core
integration in `TingQR.AspNetCore`. The four packages share one version, separate from the npm packages.

Once released, install it from NuGet:

```sh
dotnet add package TingQR.Core
```

## Usage

```csharp
using System;
using TingQR;
using TingQR.Emv; // ParseMode

string payload = VietQr.Encode(new VietQrInput
{
    BankBin = "970422",           // MB
    AccountNumber = "0123456789",
    Amount = 50000L,              // whole VND; leave out for a static QR
    Purpose = "Thanh toan don 123",
});

TingQrResult<VietQrData> result = VietQr.Decode(payload);          // lenient by default; never throws on bad data
TingQrResult<VietQrData> strict = VietQr.Decode(payload, ParseMode.Strict);
if (result.Ok) Console.WriteLine(result.Value!.AccountNumber);
else Console.WriteLine(result.Error!.Code.ToWireName());           // e.g. "CRC_MISMATCH"

TingQrResult<DetectResult> any = TingQrDetector.Detect(payload);   // which scheme is it?
Console.WriteLine(any.Value!.Scheme);                               // VietQr

Bank? bank = Banks.Find("970422");                                   // or "MB", "mbbank"
string link = BankApps.Link("mb", AppPlatform.Android, "https://example.com/pay");
```

(Compiled and run on `net10.0` and `net481` in a console project outside the repo, 2026-11-24.)

Readers return a result carrying `Warnings` and an error instead of throwing; builders and bank lookups throw
`TingQrException` with the shared codes from `conformance/errors.json`. Readers default to lenient mode, like the
TypeScript version.

## TypeScript to .NET

| TypeScript (`@tingqr/core`)                          | .NET                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `VERSION`                                            | `TingQrVersion.Value`                                             |
| `TingQrError` (`code`, `tag`, `fields`)              | `TingQrException` (`Code`, `Tag`, `Fields`)                       |
| `ERROR_CODES` / `WARNING_CODES` (and their types)    | `TingQrErrorCode` / `TingQrWarningCode` enums; `ToWireName()` gives the shared string |
| `Result<T>` (`ok`, `value`, `warnings`, `error`)     | `TingQrResult<T>` (`Ok`, `Value`, `Warnings`, `Error`)            |
| `Warning` (`code`, `message`, `tag`)                 | `TingQrWarning` (`Code`, `Message`, `Tag`)                        |
| `encodeVietQr` / `decodeVietQr`                      | `VietQr.Encode` / `VietQr.Decode`                                 |
| `VIETQR_GUID`                                        | `VietQr.Aid`                                                     |
| `decodeVnpayQr`                                      | `VnpayQr.Decode`                                                  |
| `VNPAY_GUID`                                         | `VnpayQr.Aid`                                                    |
| `encodePromptPayQr` / `decodePromptPayQr`            | `PromptPayQr.Encode` / `PromptPayQr.Decode`                       |
| `PROMPTPAY_AID`                                      | `PromptPayQr.Aid` (`CreditTransfer`, `Ota`, `BillPayment`, `BillPaymentCrossBorder`) |
| `encodeKhqr` / `decodeKhqr`                          | `Khqr.Encode` / `Khqr.Decode`                                     |
| `isKhqrExpired`                                      | `Khqr.IsExpired`                                                  |
| `detect`                                             | `TingQrDetector.Detect`                                           |
| `Detected` / `DetectResult` (`scheme`, `data`, `alsoMatches`) | `DetectResult` (`Scheme`, `object Data`, `AlsoMatches`); cast `Data` by `Scheme` |
| `removeVietnameseAccents`                            | `VietnameseText.RemoveAccents`                                    |
| `{ mode: 'strict' }`                                 | `ParseMode.Strict` (`TingQR.Emv`)                                 |
| `parsePayload` / `buildPayload` / `getField`         | `EmvPayload.Parse` / `EmvPayload.Build` / `EmvPayload.GetField` (instance method, `TingQR.Emv`) |
| `EmvPayload`                                         | `EmvPayload` (`Fields`, `Crc`, `Raw`) (`TingQR.Emv`)              |
| `field` / `encodeFields` / `parseTlv` / `parseTemplate` | `Tlv.Field` / `Tlv.EncodeFields` / `Tlv.Parse` / `Tlv.ParseTemplate` (`TingQR.Emv`) |
| `TlvField` / `TlvNode`                               | `TlvField` / `TlvNode` (`TingQR.Emv`)                             |
| `crc16`                                              | `Crc16.Compute` (`TingQR.Emv`)                                    |
| `BANKS` / `findBank`                                 | `Banks.All` / `Banks.Find`                                        |
| `BANK_APPS` / `findBankApp` / `appsForBank`          | `BankApps.All` / `BankApps.Find` / `BankApps.ForBank`             |
| `bankAppLink`                                        | `BankApps.Link`                                                   |

Everything is in the `TingQR` namespace except the EMV layer and `ParseMode`, which are in `TingQR.Emv`.

## Known limits

- **C# version for building inputs.** Input types (`VietQrInput`, `PromptPayInput`, `KhqrInput`...) use `init`
  setters and `required` members, so building one needs C# 9 or later. A .NET Framework project on its default C# 7.3
  can read QR codes and look up banks with the `netstandard2.0` build, but `new VietQrInput { ... }` fails with CS8370;
  set `<LangVersion>latest</LangVersion>` in the project (checked on `net481`, 2026-11-23).
- **No value equality on data with dictionaries.** `VietQrData`, `PromptPayData`, `KhqrData` and `VnpayQrData` are
  records, but their dictionary members (`AdditionalData`, `ExtraFields`, ...) compare by reference, so two equal decodes are not
  `==`. Compare the fields you need.
- **Read-only results.** Lists and dictionaries the library returns (`Warnings`, `EmvPayload.Fields`, `TlvNode.Children`,
  `TingQrException.Fields`, `AlsoMatches`, the dictionaries of decoded data, `Banks.All`...) are read-only wrappers:
  casting one to `IList<T>` or `IDictionary<,>` and changing it throws `NotSupportedException`.
- **`BankApps.Link` and `fallbackUrl`.** .NET has no WHATWG URL parser, so a small checker produces the normalised
  URL. It rejects (`INVALID_VALUE`) URLs WHATWG would accept and rewrite: user info, IPv6, non-canonical IPv4, `%` or
  `\` in the host, `\` or `.`/`..` segments in the path (also percent-encoded, `%2e`, `.%2e`), a last host label
  starting with `0x`, and IPv4 with a trailing dot. A lone surrogate in the path becomes U+FFFD; in the host it is
  `INVALID_VALUE`. A null `fallbackUrl` means no fallback (TypeScript throws for an explicit `null`).
- **Unicode host names.** They go through `IdnMapping`, which uses ICU on .NET 5 and later (Linux and Windows) and the
  Windows (NLS) tables on .NET Framework; ICU versions differ between machines. So a Unicode host outside the vectors
  may give a different result from TypeScript and between platforms: `https://ẞ.vn/` gives `xn--zca.vn` on .NET 10
  (Windows) and `ss.vn` on .NET Framework 4.8.1 and in Node 22.
- **Type-check vectors.** Four vectors pass a JSON value of the wrong type, which C# cannot express:
  `vietqr-encode-bin-not-string`, `vietqr-encode-purpose-not-string`, `number-query` (bank-lookup) and
  `promptpay-encode-two-targets`. The runner checks that the value does not convert to the declared type (see
  `conformance/README.md`).
- Both implementations are guaranteed to agree only on the shared vectors in `conformance/vectors/`.
