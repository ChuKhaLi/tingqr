# Thiết kế: dọn lỗi nhỏ trước v0.1 (2026-11-22)

## Ý định

v0.1 đang chờ QR thật của MoMo/ZaloPay và kết quả quét thêm app, đều cần chủ dự án. Trong lúc chờ, sửa các lỗi nhỏ còn
để lại từ Plan 3, 6, 6b, 7 mà người dùng đầu tiên dễ vấp phải, để bản ra mắt không có vết dễ thấy.

- **Mục tiêu:** sửa từng lỗi trong danh sách "Làm" dưới đây, mỗi lỗi có test hoặc mẫu thử chứng minh.
- **Không làm:** tính năng mới, phần .NET (Plan 8), tối ưu hiệu năng.
- **Không được:** đổi hành vi đang đúng của các hàm tạo/đọc QR. Mọi mẫu thử hiện có phải giữ nguyên kết quả.

## Làm

### Core
1. **Bộ tạo nhận `undefined`/`null`/không phải object** (`encodeVietQr`, `encodePromptPayQr`, `encodeKhqr`, và bộ tạo
   khác nếu có) ném `TingQrError` với mã có sẵn trong `errors.json` (dự kiến `INVALID_VALUE`), không ném `TypeError`.
   Hiện `encodeVietQr(undefined)` ném "Cannot read properties of undefined (reading 'bankBin')".
2. **Thông báo khi thiếu tag 01** không được chứa chữ `"undefined"`. Builder tìm đúng đường sinh ra thông báo này (một QR
   thiếu tag 01 nhưng CRC đúng) và dựng mẫu thử cho nó.
3. **Mã ngôn ngữ tag 64 của KHQR** chỉ nhận đúng dạng mà đặc tả/oracle KHQR cho phép (dự kiến hai chữ cái ISO 639-1).
   Quy tắc ghi vào `conformance/schemes/khqr.md`, có mẫu thử trước khi sửa code.

### Render, Angular
4. **Logo SVG data URI thiếu `width`/`height`** không được vẽ ra 0×0 trên canvas: dùng kích thước ô logo đã tính làm
   kích thước vẽ.
5. **Host `role="img"` không có `label`** phải có tên truy cập được (ví dụ `aria-label` mặc định mô tả đây là mã QR thanh
   toán). Tên mặc định là tiếng Anh, người dùng ghi đè bằng `label`.
6. **Thêm test cho ba nhánh chưa có test** trong component Angular (lấy từ ghi chú review Plan 6).

### Hợp đồng HTTP (Hono, NestJS) — chủ dự án chọn phương án A
7. **`TingQrError` từ `resolve`/handler hoặc khi vẽ → 500**, thân `{ "error": { "code": "<mã>" } }`, **không có
   `message`**. App muốn trả 400 cho lỗi do khách gây ra thì tự bắt lỗi. Sửa `conformance/http/svg-response.json` trước,
   rồi Hono và NestJS theo; ghi thay đổi vào `CHANGELOG.md` và README của hai gói.
8. **NestJS: `POST` kèm `@TingQrSvg` trả 200**, không phải 201 (khớp mục `success.status` của hợp đồng).
9. **NestJS: tuỳ chọn sai của `@TingQrSvg(options)` và `svg` của module báo lỗi ngay lúc cấu hình**, không đợi từng
   request. Dùng lại phần kiểm tuỳ chọn của `@tingqr/render` nếu có; Hono làm tương tự cho `tingqr()` nếu cũng thiếu.
10. **NestJS: sửa kiểu `inject` của `forRootAsync`** và ghi trong README: `@TingQrSvg` chỉ dùng cho controller HTTP.

### Phát hành
11. **`release-ts.yml` kiểm commit của tag nằm trên `main`**; không thì dừng trước bước phát hành.
12. **Hai tag đẩy cùng lúc không phát hành song song:** `concurrency` cho job phát hành, không huỷ lần đang chạy.

## Để sau (ghi lại, không làm)

PromptPay đọc tag 64 (tính năng mới); bộ đọc thứ hai cho `check-promptpay`; payload bị mã hoá ba lần khi vẽ PNG (chỉ
chậm); deprecate 0.0.1 (sau khi 0.1.0 ra); luật "chỉ tag `ts-v*`" cho environment `npm-release` (chủ dự án đặt trong
trang cài đặt GitHub); mẫu KHQR USD nguyên sinh bằng SDK (cần chạy oracle).

## Cách làm (approaches)

- **Một nhánh, một plan, nhóm theo gói** (chọn): các lỗi nhỏ và độc lập; một plan giữ một lượt review, một lần mutation.
- Mỗi lỗi một PR: quá nhiều vòng review cho thay đổi vài dòng.
- Gộp vào Plan 8: để v0.1 mang lỗi đã biết, trái mục đích.

Với mục 7, chủ dự án chọn **500 không kèm message** thay vì giữ 400 và bỏ message: payload luôn do app tạo, nên
`TingQrError` thường là lỗi phía máy chủ.

## Ràng buộc

- Conformance trước: mục 1–3, 7, 8 có mẫu thử hoặc cập nhật `conformance/` trước khi đổi code.
- Mutation core và render giữ ≥ 90%; ngân sách kích thước `core` 48 000 byte, `render` 36 000 byte.
- Test Angular và NestJS chạy trên `dist`: build trước khi test.
- Trước khi gộp: `evidence-review`, `parity-review` (mục 7 đổi hợp đồng chung, bản .NET ở Plan 8 phải theo).

## Để builder quyết

Mã lỗi cụ thể cho mục 1 (chọn trong `errors.json`, không thêm mã mới nếu mã cũ đủ nghĩa); chữ của `aria-label` mặc
định; cách kiểm "tag nằm trên `main`" trong workflow.
