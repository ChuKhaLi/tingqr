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

## QR thật: chụp ở máy, chỉ commit công thức

1. Bỏ QR thật vào `conformance/private/` (nằm trong `.gitignore`, **không bao giờ commit**). Tên file:
   `<nhãn>__<mô-tả>.(txt|png|jpg)`.
   - `<nhãn>` là `bank`, `momo`, `zalopay`, `vnpay` hoặc `other`: app hay nơi bạn lấy QR. Nhãn này là bằng chứng
     "QR này của ví nào".
   - **`<mô-tả>` trở thành id của mẫu được commit**, nên không được chứa tên người, số điện thoại hay số tài khoản.
     Dùng mô tả chung như `nhan-tien`, `quan-cafe-1`, `mb-1`.
   - File `.txt` chứa đúng một chuỗi QR. Ảnh chụp màn hình QR trong app dễ giải hơn ảnh chụp giấy; hoặc dùng app quét QR
     để chép chuỗi.
2. Chạy (lần đầu cần `pnpm install` trong `conformance/tools/recipe`):

   ```
   node conformance/tools/recipe/extract.mjs
   ```

   - Với mỗi file, công cụ thay số tài khoản, tên, mã tham chiếu bằng giá trị giả. Độ dài, loại ký tự, GUID, BIN và
     tiền tố ví (`PSP`, `MOMOW2W`, `99ZP`, `99MM`) được giữ.
   - CRC được tính lại bằng hàm riêng của công cụ.
   - Kết quả ghi vào `vectors/<scheme>/<scheme>-real-<nhãn>-<mô-tả>.json`, có `derived: true`.
   - `expected` lấy từ bộ đọc của `vietnam-qr-pay` trên chuỗi **đã che**.
   - Công cụ chỉ in tên file và id, không bao giờ in chuỗi QR.
3. `pnpm test:all` chạy thêm `private.spec.ts`: đọc từng QR thật ở chế độ chấp nhận lệch chuẩn. Test này chỉ chạy trên máy
   có `conformance/private/`, và chỉ in tên file.
4. Test của công cụ: `pnpm test:recipe` (chỉ dùng mẫu README công khai; CI cũng chạy).
5. Che giá trị: chữ số được thay bằng khoá bí mật sinh ngẫu nhiên mỗi lần chạy (không lưu), theo vị trí tính từ cuối
   trường, nên hai trường có cùng đuôi số vẫn cùng đuôi sau khi che. Chữ cái trong số tài khoản, mã tham chiếu… thành
   `X`/`x`, trừ tiền tố ví đã biết và dạng số tài khoản ví (`99ZP…M…`, `99MM…M…`). Sub-tag `00` của template chỉ giữ
   khi là AID hoặc tên miền ngược. Mỗi lần chạy lại cho chữ số giả khác.
