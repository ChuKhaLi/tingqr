# tingqr

Tạo, đọc và vẽ QR thanh toán: VietQR trước, rồi tới QR xuyên biên giới Đông Nam Á (PromptPay, KHQR). Hiện có bản
TypeScript, bản .NET làm sau. Chạy offline, có kiểu rõ ràng, kiểm bằng các mẫu QR có nguồn.

> **tingqr không xác nhận đã nhận tiền và không nhận webhook.** Thư viện chỉ tạo, đọc và vẽ QR. Muốn biết tiền đã về,
> dùng thông báo của ngân hàng hay của bên trung gian thanh toán (ví dụ SePay).

**Trạng thái: chưa phát hành.** v0.1 đợi có nhận diện QR MoMo, ZaloPay và quét thử bằng thêm app ngân hàng. Các gói dưới
đây đã xong và có test trong repo này, nhưng chưa có trên npm.

Mục tiêu: đọc được mọi QR mà app ngân hàng Việt Nam quét được. Bảng dưới cho biết bằng chứng hiện có tới đâu.

## Làm được gì, đã kiểm tới đâu

| Loại QR | Tạo | Đọc | Đã quét bằng app thật |
|---|---|---|---|
| VietQR chuyển vào tài khoản (`QRIBFTTA`), tĩnh và có số tiền | có | có | **MB Bank 6.5.31** và **MyVIB 1.80.3** (Android 16), trên màn hình và trên giấy, có và không có logo thử |
| VietQR chuyển vào thẻ (`QRIBFTTC`) | có | có | MyVIB 1.80.3 **không đọc được** mẫu chuyển vào thẻ (chưa rõ app từ chối loại QR này hay từ chối số thẻ bịa) |
| VNPAY-QR | — | có | chưa |
| PromptPay (Thái Lan) | có | có | chưa |
| KHQR (Campuchia) | có | có | chưa |
| MoMo, ZaloPay | — | chưa nhận diện (đang chờ QR thật) | — |

Mỗi lần quét là một dòng trong [`conformance/scans.md`](conformance/scans.md), do chính người quét điền. Bạn đã quét QR
của tingqr bằng app của mình? [Báo kết quả](https://github.com/ChuKhaLi/tingqr/issues/new?template=scan-report.yml).

## Các gói

| Gói | Dùng để |
|---|---|
| [`@tingqr/core`](ts/packages/core) | Tạo và đọc VietQR, VNPAY-QR, PromptPay, KHQR; `detect()` một chuỗi bất kỳ; danh sách ngân hàng và link mở app ngân hàng (`@tingqr/core/banks`). Không có dependency. |
| [`@tingqr/render`](ts/packages/render) | Vẽ QR thành ma trận hay SVG (trình duyệt, Node, Workers, SSR); PNG ở trình duyệt (`@tingqr/render/canvas`). |
| [`@tingqr/bank-logos`](ts/packages/bank-logos) | Logo ngân hàng và icon app ngân hàng Việt Nam, mỗi ảnh một module. Ảnh là nhãn hiệu, không thuộc MIT. |
| [`@tingqr/angular`](ts/packages/angular) | Component `<tingqr-code>` và pipe `tingqrSvg`: SVG khi render ở máy chủ, PNG ở trình duyệt. |
| [`@tingqr/hono`](ts/packages/hono) | Trả QR dạng SVG từ route Hono của bạn (Workers, Node). |
| [`@tingqr/nestjs`](ts/packages/nestjs) | Cấu hình tài khoản nhận một lần, `paymentQr()`, và `@TingQrSvg()` cho controller (Express, Fastify). |

## Xem nhanh

```ts
import { encodeVietQr, detect } from '@tingqr/core'
import { toSvg } from '@tingqr/render'

// BIN ngân hàng nhận (MB Bank), số tài khoản bịa, số tiền (đồng) và nội dung chuyển khoản.
const payload = encodeVietQr({ bankBin: '970422', accountNumber: '0123456789', amount: 50000, purpose: 'TINGQR TEST' })

const svg = toSvg(payload) // chuỗi <svg>, không cần DOM

const found = detect(payload)
if (found.ok && found.value.scheme === 'vietqr') {
  console.log(found.value.data.accountNumber, found.value.data.amount) // '0123456789' '50000'
}
```

- Khi tạo, đầu vào sai thì ném `TingQrError` với mã trong [`conformance/errors.json`](conformance/errors.json). Ví dụ:
  nội dung chuyển khoản có dấu thì báo `NON_ASCII`, vì app ngân hàng từ chối chữ có dấu.
- Khi đọc, kết quả là `{ ok: true, value, warnings }` hoặc `{ ok: false, error }`. Mặc định chấp nhận các chỗ lệch chuẩn
  nhỏ hay gặp ở QR ngoài đời (mỗi chỗ lệch ghi trong `warnings`). Muốn đọc chặt thì truyền `{ mode: 'strict' }`.

## Vì sao tin được

- **Mẫu thử có nguồn.** Mỗi hành vi có một mẫu trong [`conformance/vectors/`](conformance/vectors), ghi rõ lấy từ đâu:
  đặc tả, QR thật, hay kết quả của các thư viện MIT độc lập cho ra cùng một chuỗi. Không có mẫu bịa. Bản .NET sẽ chạy
  cùng bộ mẫu này.
- **Quét bằng app thật** chỉ do chính người quét ghi vào [`conformance/scans.md`](conformance/scans.md). README chỉ nêu
  tên một app khi bảng đó có dòng tương ứng.
- **Test:** unit test và mẫu thử trên Ubuntu và Windows, Node 20, 22, 24. Mutation test (ngưỡng 90%) cho `core` và
  `render`. Mỗi gói có ngân sách dung lượng và có bước kiểm dependency.
- **An toàn từ thiết kế:** gói tích hợp máy chủ không bao giờ dựng QR từ tham số URL, nên không ai dùng được tên miền
  của bạn để hiện QR trỏ vào tài khoản của người khác. Bộ tạo VietQR chỉ ghi các tag mà app ngân hàng cần, không có tuỳ
  chọn thêm tag khác (app có thể từ chối).

## Giấy phép

MIT, xem [`LICENSE`](LICENSE). Ngoại lệ và ghi công:
- logo ngân hàng và icon app trong `@tingqr/bank-logos` là nhãn hiệu của chủ sở hữu, không thuộc MIT; xem
  [`LOGOS-NOTICE.md`](ts/packages/bank-logos/LOGOS-NOTICE.md);
- bộ mã hoá QR trong `@tingqr/render` port từ QR Code generator của Project Nayuki (MIT);
- lấy cảm hứng từ [`vietqr/vietqr-node`](https://github.com/vietqr/vietqr-node) (MIT, Casso).

English: [README.md](README.md).
