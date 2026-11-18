# conformance/

Nguồn sự thật chung cho mọi ngôn ngữ của tingqr. Bản TypeScript (`ts/`) và bản .NET (`dotnet/`, từ v0.2) chạy cùng một
bộ mẫu thử ở đây, nên hai bản cho cùng kết quả trên mọi hành vi có mẫu.

- `vectors.schema.json`: JSON Schema của một file mẫu thử.
- `errors.json`: bảng mã lỗi và mã cảnh báo dùng chung. Không ngôn ngữ nào được có mã ngoài bảng.
- `schemes/<id>.md`: mô tả từng loại QR (tag, GUID, quy tắc, nguồn).
- `vectors/<id>/*.json`: mẫu thử, mỗi file một mẫu, tên file trùng `id`.
- `tools/oracle/`: script chạy các thư viện độc lập (giấy phép MIT) để sinh mẫu, có `node_modules` riêng.
- `private/`: QR thật chụp ở máy chủ dự án. **Nằm trong `.gitignore`, không bao giờ commit.**

## Một file mẫu thử

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | có | `^[a-z0-9-]+$`, trùng tên file |
| `scheme` | có | ví dụ `vietqr` |
| `kind` | có | `valid`: đọc ra `expected` ở chế độ chặt. `invalid`: cả hai chế độ đều báo `error`. `lenient`: chế độ chặt báo `error`, chế độ chấp nhận lệch chuẩn đọc ra `expected` kèm `warnings`. `encode-invalid`: tạo mã từ `input` phải báo lỗi `error` (kèm `errorTag` nếu có); không có `payload` |
| `payload` | trừ `encode-invalid` | chuỗi QR, không chứa `\r` |
| `input` | không | chỉ ở `valid`: tạo mã từ `input` phải ra đúng `payload` từng byte, trừ khi `roundTrip: false` |
| `expected` | `valid`, `lenient` | dữ liệu đọc ra |
| `warnings` | `lenient` | mã cảnh báo mong đợi |
| `error` | `invalid`, `lenient`, `encode-invalid` | mã lỗi mong đợi |
| `errorTag` | không | tag kèm lỗi, dạng `62` hoặc `38.01` |
| `source` | có | nguồn: đặc tả (mục, trang), repo kèm giấy phép, oracle kèm phiên bản, hoặc "rút từ QR thật của <loại>, chụp ngày D" |
| `derived`, `derivedFrom` | khi sửa từ mẫu khác | `derivedFrom` là `id` mẫu gốc |
| `note` | không | ghi đã sửa gì, đã chạy lệnh gì |

## Quy tắc nguồn

- Không tự bịa chuỗi QR. Mẫu `invalid` là mẫu `valid` bị sửa, ghi rõ đã sửa gì.
- Nguồn được phép:
  - đặc tả công khai;
  - repo có giấy phép MIT, Apache, BSD;
  - thư viện độc lập chạy làm oracle;
  - "công thức" rút từ QR thật trong `private/` (giá trị nhạy cảm đã thay, CRC tính lại, `derived: true`).
- Không lấy chuỗi từ repo GPL hoặc không ghi giấy phép.
- Mẫu do chính code tingqr sinh ra không phải bằng chứng: nó chỉ chứng minh code đồng ý với chính nó.

## Thêm mẫu

1. Ghi file vào `vectors/<scheme>/<id>.json`.
2. Chạy `pnpm test:all`. Test `conformance-format` kiểm schema, mã lỗi, `id` trùng tên file.
3. Thêm loại QR mới: theo skill `add-scheme` (`.claude/skills/add-scheme/SKILL.md`).
