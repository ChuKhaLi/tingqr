# conformance/

Nguồn sự thật chung cho mọi ngôn ngữ của tingqr. Bản TypeScript (`ts/`) và bản .NET (`dotnet/`, từ v0.2) chạy cùng một
bộ mẫu thử ở đây, nên hai bản cho cùng kết quả trên mọi hành vi có mẫu.

- `vectors.schema.json`: JSON Schema của một file mẫu thử.
- `errors.json`: bảng mã lỗi và mã cảnh báo dùng chung. Không ngôn ngữ nào được có mã ngoài bảng.
- `schemes/<id>.md`: mô tả từng loại QR (tag, GUID, quy tắc, nguồn).
- `vectors/<id>/*.json`: mẫu thử, mỗi file một mẫu, tên file trùng `id`.
- `tools/crc16.py`: CRC-16/CCITT-FALSE viết bằng Python, độc lập với tingqr, để tính lại CRC của mẫu dựng tay hoặc sửa.
- `tools/oracle/`: script chạy các thư viện độc lập để sinh mẫu, có `node_modules` riêng. Phiên bản ghim cứng:

  | Gói | Phiên bản | Giấy phép | Dùng cho |
  |---|---|---|---|
  | `vietqr` | 1.2.0 | MIT | VietQR |
  | `vietnam-qr-pay` | 1.5.1 | MIT | VietQR, VNPAY |
  | `promptpay-qr` | 0.5.0 | MIT (file `LICENSE` trong gói) | PromptPay |
  | `promptparse` | 1.7.1 | MIT (file `LICENSE.md` trong gói) | PromptPay |
  | `thai-qr-payment` | 1.2.0 | MIT (khai báo trong `package.json`; file `LICENSE` có ở repo GitHub `uunw/thai-qr-payment`, không có trong gói npm) | PromptPay |
  | `bakong-khqr` | 1.0.20 | ISC khai báo trong `package.json`, không có file LICENSE (SDK của Ngân hàng Quốc gia Campuchia) | KHQR |
  | Nayuki `qrcodegen.ts` | v1.8.0, commit `720f62b` | MIT (header trong file) | Mẫu ma trận (`vendor/`, file gốc không sửa, kiểm SHA-256 trước khi chạy) |
  | `typescript` | 5.9.3 | Apache-2.0 | Dịch file Nayuki gốc trong `gen-render.mjs` |
- `private/`: QR thật chụp ở máy chủ dự án. **Nằm trong `.gitignore`, không bao giờ commit.**

## Một file mẫu thử

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | có | `^[a-z0-9-]+$`, trùng tên file |
| `scheme` | có | ví dụ `vietqr` |
| `kind` | có | `valid`: đọc ra `expected` ở chế độ chặt (riêng `scheme: detect`, không có chế độ chặt: `detect` đọc ra `expected`). `invalid`: cả hai chế độ đều báo `error`. `lenient`: chế độ chặt báo `error`, chế độ chấp nhận lệch chuẩn đọc ra `expected` kèm `warnings`. `encode-invalid`: tạo mã từ `input` phải báo lỗi `error` (kèm `errorTag` nếu có); không có `payload` |
| `payload` | trừ `encode-invalid` | chuỗi QR, không chứa `\r` |
| `input` | không | chỉ ở `valid`: tạo mã từ `input` phải ra đúng `payload` từng byte, trừ khi `roundTrip: false` |
| `expected` | `valid`, `lenient` | dữ liệu đọc ra |
| `warnings` | `lenient` | mã cảnh báo mong đợi |
| `error` | `invalid`, `lenient`, `encode-invalid` | mã lỗi mong đợi |
| `errorTag` | không | tag kèm lỗi, dạng `62` hoặc `38.01` |
| `source` | có | nguồn: đặc tả (mục, trang), repo kèm giấy phép, oracle kèm phiên bản, hoặc "rút từ QR thật của <loại>, chụp ngày D" |
| `derived`, `derivedFrom` | khi sửa từ mẫu khác | `derivedFrom` là `id` mẫu gốc |
| `note` | không | ghi đã sửa gì, đã chạy lệnh gì |

## Mẫu ma trận (`kind: "matrix"`, `scheme: "render"`)

Dành cho bộ vẽ QR (`@tingqr/render`, sau này `TingQR.Rendering`). Mẫu nằm ở `vectors/render/`.

- `input`: `{ text, ecc?, boostEcc?, minVersion?, maxVersion?, mask? }`. Không có `payload`, không có `error`.
- `expected`: `{ size, version, ecc, mask, rows }`. `rows[y]` là chuỗi `0`/`1`, `1` là ô tối.
- **Quy tắc so sánh:** gọi `toMatrix(input.text, các trường còn lại của input)`. Kết quả phải đúng `size`, `version`,
  `ecc` (mức thực dùng, sau khi nâng) và `mask`, và `rows[y][x] === '1'` khi và chỉ khi `modules[y][x]`.
- Mẫu `encode-invalid` có `scheme: "render"` đặt tuỳ chọn ngay trong `input` (`{ text, ...tuỳ chọn }`). `toMatrix` phải
  ném lỗi có đúng mã `error`.
- Mẫu ma trận chạy bằng bộ chạy riêng của `@tingqr/render`. Bộ chạy của `@tingqr/core` bỏ qua chúng, vì `render` phụ
  thuộc `core`.
- Mẫu ma trận chỉ sinh từ bộ mã hoá Nayuki **gốc** chạy làm oracle, không bao giờ từ code đã port.

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
5. Che giá trị: mỗi vị trí (tính từ cuối trường) có một hoán vị bí mật của 0–9, sinh từ khoá ngẫu nhiên mỗi lần chạy (không lưu). Chữ số được thay theo hoán vị đó,
   trường, nên hai trường có cùng đuôi số vẫn cùng đuôi sau khi che. Chữ cái trong số tài khoản, mã tham chiếu… thành
   `X`/`x`, trừ tiền tố ví đã biết và dạng số tài khoản ví (`99ZP…M…`, `99MM…M…`). Sub-tag `00` của template chỉ giữ
   khi là AID hoặc tên miền ngược. Mỗi lần chạy lại cho chữ số giả khác.
