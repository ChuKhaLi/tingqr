# Danh sách ngân hàng, link mở app ngân hàng, logo

Hướng dẫn cho dev dùng `@tingqr/core/banks` và `@tingqr/bank-logos`. Thiết kế:
`docs/superpowers/specs/2026-11-20-tingqr-banks-design.md`.

## Tra ngân hàng

```ts
import { BANKS, findBank, appsForBank } from '@tingqr/core/banks'

findBank('970422') // theo BIN (đúng 6 chữ số)
findBank('mb') // theo mã vietqr.io hoặc tên ngắn, không phân biệt hoa thường; không cắt khoảng trắng
appsForBank('970416') // các app của ACB: acb, acb-biz
```

- `BANKS` gồm mọi ngân hàng của `api.vietqr.io/v2/banks`, ngày lấy ghi trong `conformance/banks/banks.json`.
- `findBank` không thấy thì trả `undefined`.
- `logoUrl` là link tới `cdn.vietqr.io`. Tải ảnh qua link này là gọi mạng: đây là ngoại lệ duy nhất của "chạy offline".
  Muốn chạy offline hẳn thì dùng `@tingqr/bank-logos`.
- `decodeVietQr` và `detect` không tự gắn tên ngân hàng; gọi `findBank(data.bankBin)` khi cần.
- `@tingqr/core/banks` không có trong `@tingqr/core` gốc: ai chỉ cần VietQR thì không phải mang danh sách này.

## Mở app ngân hàng

```ts
import { bankAppLink } from '@tingqr/core/banks'

bankAppLink('mb', 'android') // intent://#Intent;scheme=mbbank;package=com.mbmobile;end
bankAppLink('mb', 'android', { fallbackUrl: 'https://example.com/pay' }) // có S.browser_fallback_url
bankAppLink('mb', 'ios') // mbbank://
```

- **Chỉ mở app, không điền sẵn số tiền hay nội dung.** Mọi cách điền sẵn đã biết đều đi qua máy chủ bên thứ ba
  (vietqr.io, ZaloPay, Bao Kim), hoặc là định dạng đoán ngược chưa có tài liệu. Người dùng quét QR, hoặc dán số tài khoản,
  trong app.
- **Ném `TingQrError('INVALID_VALUE')` khi:**
  - `appId` không có trong danh sách;
  - app không có scheme cho hệ được hỏi (ví dụ MoMo, ZaloPay hiện chỉ có scheme iOS);
  - `fallbackUrl` không phải URL `https:` hay `http:` tuyệt đối.
- **`fallbackUrl`:** chỉ Android dùng; iOS không có cơ chế tương đương, nhưng giá trị vẫn được kiểm.
- **iOS:** chỉ mở được scheme trong thao tác bấm của người dùng, không mở tự động khi tải trang. App native gọi
  `canOpenURL` phải khai `LSApplicationQueriesSchemes` (tối đa 50 scheme).
- **Android:** app native mở bằng code phải khai `<queries>` trong manifest, hoặc bắt `ActivityNotFoundException`.
- **Trình duyệt trong Zalo, Messenger, Facebook, TikTok** hay chặn scheme và `intent://`. Điều này lấy từ tài liệu và báo
  cáo của người khác; tingqr **chưa tự thử**.

### Danh sách app tin được tới đâu

- Mỗi app có `confidence`:
  - `multi-source`: ít nhất hai nguồn độc lập liệt kê app đó;
  - `single-source`: chỉ có một nguồn.
- Nguồn, chỗ các nguồn khác nhau, và kết quả kiểm Google Play nằm trong `conformance/banks/`. Xem
  `sources/<ngày>/NOTES.md` để biết nguồn nào độc lập với nguồn nào.
- **Chỉ MB Bank và MyVIB đã được mở thử trên máy thật** (Android, chủ dự án, 2026-11-18, qua Noel tree); xem
  `deviceVerified`. Mọi app khác chỉ dựa trên nguồn: tên gói đã kiểm trên Google Play, nhưng scheme chưa ai mở thử.
- **Chưa có:**
  - VietABank, Vietbank, BVBank (Bản Việt): các nguồn ghi khác nhau;
  - phần Android của MoMo và ZaloPay: chưa có nguồn cho scheme Android;
  - ví không có scheme công khai (Viettel Money, ShopeePay, VNPAY).
- Danh sách được kiểm tự động hằng tháng; có thay đổi thì mở issue (`.github/workflows/update-banks.yml`).

## Logo và icon

Xem `ts/packages/bank-logos/README.md`. Ảnh **không** thuộc giấy phép MIT (`LOGOS-NOTICE.md`). Icon đặt giữa QR là
**tạm thời**: chưa ai quét thử QR có logo bằng app thật.
