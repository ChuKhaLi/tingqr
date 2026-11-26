# @tingqr/core

Build and read payment QR payloads: VietQR, VNPAY-QR (read), PromptPay (Thailand), KHQR (Cambodia). Detect any
payload. Vietnamese banks and banking-app links. No dependencies; runs in browsers, Node and Workers.

> **tingqr does not confirm payments or receive webhooks.** It only builds, reads and draws QR codes.
>
> **0.1.0, the first release.** See the [repository README](https://github.com/ChuKhaLi/tingqr#readme) for status and for which
> codes have been scanned with real banking apps (VietQR to an account: MB Bank, MyVIB; VietQR to a card: MB Bank read it, MyVIB did not;
> VNPAY, PromptPay, KHQR: not yet).

## VietQR

```ts
import { encodeVietQr, decodeVietQr } from '@tingqr/core'

const payload = encodeVietQr({ bankBin: '970422', accountNumber: '0123456789', amount: 50000, purpose: 'TINGQR TEST' })

const r = decodeVietQr(payload)
if (r.ok) r.value // { bankBin: '970422', accountNumber: '0123456789', amount: '50000', purpose: 'TINGQR TEST', … }
```

- `service: 'card'` builds a code to a card number (`QRIBFTTC`). Without `amount` the code is static.
- A transfer note must be printable ASCII (tingqr's own rule, not a recorded app behaviour).
  `removeVietnameseAccents(text)` is there if you want to strip them yourself; tingqr never changes your text silently.
- The builder writes only the tags banking apps expect.

## Other schemes

```ts
import { encodePromptPayQr, encodeKhqr, decodePromptPayQr, decodeKhqr, decodeVnpayQr, isKhqrExpired } from '@tingqr/core'

encodePromptPayQr({ target: { mobile: '0812223333' }, amount: 30 })
const now = Date.now()
encodeKhqr({
  accountType: 'individual', bakongAccountId: 'name@bank', merchantName: 'NAME',
  currency: 'KHR', amount: 1000, createdAt: now, expiresAt: now + 15 * 60_000, // a code with an amount must expire
})
```

- PromptPay targets: `{ mobile }`, `{ nationalId }` or `{ eWallet }`.
- KHQR: individual or merchant accounts, KHR or USD. `createdAt` is required (the output never depends on the clock),
  `expiresAt` too when there is an amount; `isKhqrExpired(data, Date.now())` reads the expiry of a decoded code.
- VNPAY-QR is read only.

Each scheme also has its own entry point (`@tingqr/core/vietqr`, `/vnpay`, `/promptpay`, `/khqr`) so a bundler can
leave the others out.

## Detect any payload

```ts
import { detect } from '@tingqr/core'

const r = detect(scannedText)
if (r.ok) {
  switch (r.value.scheme) {
    case 'vietqr': r.value.data.accountNumber; break
    case 'vnpay': case 'promptpay': case 'khqr': break
  }
} else if (r.error.code === 'UNKNOWN_SCHEME') {
  r.error.fields // the top-level TLV fields, to handle it yourself
}
```

## Errors and warnings

- **Builders throw** `TingQrError` with a `code` from the shared table
  ([`conformance/errors.json`](https://github.com/ChuKhaLi/tingqr/blob/main/conformance/errors.json)): `INVALID_VALUE`,
  `NON_ASCII`, `FIELD_TOO_LONG`…
- **Readers return** `{ ok: true, value, warnings }` or `{ ok: false, error }`, never throw on bad input.
- **By default readers accept codes missing tags the standard requires but real codes often omit** (VNPAY codes
  usually lack tags 52 and 60), each listed in `warnings`. `{ mode: 'strict' }` refuses them.
- A lowercase CRC and surrounding whitespace are accepted in **both** modes, always with a warning.
- A wrong CRC is always an error.

## Banks and banking apps: `@tingqr/core/banks`

```ts
import { findBank, appsForBank, bankAppLink } from '@tingqr/core/banks'

findBank('970422')?.shortName // 'MBBank'; also by code: findBank('mb')
appsForBank('970416') // ACB's apps
bankAppLink('mb', 'android', { fallbackUrl: 'https://example.com/pay' }) // an intent:// link for the MB Bank app
```

- The bank list comes from vietqr.io's public list, with its date in the repository's `conformance/banks/`. App links
  come from several sources; each app says whether two independent sources agree (`confidence`).
- **A link only opens the app.** It does not prefill an amount or a note: every known prefill goes through a third-party
  server or an undocumented format.
- **Few app links have been opened on a real phone:** only MyVIB, on Android, with exactly the link `bankAppLink`
  builds. MB Bank's app was opened through vietqr.io's redirect, which confirms its scheme and package, not the link.
- Not in the root entry point, so apps that only build QR codes do not carry the list.

## Licence

MIT. Inspired by [`vietqr/vietqr-node`](https://github.com/vietqr/vietqr-node) (MIT, Casso).
