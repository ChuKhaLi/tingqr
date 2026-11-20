# Nguồn danh sách ngân hàng và app, chụp ngày 2026-11-20

Bản chụp nguyên văn làm bằng chứng cho `conformance/banks/*.json`. Không sửa các file ở đây; lần chụp sau đặt ở thư mục
ngày mới.

| File | Nguồn | Giấy phép | Cách lấy |
|---|---|---|---|
| `vietqr-banks.json` | https://api.vietqr.io/v2/banks | dữ liệu công khai, không ghi giấy phép | `capture-sources.mjs` |
| `vietqr-android-app-deeplinks.json` | https://api.vietqr.io/v2/android-app-deeplinks | như trên | `capture-sources.mjs` |
| `vietqr-ios-app-deeplinks.json` | https://api.vietqr.io/v2/ios-app-deeplinks | như trên | `capture-sources.mjs` |
| `vietqr-dl-redirects.json` | `dl.vietqr.io/pay?app=<id>` của từng app, mở bằng user-agent Android và iPhone | như trên | `capture-sources.mjs` |
| `qrviet-bank-apps.json`, `qrviet-LICENSE` | `nghiepdev/qrviet`, commit `32667622752626c9efffd1b6b294e077465ee88f`, `src/data/bank-apps.json` | MIT | tải nguyên file từ GitHub |
| `vietnam-qr-pay-bank-apps.js`, `vietnam-qr-pay-bank-key.js`, `vietnam-qr-pay-LICENSE` | gói npm `vietnam-qr-pay` 1.5.1, `dist/constants/` | MIT | chép từ `conformance/tools/oracle/node_modules` |

## Các nguồn này độc lập với nhau tới đâu

- **API deeplink của vietqr.io không có scheme hay tên gói.** Nó chỉ cho link `dl.vietqr.io/pay?app=<id>`. Scheme và gói
  nằm trong phản hồi của `dl.vietqr.io`:
  - với Android là redirect 302 tới `intent://...`;
  - với iPhone là trang HTML có nút `id="open"`, link `scheme://`.
- **`qrviet` không độc lập với vietqr.io.** Script `scripts/sync-banks.ts` của nó lấy scheme và gói từ chính
  `dl.vietqr.io` (và từ `vietqr-discovery.json` của `Ngochiendev/vietqr-core`). Chỗ nó khớp vietqr.io không phải bằng chứng
  thứ hai. Nó có thêm vài app tự thêm tay (MoMo, ZaloPay…) và mã App Store.
- **`vietnam-qr-pay` 1.5.1 độc lập** nhưng cũ: một số scheme và gói khác vietqr.io (ví dụ ACB `acbapp`, ABBANK
  `com.vnpay.abbank`).
- **Noel tree** (`../noel-tree/src/app/tree/bank-apps.ts`): 15 app, chép từ vietqr.io ngày 2026-11-18, nên cũng không
  độc lập. Chỉ có MB Bank và MyVIB được chủ dự án mở thử trên Android.
- **Tài liệu ZaloPay và Bao Kim** không có bảng scheme hay gói công khai: danh sách nằm sau API cần tài khoản merchant. Không
  dùng được làm nguồn.

Bằng chứng độc lập duy nhất cho tên gói là trang Google Play (`play-checks.json`). Cho scheme thì là lần mở thử trên máy
thật (`deviceVerified`).
