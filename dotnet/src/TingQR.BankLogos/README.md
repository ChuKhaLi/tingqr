# TingQR.BankLogos

Vietnamese bank logos (by BIN) and banking-app icons (by app id) for payment QR codes, embedded in the assembly. No
runtime dependencies. Part of [tingqr](https://github.com/ChuKhaLi/tingqr). This library does **not** confirm payments
or receive webhooks.

**Not released yet.**

## License: the images are not MIT

The code is MIT. The images are trademarks of their banks or companies and carry no open license. They are only there
so a person can recognise the receiving bank or the app to open. See `LOGOS-NOTICE.md` in the package for the source
and status of every file. Owners who want an image changed or removed: open an issue.

## Use

```csharp
using TingQR;
using TingQR.Rendering;

// A bank app icon as the centre logo of a QR code
var svg = TingQrRender.ToSvg(payload, new SvgOptions
{
    Logo = new LogoOptions { Href = BankLogos.Icon("mb")! },
});

string? logo = BankLogos.Logo("970422");        // data URI by BIN, or null
using BankLogoFile? file = BankLogos.OpenIcon("mb"); // stream + ContentType + FileName
```

> **Provisional.** Codes with a *test* logo in the middle were read by MB Bank and MyVIB (`conformance/scans.md`); a
> code with a real bank icon from this package has not been scanned yet. `TingQR.Rendering`'s logo size limits are
> provisional too. Check `conformance/scans.md` before printing a sign with a logo.

Keys are matched exactly (ordinal, no trimming, case-sensitive): `"MB"` is not `"mb"`. A `null` argument throws
`ArgumentNullException`; an unknown key returns `null`. `BankLogos.LogoBins` and `BankLogos.IconIds` list the keys.

This package looks images up with functions (`BankLogos.Icon("mb")`); the npm package `@tingqr/bank-logos` imports
one module per image instead (`import mb from '@tingqr/bank-logos/icon/mb'`), so bundlers can tree-shake.
