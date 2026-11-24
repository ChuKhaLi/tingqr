# @tingqr/bank-logos

Vietnamese bank logos (by BIN) and banking-app icons (by the app `id` of `@tingqr/core/banks`), offline, one module per
image.

> **The images are not MIT.** They are trademarks of each bank; VietQR and NAPAS247 belong to NAPAS. Use them only to
> identify the receiving bank or the app to open. Source and licence of every file:
> [`LOGOS-NOTICE.md`](./LOGOS-NOTICE.md). The package's code is MIT.
>
> **Not released yet.** See the [repository README](https://github.com/ChuKhaLi/tingqr#readme) for status.

## What is in it

- `@tingqr/bank-logos/logo/<bin>`: a horizontal logo, for example `logo/970418` (BIDV).
  - SVG from Wikimedia Commons, when a file there is tagged public domain (PD-textlogo or PD-simple).
  - Otherwise vietqr.io's image, scaled to 128 px high, lossless WebP.
- `@tingqr/bank-logos/icon/<id>`: the app's square icon, for example `icon/mb`, from vietqr.io, unchanged.
- `@tingqr/bank-logos`: only the two lists `LOGO_BINS` and `ICON_IDS`, no image.
- `@tingqr/bank-logos/files/...`: the image files themselves, if you serve them as static files.

## Use

```ts
import mb from '@tingqr/bank-logos/icon/mb' // "data:image/webp;base64,..."
import bidv from '@tingqr/bank-logos/logo/970418'
```

The .NET package `TingQR.BankLogos` has the same images behind lookup functions (`BankLogos.Icon("mb")`) instead of
one import per image.

**Tree-shaking:** a bundle carries only the images you import. The package's tests check this with esbuild: one icon
import gives exactly one image, and the package root gives none.

To pick an image from the user's choice, use a dynamic `import()`. Bundlers that support pattern imports (Vite,
webpack) usually split every matching image into its own chunk and load only the one used. tingqr has no test for this:
check your bundler before you rely on it.

```ts
import { ICON_IDS } from '@tingqr/bank-logos'

async function iconOf(id: string): Promise<string | undefined> {
  if (!ICON_IDS.includes(id)) return undefined
  return (await import(`@tingqr/bank-logos/icon/${id}`)).default
}
```

**Icon in the middle of a QR** (with `@tingqr/render`):

```ts
import { toSvg } from '@tingqr/render'
import mb from '@tingqr/bank-logos/icon/mb'

const svg = toSvg(payload, { logo: { href: mb } })
```

> **Provisional.** Codes with a *test* logo in the middle were read by MB Bank and MyVIB (`conformance/scans.md`); a
> code with a real bank icon from this package has not been scanned yet. `@tingqr/render`'s logo size limits are
> provisional too. Check `conformance/scans.md` before printing a sign with a logo.

**CommonJS** (`require`) returns the **absolute path to the image file**, not a data URI, so the package does not carry
every image twice in base64. If you need a data URI, read the file:

```js
const path = require('@tingqr/bank-logos/icon/mb')
const uri = 'data:image/webp;base64,' + require('node:fs').readFileSync(path).toString('base64')
```

Every SVG passed a safety check: no script, event handler, animation or outside link. Still embed logos through
`<img>` or `<image>`, not straight into HTML.
