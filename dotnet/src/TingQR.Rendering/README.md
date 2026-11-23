# TingQR.Rendering

C# port of `@tingqr/render`: turn any text (usually a payment QR payload from `TingQR.Core`) into a QR module matrix or
an SVG string. It does not confirm payments, receive webhooks or produce PNG files.

**Status: not released.** Version `0.0.0`, not on NuGet. Targets `net10.0` and `netstandard2.0` (so it also runs on
.NET Framework 4.6.1+; tested on `net481`). It depends on `TingQR.Core` and has no other dependency.

## Usage

```csharp
using System;
using TingQR;
using TingQR.Rendering;

string payload = VietQr.Encode(new VietQrInput
{
    BankBin = "970422",           // MB
    AccountNumber = "0123456789",
    Amount = 50000L,
    Purpose = "Thanh toan don 123",
});

string svg = TingQrRender.ToSvg(payload, new SvgOptions
{
    Size = "40mm",                // or a number of px; leave out to let the SVG scale to its box
    Ecc = Ecc.Q,
});

QrMatrix matrix = TingQrRender.ToMatrix(payload);   // matrix.Size, matrix.Version, matrix.IsDark(x, y)
Console.WriteLine($"{matrix.Size} modules, version {matrix.Version}");

TingQrRender.CheckSvgOptions(new SvgOptions { Size = 200 });   // throws before any text is known
```

(Compiled and run on `net10.0` and `net481` in a console project outside the repo, 2026-11-23.)

Every function throws `TingQrException` with code `INVALID_VALUE` (shared with the TypeScript version) for a null text,
a bad option, a lone surrogate in the text or text that does not fit. `SvgOptions` inherits `MatrixOptions`, so one
options object works for both functions. `SvgSize` converts implicitly from a number (px) or a string (`"40mm"`,
`"100%"`); `Size = null` means no width/height, but `Size = (string?)null` is a size that is a null string, and is
rejected.

## TypeScript to .NET

| TypeScript (`@tingqr/render`)                       | .NET                                                       |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `toMatrix(text, options)`                           | `TingQrRender.ToMatrix(text, MatrixOptions?)`              |
| `toSvg(text, options)`                              | `TingQrRender.ToSvg(text, SvgOptions?)`                    |
| `checkSvgOptions(options)`                          | `TingQrRender.CheckSvgOptions(SvgOptions?)`                |
| `QrMatrix` (`size`, `version`, `ecc`, `mask`, `modules`) | `QrMatrix` (`Size`, `Version`, `Ecc`, `Mask`, `Modules`, `IsDark(x, y)`) |
| `Ecc` (`'L' \| 'M' \| 'Q' \| 'H'`)                  | `Ecc` enum (`L`, `M`, `Q`, `H`)                            |
| `MatrixOptions` (`ecc`, `boostEcc`, `minVersion`, `maxVersion`, `mask`) | `MatrixOptions` (same, PascalCase; null = default) |
| `SvgOptions` (adds `margin`, `foreground`, `background`, `size`, `logo`) | `SvgOptions : MatrixOptions` (same, PascalCase) |
| `size?: number \| string`                           | `SvgSize?` (implicit from `double`/`int` or `string`)      |
| `LogoOptions` (`href`, `size`, `padding`, `background`) | `LogoOptions` (`Href` required, the rest optional)     |
| `TingQrError`                                       | `TingQrException` (from `TingQR.Core`)                     |
| `toPng`, `drawQr` (`@tingqr/render/canvas`)         | not ported                                                 |

## What has been checked

- 27 matrix vectors in `conformance/vectors/render/`, generated from the original Nayuki library, and 63 SVG vectors
  (default, every option, every rejected option). The SVG vectors are the output of tingqr's own TypeScript code, so they
  prove the two implementations agree, not that the SVG is right; the matrices inside them come from the port, not from
  an independent oracle. The TypeScript and .NET tests read the same files. Tests pass on `net10.0` and `net481`
  (Windows, local, 2026-11-23); the Ubuntu run is not done yet.
- Stryker.NET, local, Windows, 2026-11-23: `TingQR.Rendering` 99.41% (3 surviving mutants, all equivalent, documented in
  `dotnet/CLAUDE.md`), `TingQR.Core` 100%. The ported encoder file is excluded from mutation. CI for the Rendering job
  has not run yet.
- During review the output was also compared with the TypeScript version on 1,500 random option combinations and
  574,640 numbers for `size`, with no difference. These were one-off checks, not tests in the repo.

## Limits

- No PNG. Draw the SVG yourself, or use `@tingqr/render/canvas` in a browser.
- On .NET Framework, creating the options needs C# 9 or later (`init` and `required` members).
- The output is only guaranteed to match the TypeScript version on the vectors above.
- The centre logo limits are provisional until more banking apps have scanned a code with a logo
  (`conformance/scans.md`).

## Credits

The QR encoder is a port of Project Nayuki's QR Code generator library (TypeScript, v1.8.0, MIT), through
`@tingqr/render`. Its licence is in `NOTICE`.
