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

Keys are matched exactly (ordinal, no trimming, case-sensitive): `"MB"` is not `"mb"`. A `null` argument throws
`ArgumentNullException`; an unknown key returns `null`. `BankLogos.LogoBins` and `BankLogos.IconIds` list the keys.
