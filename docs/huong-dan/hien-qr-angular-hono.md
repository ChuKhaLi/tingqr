# Hiện QR trong Angular, trả ảnh QR từ Hono, PNG ở trình duyệt

Hướng dẫn cho dev dùng `@tingqr/angular`, `@tingqr/hono` và `@tingqr/render/canvas`. Thiết kế:
`docs/superpowers/specs/2026-11-21-tingqr-angular-hono-design.md`.

tingqr **không** xác nhận đã nhận tiền và không nhận webhook. Thư viện chỉ tạo, đọc và vẽ QR.

## Vì sao cần PNG

Trình duyệt trong Zalo, Messenger, Facebook thường không cho lưu ảnh SVG. Người trả tiền cần nhấn giữ để lưu QR thành
ảnh thường, rồi mở bằng app ngân hàng. Ảnh PNG trong thẻ `<img>` thì thường nhấn giữ được, nên tingqr vẽ PNG.

**Chưa thử:** tingqr chưa tự thử nhấn giữ lưu ảnh trong Zalo hay Messenger. Kết quả thử sẽ ghi ở `conformance/scans.md`.

## Angular: `<tingqr-code>`

```ts
import { encodeVietQr } from '@tingqr/core'
import { TingQrCode } from '@tingqr/angular'

@Component({
  imports: [TingQrCode],
  template: `<tingqr-code [payload]="payload" label="QR 50.000 đ, đơn A1" (png)="onPng($event)" (error)="onError($event)" />`,
})
export class Pay {
  payload = encodeVietQr({ bankBin: '970422', accountNumber: '0123456789', amount: 50000, purpose: 'A1' })
}
```

- **Chỉ nhận chuỗi QR** (`payload`), loại nào cũng được. Chuỗi tạo bằng `@tingqr/core`; lỗi tạo chuỗi báo ở đó.
- **Ba chế độ** (`mode`):
  - `'auto'` (mặc định): khi render ở máy chủ thì in SVG, trang hiện QR ngay; khi chạy ở trình duyệt thì đổi sang
    `<img>` PNG;
  - `'svg'`: luôn SVG;
  - `'img'`: chỉ PNG, ở máy chủ không in gì.
- **Không hiện ảnh cho đầu vào sai, không giữ ảnh của chuỗi cũ** (chuỗi hợp lệ nhưng sai ý thì component vẫn vẽ;
  dựng đúng chuỗi là việc của code gọi `@tingqr/core`):
  - chuỗi hay tuỳ chọn sai thì không vẽ gì, phát `error`;
  - chuỗi rỗng thì không vẽ gì, không phát lỗi;
  - đổi `payload` thì ảnh cũ biến mất ngay; PNG của chuỗi cũ vẽ xong muộn thì bị bỏ.
- `png` phát `Blob` của ảnh đang hiện, để bật nút "Lưu" hay chia sẻ.
- Không làm được PNG (ví dụ `CANVAS_TAINTED`) thì phát `error`. Ở `'auto'` thì vẫn giữ SVG, vì SVG vẫn đúng, chỉ không lưu
  được.
- Pipe `tingqrSvg`: `<div [innerHTML]="payload | tingqrSvg"></div>`. Sai thì ra rỗng; ở dev mode lỗi in ra console.

## Trình duyệt, framework nào cũng được: `@tingqr/render/canvas`

```ts
import { drawQr, toPng, toPngDataUrl } from '@tingqr/render/canvas'

img.src = await toPngDataUrl(payload) // 8 px mỗi ô
const { blob, dataUrl } = await toPng(payload, { scale: 10 }) // vẽ một lần, lấy cả hai
await drawQr(canvas, payload) // vẽ lên canvas của mình rồi vẽ thêm số tiền, mã đơn
```

- **Chỉ chạy ở trình duyệt và chỉ có bản ESM.** Ở máy chủ dùng `toSvg`.
- Cùng tuỳ chọn và cùng cách kiểm như `toSvg`; thay `size` bằng `scale` (số nguyên 1–64, số px mỗi ô).
- **Logo:**
  - nên dùng data URI, ví dụ từ `@tingqr/bank-logos`;
  - logo ở tên miền khác mà máy chủ không gửi header CORS thì không nạp được, báo `LOGO_LOAD_FAILED`;
  - ảnh khác nguồn làm canvas bị khoá (ví dụ logo bị chuyển hướng sang tên miền khác) thì báo `CANVAS_TAINTED`;
  - logo nạp hỏng thì báo `LOGO_LOAD_FAILED`, không âm thầm xuất QR không logo.
- Không có canvas (ví dụ gọi ở máy chủ) thì báo `NO_CANVAS`.

## Hono: trả ảnh QR từ route của mình

```ts
import { tingqr } from '@tingqr/hono'

app.get(
  '/orders/:id/qr.svg',
  tingqr({
    resolve: async (c) => {
      const order = await findPendingOrder(c.req.param('id'))
      return order ? encodeVietQr({ bankBin: BIN, accountNumber: ACCOUNT, amount: order.amount, purpose: order.code }) : null
    },
  }),
)
```

- `resolve` trả chuỗi thì trả về 200 SVG; trả `null`, `undefined` hay `''` thì 404.
- `TingQrError` (kể cả do `resolve` ném) thì 400 JSON `{ error: { code, message } }`. Lỗi khác đi tới `app.onError`.
- Header:
  - `Content-Type: image/svg+xml`;
  - `X-Content-Type-Options: nosniff`;
  - CSP chặn script;
  - `Cache-Control: private, max-age=300`, đổi được bằng `cacheControl`. Đặt `private` vì QR mang số tài khoản và số
    tiền, CDN dùng chung không được giữ.
- Trong handler tự viết thì dùng `tingqrSvg(c, payload, options)`.

### Vì sao không có route `?acc=&bank=`

Route dựng QR theo tham số URL cho bất kỳ ai tạo QR trỏ vào tài khoản và số tiền tuỳ ý, ngay trên tên miền của bạn. Kẻ
lừa đảo dùng đúng cách này để làm yêu cầu chuyển tiền giả trông đáng tin. Vì vậy route luôn hỏi code của bạn (`resolve`)
nên đặt gì vào QR.

**Ảnh SVG từ route có thể không nhấn giữ lưu được** trong app chat. Phía trình duyệt nên dùng PNG (`<tingqr-code>` hay
`@tingqr/render/canvas`), còn route dùng làm phương án dự phòng.
