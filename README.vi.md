# tingqr

Tạo, đọc và vẽ QR thanh toán: VietQR trước, rồi tới QR xuyên biên giới Đông Nam Á (PromptPay, KHQR). Có bản
TypeScript và bản [.NET](#net). Chạy offline, có kiểu rõ ràng, kiểm bằng các mẫu QR có nguồn.

> **tingqr không xác nhận đã nhận tiền và không nhận webhook.** Thư viện chỉ tạo, đọc và vẽ QR. Muốn biết tiền đã về,
> dùng thông báo của ngân hàng hay của bên trung gian thanh toán (ví dụ SePay).

<!-- status:npm -->
**Trạng thái: chưa phát hành.** v0.1 đợi có nhận diện QR MoMo, ZaloPay và quét thử bằng thêm app ngân hàng. Các gói npm
dưới đây đã xong và có test trong repo này, nhưng chưa có trên npm.

Mục tiêu: đọc được mọi QR mà app ngân hàng Việt Nam quét được. Bảng dưới cho biết bằng chứng hiện có tới đâu.

## Làm được gì, đã kiểm tới đâu

| Loại QR | Tạo | Đọc | Đã quét bằng app thật |
|---|---|---|---|
| VietQR chuyển vào tài khoản (`QRIBFTTA`), tĩnh và có số tiền | có | có | **MB Bank 6.5.31** và **MyVIB 1.80.3** (Android 16), trên màn hình và trên giấy, có và không có logo thử |
| VietQR chuyển vào thẻ (`QRIBFTTC`) | có | có | **MB Bank 6.5.31** đọc được mẫu chuyển vào thẻ (tra số thẻ bịa thất bại); **MyVIB 1.80.3 không đọc được** (chưa rõ app từ chối loại QR này hay từ chối số thẻ bịa) |
| VNPAY-QR | — | có | chưa |
| PromptPay (Thái Lan) | có | có | chưa |
| KHQR (Campuchia) | có | có | chưa |
| MoMo, ZaloPay | — | chưa nhận diện (đang chờ QR thật) | — |

Mỗi lần quét là một dòng trong [`conformance/scans.md`](conformance/scans.md), do chính người quét điền. Bạn đã quét QR
của tingqr bằng app của mình? [Báo kết quả](https://github.com/ChuKhaLi/tingqr/issues/new?template=scan-report.yml).

## Các gói

| Gói | Dùng để |
|---|---|
| [`@tingqr/core`](ts/packages/core) | Tạo và đọc VietQR, PromptPay, KHQR; đọc VNPAY-QR; `detect()` một chuỗi bất kỳ; danh sách ngân hàng và link mở app ngân hàng (`@tingqr/core/banks`). Không có dependency. |
| [`@tingqr/render`](ts/packages/render) | Vẽ QR thành ma trận hay SVG (trình duyệt, Node, Workers, SSR); PNG ở trình duyệt (`@tingqr/render/canvas`). |
| [`@tingqr/bank-logos`](ts/packages/bank-logos) | Logo ngân hàng và icon app ngân hàng Việt Nam, mỗi ảnh một module. Ảnh là nhãn hiệu, không thuộc MIT. |
| [`@tingqr/angular`](ts/packages/angular) | Component `<tingqr-code>` và pipe `tingqrSvg`: SVG khi render ở máy chủ, PNG ở trình duyệt. |
| [`@tingqr/hono`](ts/packages/hono) | Trả QR dạng SVG từ route Hono của bạn (Workers, Node). |
| [`@tingqr/nestjs`](ts/packages/nestjs) | Cấu hình tài khoản nhận một lần, `paymentQr()`, và `@TingQrSvg()` cho controller (Express, Fastify). |

## .NET

<!-- status:nuget -->
**Trạng thái: chưa phát hành.** Bốn gói NuGet dưới đây đã xong và có test trong repo này, nhưng chưa có trên NuGet. Test
của `TingQR.AspNetCore` và `TingQR.BankLogos` mới chạy trên máy cục bộ, chưa chạy trên CI của GitHub (xem mục Test bên
dưới). Số
phiên bản của chúng riêng với các gói npm; bốn gói dùng chung một số.

| Gói | Dùng để |
|---|---|
| [`TingQR.Core`](dotnet/src/TingQR.Core) | Bản C# của `@tingqr/core`: tạo và đọc VietQR, PromptPay, KHQR; đọc VNPAY-QR; `TingQrDetector.Detect`; ngân hàng và link mở app ngân hàng. `net10.0` và `netstandard2.0`, không có dependency. |
| [`TingQR.Rendering`](dotnet/src/TingQR.Rendering) | Bản C# của `@tingqr/render`: ma trận và SVG, ra đúng như bản TypeScript trên bộ mẫu chung. Không có PNG. `net10.0` và `netstandard2.0`. |
| [`TingQR.BankLogos`](dotnet/src/TingQR.BankLogos) | Cùng bộ logo ngân hàng và icon app như `@tingqr/bank-logos`, nhúng trong DLL, tra theo BIN hay id app. Ảnh là nhãn hiệu, không thuộc MIT. |
| [`TingQR.AspNetCore`](dotnet/src/TingQR.AspNetCore) | `AddTingQr` (tài khoản nhận được kiểm khi app khởi động), `TingQrService.PaymentQr`, và trả SVG từ Minimal API (`WithTingQrSvg`, `TingQrHttpResults.Svg`) hay MVC (`[TingQrSvg]`). `net10.0`. |

```csharp
string payload = VietQr.Encode(new VietQrInput { BankBin = "970422", AccountNumber = "0123456789", Amount = 50000L });
string svg = TingQrRender.ToSvg(payload);
```

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
- Khi đọc, kết quả là `{ ok: true, value, warnings }` hoặc `{ ok: false, error }`. Mặc định chấp nhận QR thiếu tag mà
  chuẩn đòi nhưng QR thật hay bỏ (QR VNPAY thường thiếu tag 52 và 60), kèm cảnh báo; `{ mode: 'strict' }` thì từ chối.
  CRC viết thường và khoảng trắng hai đầu được chấp nhận ở cả hai chế độ, luôn kèm cảnh báo.

## Vì sao tin được

- **Mẫu thử có nguồn.** Hành vi được ghim bằng các mẫu trong [`conformance/vectors/`](conformance/vectors), mỗi mẫu ghi
  rõ nguồn: kết quả của thư viện độc lập (hai thư viện cho ra cùng chuỗi khi có thể; vài loại QR chỉ có một), mẫu công
  bố kèm thư viện đó, quy tắc tingqr tự viết cho đầu vào sai, hay một biến thể của các mẫu trên. Chưa có mẫu nào chụp từ
  QR thật ngoài đời. Các gói .NET chạy cùng bộ mẫu này (trừ vài mẫu kiểm kiểu dữ liệu JavaScript).
- **Quét bằng app thật** chỉ do chính người quét ghi vào [`conformance/scans.md`](conformance/scans.md). README chỉ nêu
  tên một app khi bảng đó có dòng tương ứng.
- **Test:** unit test và mẫu thử trên Ubuntu và Windows, Node 20, 22, 24. Mutation test (ngưỡng 90%) cho `core` và
  `render`, trừ bộ mã hoá QR port từ Nayuki và dữ liệu ngân hàng sinh tự động. Mỗi gói có ngân sách dung lượng và có bước kiểm dependency.
  .NET: workflow CI được cấu hình để chạy test trên Ubuntu và Windows (`net10.0`, thêm `net481` trên Windows cho bản
  `netstandard2.0`), và mutation test (Stryker.NET, ngưỡng 90%) được cấu hình cho cả bốn gói, cùng hai ngoại lệ như
  trên; bước diễn tập phát hành cài các file `.nupkg` đã đóng gói vào app nằm ngoài repo rồi dùng thử. Những gì đã chạy:
  test CI và mutation test của `TingQR.Core` và `TingQR.Rendering` trên GitHub; với `TingQR.AspNetCore` và
  `TingQR.BankLogos`, test và mutation test mới chạy cục bộ trên Windows (chưa chạy trên CI của GitHub); bước diễn tập
  mới chạy cục bộ trên Windows.
- **An toàn từ thiết kế:** gói tích hợp máy chủ không tự dựng QR từ tham số URL: `resolve` hay controller của bạn quyết
  chuỗi QR, và README của từng gói giải thích vì sao chuỗi đó không được lấy từ URL (nếu không, ai cũng dùng được tên
  miền của bạn để hiện QR trỏ vào tài khoản bất kỳ). Bộ tạo VietQR chỉ ghi các tag mà app ngân hàng cần, không có tuỳ
  chọn thêm tag khác (app có thể từ chối).

## Giấy phép

MIT, xem [`LICENSE`](LICENSE). Ngoại lệ và ghi công:
- logo ngân hàng và icon app trong `@tingqr/bank-logos` và `TingQR.BankLogos` là nhãn hiệu của chủ sở hữu, không
  thuộc MIT; xem [`LOGOS-NOTICE.md`](ts/packages/bank-logos/LOGOS-NOTICE.md) (npm) và
  [`LOGOS-NOTICE.md`](dotnet/src/TingQR.BankLogos/LOGOS-NOTICE.md) (.NET);
- bộ mã hoá QR trong `@tingqr/render` và `TingQR.Rendering` port từ QR Code generator của Project Nayuki (MIT);
- lấy cảm hứng từ [`vietqr/vietqr-node`](https://github.com/vietqr/vietqr-node) (MIT, Casso).

English: [README.md](README.md).
