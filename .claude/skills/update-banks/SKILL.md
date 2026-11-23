---
name: update-banks
description: Dùng khi cập nhật danh sách ngân hàng, app ngân hàng hoặc logo của tingqr (conformance/banks/), khi có issue nhãn update-banks, hoặc khi thêm hay sửa một ngân hàng hay app.
---

# Cập nhật danh sách ngân hàng

Thiết kế: `docs/superpowers/specs/2026-11-20-tingqr-banks-design.md`. Nguồn sự thật: `conformance/banks/`, xem bảng
trong `conformance/README.md`. Script ở `conformance/tools/banks/`.

## Trước khi chạy

- **Mọi lệnh dưới đây gọi mạng:** vietqr.io, `dl.vietqr.io`, Google Play, Wikimedia Commons. Báo chủ dự án trước khi
  chạy, và chỉ chạy qua `node conformance/tools/banks/...`, để chủ dự án được hỏi.
- Làm trên một nhánh, không làm trên `main`.
- Một lần cài: `pnpm -C conformance/tools/banks install`. Cần `sharp` để thu nhỏ logo; chỉ công cụ dùng, không vào gói nào.

## Các bước

1. `node conformance/tools/banks/update.mjs --fetch-logos`
   - Ghi `banks.json` (đã áp `overrides.json`) và `play-checks.json`.
   - Tải ảnh mới hoặc ảnh đã đổi vào `logos/`, cập nhật `logos/manifest.json`.
   - In báo cáo.
   - **Không bao giờ ghi `bank-apps.json` hay `overrides.json`.** Hai file này sửa tay.
2. Đọc báo cáo, xử lý từng loại (bảng dưới). Sửa tay `bank-apps.json` nếu cần.
3. Sinh lại dữ liệu cho hai bản, theo thứ tự:
   - `node conformance/tools/banks/sync-ts.mjs`, sinh `ts/packages/core/src/banks/data.ts`;
   - `node conformance/tools/banks/sync-dotnet.mjs`, sinh `dotnet/src/TingQR.Core/Banks/BankData.g.cs`.
   - Commit cả hai file vào PR. Không sửa tay file nào.
4. Đổi dữ liệu của một app có mẫu trong `conformance/vectors/bank-app-link/` thì sửa mẫu đó, kèm `source`.
5. Chạy kiểm tra:
   - `pnpm -C conformance/tools/banks test`;
   - `pnpm -C ts test`;
   - `dotnet test dotnet/TingQR.slnx` (có test `BankDataSyncTests` chạy `sync-dotnet.mjs --check`);
   - `pnpm -C ts build`, rồi `pnpm -C ts check:core` và `pnpm -C ts check:bank-logos`.
6. Mở PR. Nội dung PR là báo cáo, cộng các chỗ đã sửa tay và lý do. Gộp xong thì đóng issue `update-banks`.

## Xử lý từng loại khác biệt

| Báo cáo | Làm gì |
|---|---|
| Ngân hàng thêm, bỏ, đổi | Script đã ghi. Xem tên có đúng không; sai thì thêm vào `overrides.json` (trường, giá trị, lý do, nguồn) |
| **Từ chối ghi** (API bỏ hơn 5 ngân hàng một lần) | Kiểm tay `api.vietqr.io/v2/banks`. API lỗi thì chờ; thật sự bỏ thì báo chủ dự án |
| App `new` | Thêm vào `bank-apps.json` khi đã có scheme. `multi-source` chỉ khi có thêm một nguồn **độc lập** với vietqr.io. Không muốn thêm thì ghi vào `ignoredVietqrApps` kèm lý do |
| App `missing`, `scheme`, `package`, `host` | Tìm lý do. Cố ý khác vietqr.io thì ghi `vietqrDiffers` và `disagreements`. Đổi scheme hay gói thì sửa mẫu link liên quan |
| Gói Google Play `gone` (404) | Tìm gói mới trên Google Play (`node conformance/tools/banks/play-check.mjs <gói>`). Không thấy thì bỏ phần `android` của app |
| Gói "chưa kiểm được" | Không làm gì (Google hay chặn máy CI) |
| **Quá 90 ngày chưa xác nhận** | Chạy bước 1 ở máy để kiểm lại Google Play |
| Ảnh `đổi` | Chủ dự án xem ảnh mới trước khi gộp |
| SVG Commons bị loại, hoặc mất nhãn PD | Giữ PNG. Không tự sửa SVG |

## Không được

- Ghi `deviceVerified` khi chưa có người mở thử app trên máy thật (ghi ai, hệ điều hành, ngày).
- Đoán scheme hay gói không có nguồn. Thiếu thì để trống phần đó.
- Tính `qrviet` hay Noel tree là nguồn độc lập (cả hai chép từ vietqr.io; xem `conformance/banks/sources/*/NOTES.md`).
