# Thiết kế: `@tingqr/angular`, `@tingqr/hono`, `@tingqr/render/canvas` (Plan 6)

Ngày: 2026-11-21. Dựa trên spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 2, 3, 5.6, 5.11) và
thiết kế render `docs/superpowers/specs/2026-11-19-tingqr-render-design.md`.
Mục ghi **[chủ dự án]** là chủ dự án đã quyết; mục **[Claude]** là đề xuất của Claude, chủ dự án có thể sửa.

## 1. Mục đích

- Cho dev **hiện QR thanh toán trong framework họ đang dùng** mà không phải tự ghép bộ tạo QR, SVG, canvas và header
  HTTP. Đây là một phần của mục tiêu v0.1 (gói tích hợp) và của mục tiêu lớn: một thư viện mã nguồn mở có tiếng.
- **Chỗ khó thật mà gói phải giải:** trình duyệt trong Zalo, Messenger, Facebook thường không cho lưu ảnh SVG hay ảnh
  vẽ bằng DOM; người trả tiền cần **nhấn giữ để lưu QR thành ảnh thường** rồi mở bằng app ngân hàng. Noel tree đã phải tự
  làm việc này (`../noel-tree/src/app/tree/pay-panel.ts`: ma trận → canvas → PNG data URL, kèm file PNG để chia sẻ).
- **Người dùng thật đầu tiên là Noel tree** (Angular 21.2 SSR, máy chủ Hono 4 trên Cloudflare Workers):
  - phía trình duyệt: thay `src/app/shared/qr.ts` (`qrcode-generator`) và phần vẽ PNG trong `pay-panel.ts`;
  - phía máy chủ: thay `qrUrl()` ở `src/api/orders.ts`, hiện trỏ tới `https://vietqr.app/img?...` (dịch vụ ngoài vẽ
    hộ ảnh QR dự phòng), bằng một route trong chính Worker, không gọi mạng ra ngoài.

## 2. Phạm vi

### Chia plan **[chủ dự án, 2026-11-21]**

- **Plan 6 (thiết kế này):** `@tingqr/render/canvas`, `@tingqr/angular`, `@tingqr/hono`, thử trong Noel tree.
- **Plan 6b:** `@tingqr/nestjs`. Vẫn thuộc v0.1. Kiểm bằng một app mẫu nhỏ trong repo, vì chưa có người dùng thật.
  Thiết kế riêng, không nằm ở đây.
- `@tingqr/hono` là **gói mới, ngoài spec chung** (chủ dự án thêm 2026-11-21): Noel tree dùng Hono chứ không dùng NestJS.

### Có trong Plan 6

- `@tingqr/render/canvas`: vẽ QR lên canvas, xuất PNG (`Blob`, data URL). Chỉ chạy ở trình duyệt.
- `@tingqr/angular`: component `<tingqr-code>`, pipe `tingqrSvg`.
- `@tingqr/hono`: hàm trả SVG và route dựng sẵn bắt buộc có `resolve`.
- Thử cả ba trong một **nhánh thử** của Noel tree.

### Không làm

- **Route mở theo tham số URL** kiểu `vietqr.app/img?acc=…&bank=…` **[chủ dự án]**: cho bất kỳ ai tạo QR trỏ vào tài
  khoản tuỳ ý trên tên miền của dev, kẻ lừa đảo sẽ lợi dụng. Không làm, kể cả dưới dạng tuỳ chọn.
- **Component nhận dữ liệu VietQR** (`[bank] [account] [amount]`) **[Claude]**: component chỉ nhận chuỗi QR. Lý do: dùng
  được cho mọi loại QR, lỗi tạo chuỗi báo ở `@tingqr/core` như mọi chỗ khác, không lặp lại API của core trong Angular.
- **Tấm chọn app ngân hàng** (phương án C): bỏ, vì giao diện riêng của mỗi sản phẩm. Dev dùng `bankAppLink` và
  `@tingqr/bank-logos` tự dựng.
- **PNG ở máy chủ**, ảnh có khung trang trí, chữ số tiền hay mã đơn trên ảnh: để sau v0.1 (gói native). Noel tree tự vẽ
  thêm chữ lên canvas như hiện nay.
- **Thay code thật của Noel tree:** vẫn để sau v0.1, theo quy trình bên Noel tree (spec 5.11). Plan 6 chỉ thử trên nhánh,
  không gộp vào `main` của Noel tree.

## 3. Ràng buộc

- `@tingqr/core` vẫn không có dependency. `render` vẫn chỉ phụ thuộc `core`.
- **Ngân sách tarball `render` nâng từ 30 000 lên 33 000 byte** **[chủ dự án, 2026-11-21]** để chứa `render/canvas`.
- Angular ≥ 20, render được ở SSR, không cần zone.js, dùng signals (spec mục 3).
- Hono ≥ 4, là `peerDependency`. Chạy ở mọi nơi Hono chạy (Workers, Node, Bun, Deno); không import `node:*`.
- Không bao giờ hiện hay trả về **QR sai**: chuỗi hỏng thì báo lỗi, không vẽ gì. Đổi chuỗi thì xoá ảnh cũ ngay.
- Giới hạn logo của `render` (≤ 10% diện tích, `size` ≤ 0.25) giữ nguyên và áp dụng y hệt cho canvas.
- CI chạy Node 20, 22, 24 trên Ubuntu và Windows. Angular 20 đòi Node ≥ 20.19.

## 4. Các cách đã cân nhắc

### 4.1 Phạm vi component Angular **[chủ dự án: B]**

| Cách | Nội dung | Được và mất |
|---|---|---|
| A. Hẹp | Chỉ hiện QR (SVG), pipe | Nhanh, ít API; Noel tree vẫn giữ toàn bộ phần PNG tự viết |
| **B. Vừa** | A + xuất PNG / data URL để nhấn giữ lưu được | Giải đúng chỗ khó mọi dev Việt gặp ở trình duyệt trong app chat |
| C. Rộng | B + tấm chọn app ngân hàng | Gắn với giao diện từng sản phẩm, nhiều API phải giữ lâu dài |

### 4.2 Gói Hono: mở tới đâu **[chủ dự án: hai cách đầu]**

| Cách | Có làm |
|---|---|
| Hàm hỗ trợ `tingqrSvg(c, payload, options)`; app tự tính chuỗi | Có |
| Route dựng sẵn, bắt buộc `resolve(c) => payload` | Có |
| Route mở theo tham số URL | **Không** (lý do ở mục 2) |

### 4.3 Phần vẽ PNG ở trình duyệt nằm ở đâu **[chủ dự án: cách 2]**

| Cách | Được và mất |
|---|---|
| 1. Trong `@tingqr/angular` | Gọn; nhưng dev React, Vue phải tự viết lại |
| **2. `@tingqr/render/canvas`** | Mọi framework dùng chung, ai không import thì không tải; phải nâng ngân sách `render` |
| 3. Gói mới `@tingqr/browser` | Tách bạch nhất; thêm một gói để phát hành và giữ cho một tính năng nhỏ |

## 5. Thiết kế

### 5.1 `@tingqr/render/canvas` **[Claude]**

- Subpath mới của `@tingqr/render`. Import gốc `@tingqr/render` **không** kéo phần canvas (kiểm bằng test tree-shaking như
  `bank-logos`).
- **Vẽ thẳng từ ma trận**, không vẽ lại chuỗi SVG lên canvas: dùng `toMatrix` và `fillRect` cho từng dải ô tối.
  - Lý do: SVG nạp vào `<img>` không tải được ảnh logo ngoài, và vẽ SVG lên canvas có thể làm canvas "bẩn" (tainted).
- **Cùng tuỳ chọn và cùng kiểm tra như `toSvg`:** `ecc`, `minVersion`, `maxVersion`, `mask`, `margin`, `foreground`,
  `background`, `logo`. Có logo thì tự lên ECC H, cùng `logoBox` / `checkLogoBox`. Tuỳ chọn sai báo cùng mã lỗi
  `INVALID_VALUE` với cùng thông báo. Phần kiểm tra dùng chung code với `svg.ts`, không chép.
- **Tuỳ chọn riêng:** cỡ ảnh tính bằng số px mỗi ô (`scale`, số nguyên). Ảnh ra luôn là số nguyên px mỗi ô để nét
  không bị nhoè.
- **Logo:** nạp ảnh rồi `drawImage` vào ô giữa, nên các hàm có logo là `async`.
  - Logo khác nguồn (cross-origin) không có CORS sẽ làm canvas bẩn, khiến `toBlob` ném `SecurityError`. Bắt lỗi này và
    báo `TingQrError` có mã rõ ràng, nói dev dùng data URI (ví dụ từ `@tingqr/bank-logos`) hoặc ảnh cùng nguồn.
  - Logo nạp hỏng thì báo lỗi, **không** âm thầm xuất QR không logo (dev đã xin có logo, QR khác thứ họ thấy lúc thiết
    kế).
- **API dự kiến** (tên chính xác để builder chốt):
  - `drawQr(canvas, text, options)`: vẽ lên canvas có sẵn (dev muốn vẽ thêm chữ như Noel tree);
  - `toPngBlob(text, options): Promise<Blob>`;
  - `toPngDataUrl(text, options): Promise<string>`.
- Chạy ở trình duyệt. Gọi trên máy chủ (không có canvas) thì báo lỗi rõ, không crash khó hiểu.
- **Mã lỗi mới** cho canvas bẩn và logo nạp hỏng **[Claude]**: thêm vào bảng chung `conformance/errors.json` như mọi mã
  khác, không đổi schema của bảng, không có phần riêng theo nền tảng. Bản .NET (Plan 8) vẫn khai báo đủ các mã trong bảng,
  chỉ là không bao giờ ném hai mã này (không có canvas). Như vậy hai bản dùng đúng một bảng mã và `parity-review` không
  phải có ngoại lệ. Mô tả của mã ghi rõ chỉ xảy ra khi vẽ trên canvas ở trình duyệt.

### 5.2 `@tingqr/angular` **[chủ dự án: B; chi tiết: Claude]**

- **Component standalone `<tingqr-code>`**:
  - `payload` (bắt buộc): chuỗi QR đã tạo bằng `@tingqr/core`.
  - Các tuỳ chọn vẽ của `toSvg` (màu, viền, logo, ECC…), gom trong một input `options` hoặc tách input; builder chọn.
  - `label`: nhãn trợ năng (`role="img"` + `aria-label`). Không có nhãn mặc định bằng tiếng Việt cứng trong code.
  - **Hai chế độ hiển thị** (input, mặc định `'auto'`):
    - `'svg'`: luôn SVG nhúng.
    - `'img'`: luôn `<img>` PNG (từ `render/canvas`), nhấn giữ lưu được.
    - `'auto'`: SVG khi render ở máy chủ (trang hiện QR ngay, không cần JS); sau khi chạy ở trình duyệt thì thay bằng
      `<img>` PNG.
  - **Output:** sự kiện báo lỗi (mang `TingQrError`) và sự kiện báo PNG đã sẵn sàng (để dev bật nút "Lưu" như Noel tree).
  - **Lỗi:** chuỗi hay tuỳ chọn sai thì **không vẽ gì**, phát sự kiện lỗi. Không ném lỗi làm hỏng cả trang SSR.
  - Đổi `payload` thì ảnh cũ biến mất ngay, trước khi PNG mới vẽ xong (Noel tree có quy tắc này: "không bao giờ để mã sai").
  - Signals, `ChangeDetectionStrategy.OnPush`, chạy zoneless. Không dùng `DOCUMENT`/`window` khi đang ở máy chủ
    (`afterNextRender` hoặc `isPlatformBrowser`).
- **Pipe `tingqrSvg`:** chuỗi → SVG đã đánh dấu an toàn để gắn vào `[innerHTML]`.
  - Angular sanitizer xoá SVG trong `innerHTML`, nên phải `bypassSecurityTrustHtml`. Chấp nhận được vì SVG do `toSvg` tạo,
    mọi thuộc tính đã escape, `href` của logo đã kiểm scheme (`checkLogoHref`). Tài liệu ghi rõ lý do.
- **Build bằng `ng-packagr`** (định dạng Angular Package Format, biên dịch partial). Dùng toolchain **Angular 20** để gói
  chạy được trên cả 20 và 21. `@angular/core`, `@angular/common`, `@tingqr/core`, `@tingqr/render` là peer hoặc
  dependency (builder chọn; `render` nên là dependency).

### 5.3 `@tingqr/hono` **[chủ dự án: hai cách đầu; chi tiết: Claude]**

- **`tingqrSvg(c, payload, options?)`** → `Response`:
  - `Content-Type: image/svg+xml; charset=utf-8`;
  - `X-Content-Type-Options: nosniff`;
  - `Content-Security-Policy` chặn script (SVG mở thẳng trên trình duyệt là một tài liệu, chạy được script nếu có);
  - `Cache-Control` mặc định `private` (QR mang số tài khoản và số tiền, không cho CDN chung giữ), dev đổi được.
  - Tuỳ chọn vẽ giống `toSvg`.
- **Route dựng sẵn `tingqr({ resolve, … })`** → handler của Hono, ví dụ
  `app.get('/orders/:id/qr.svg', tingqr({ resolve: (c) => payloadOfOrder(c.req.param('id')) }))`:
  - `resolve` bắt buộc, có thể `async`, trả chuỗi QR hoặc `null`;
  - `null` → 404;
  - `TingQrError` (chuỗi hay tuỳ chọn sai) → 400, thân JSON có `code` (mã trong `errors.json`), không trả ảnh;
  - lỗi khác của `resolve` → để Hono xử lý như lỗi thường (`app.onError`), không nuốt.
- Không có tham số nào lấy từ URL để dựng QR. Tài liệu giải thích vì sao (mục 2).

### 5.4 Thử trong Noel tree **[Claude]**

- Nhánh thử riêng trong repo `../noel-tree`, **không gộp** vào `main` bên đó. Cài ba gói từ file `.tgz` (`pnpm pack`),
  vì chưa phát hành npm. Noel tree dùng npm (`package-lock.json`).
- **Bối cảnh** (kiểm 2026-11-21): ảnh `o.qrUrl` (`vietqr.app`) chỉ hiện ở nhánh `@else` của `pay-panel.ts`, khi
  `binOf(bank)` của Noel tree không ra BIN. `qrUrl` dùng cho cả đơn quà (`src/api/orders.ts`) lẫn đơn quả châu
  (`src/api/baubles.ts:70`). Noel tree chỉ có một tài khoản nhận cố định (`SEPAY_BANK`), nên nhánh này thực chất là lưới
  đỡ lỗi cấu hình.
- **Cách thay: hướng A [chủ dự án, 2026-11-21]:**
  - phía trình duyệt tạo chuỗi VietQR bằng `@tingqr/core` (`encodeVietQr`), tìm BIN bằng `findBank` của
    `@tingqr/core/banks` thay `binOf`;
  - route `@tingqr/hono` trong Worker cũng tìm BIN bằng `findBank`, thay **hẳn** `vietqr.app` cho **cả đơn quà và đơn quả
    châu**; `findBank` không ra thì `resolve` trả `null` (404), không giữ `vietqr.app` làm phương án cuối;
  - chấp nhận: ở ca hiếm này ảnh là SVG, có thể không nhấn giữ lưu được trong app chat (chưa thử).
- Việc thử:
  1. `pay-panel.ts` dùng `<tingqr-code mode="img">` hoặc `render/canvas` thay `qrcode-generator` + canvas tự viết, và
     `findBank` thay `binOf`;
  2. `orders.ts` và `baubles.ts` trỏ `qrUrl` về route `@tingqr/hono` trong Worker thay `vietqr.app`;
  3. chạy test của Noel tree, `ng build` SSR và chạy thử bằng `wrangler dev`: trang SSR có QR, trình duyệt đổi sang PNG,
     route Hono trả SVG.
- **Bằng chứng ghi lại:** kích thước bundle phía trình duyệt so với `qrcode-generator`, kết quả các bước trên, và lỗi
  nào phải sửa ngược về tingqr.
- **Chưa coi là đã chứng minh** cho tới khi chủ dự án thử trên điện thoại thật: nhấn giữ lưu được PNG trong Zalo và
  Messenger, rồi app ngân hàng quét được ảnh đã lưu. Ghi vào `conformance/scans.md` theo cách các lần quét trước.

### 5.5 Tài liệu cho dev

- README của mỗi gói: cách dùng, ví dụ Angular SSR, ví dụ Hono trên Workers.
- Ghi rõ: canvas chỉ chạy ở trình duyệt; logo khác nguồn phải có CORS hoặc dùng data URI; vì sao không có route mở.
- Hướng dẫn tiếng Việt ở `docs/huong-dan/` (theo kiểu `ngan-hang-va-mo-app.md`).

## 6. Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| PNG khác ma trận (vẽ lệch, thiếu ô) | Test so từng ô của canvas với `toMatrix` (canvas giả ghi lại `fillRect`, hoặc canvas thật trong trình duyệt) |
| Canvas lệch kiểm tra so với `toSvg` | Cùng bộ test tuỳ chọn sai chạy cho cả hai, cùng mã lỗi |
| `render/canvas` lọt vào import gốc | Test tree-shaking bằng esbuild, như `bank-logos` |
| Vượt ngân sách `render` | `check:render` với 33 000 byte |
| Component lỗi ở SSR hay khi hydrate | Test render ở máy chủ, và thử thật trong Noel tree (`wrangler dev`) |
| Gói Angular build bằng 20 không chạy trên 21 | Noel tree (21.2) là bằng chứng; thêm một bước CI nếu rẻ |
| Header Hono sai, lỗi lọt thành ảnh | Test bằng `app.request()` của Hono: 200/404/400, đủ header |
| README nói "lưu được trong Zalo" khi chưa thử | Chỉ ghi sau khi có dòng trong `conformance/scans.md` |

## 7. Để người lập kế hoạch tự quyết

- Tên chính xác của hàm, input, output, mã lỗi mới (giữ các khái niệm ở mục 5).
- Cách test canvas (canvas giả, `@napi-rs/canvas` làm devDependency, hay Playwright) và cách test component Angular
  (Vitest với Angular, hay builder test của Angular).
- `@tingqr/angular` và `@tingqr/hono` có chạy mutation không; nếu có thì ngưỡng bao nhiêu. Phần canvas trong `render`
  theo ngưỡng 90% sẵn có của `render`.
- Ngân sách tarball của hai gói mới.
- Thứ tự task: nên làm `render/canvas` trước, vì cả component lẫn Noel tree dựa vào nó.
