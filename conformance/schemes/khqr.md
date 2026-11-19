# KHQR (Campuchia, Bakong)

QR thanh toán của Campuchia theo khung EMVCo (merchant-presented), do Ngân hàng Quốc gia Campuchia (NBC) quản lý qua hệ
thống Bakong. Có hai dạng: cá nhân (tag `29`) và cửa hàng (tag `30`).

**Nguồn:**
- "KHQR SDK Documentation v2.9" (NBC, tháng 5/2025), tại `bakong.nbc.gov.kh/download/KHQR/integration/`. Chỉ dùng để
  hiểu quy tắc. **Không chép chuỗi mẫu từ PDF**, vì PDF không ghi giấy phép.
- `bakong-khqr@1.0.20`: SDK JavaScript chính thức của NBC, giấy phép ISC khai báo trong `package.json`, không có file
  LICENSE. Dùng làm oracle và làm nguồn mẫu thử (file trong thư mục `test/` của gói).

## Cấu trúc

| Tag | Giá trị | Ghi chú |
|---|---|---|
| `00` | `01` | |
| `01` | `11` / `12` | `12` (động) phải có thời điểm hết hạn `99.01` (từ SDK v2.8) |
| `15` | UnionPay | trả về `unionPay` |
| `29` | template cá nhân | `00` tài khoản Bakong `tên@ngân-hàng`, `01` thông tin tài khoản, `02` ngân hàng |
| `30` | template cửa hàng | `00` tài khoản Bakong, `01` mã cửa hàng (bắt buộc), `02` ngân hàng (bắt buộc) |
| `52` | MCC | bắt buộc |
| `53` | `116` (KHR) / `840` (USD) | bắt buộc, không có mặc định |
| `54` | số tiền | nguyên văn; mẫu cũ có `50000.0`, `1.0` |
| `58` | `KH` | bắt buộc |
| `59`, `60` | tên, thành phố | bắt buộc |
| `61` | mã bưu điện | |
| `62` | template | `01` hoá đơn, `02` số điện thoại, `03` cửa hàng, `07` máy, `08` mục đích |
| `64` | template ngôn ngữ khác | `00` mã ngôn ngữ (`km` hoặc `KM`, giữ nguyên văn), `01` tên, `02` thành phố; thường là chữ Khmer |
| `99` | template thời gian | `00` thời điểm tạo, `01` thời điểm hết hạn, mili-giây Unix 13 chữ số |
| `63` | CRC | như VietQR |

**Thứ tự tag:** SDK ghi `99` sau `64`, ngay trước `63`. Hàm đọc chấp nhận mọi thứ tự.

**Độ dài:** đếm theo ký tự (code point), không theo byte. CRC tính trên byte UTF-8. Chữ Khmer ở tag `64` là chỗ hai cách
đếm khác nhau: `ចន ស្មីន` dài 8 ký tự nhưng 22 byte. Đếm theo byte thì mọi mẫu có tag `64` đều đọc sai.

## Đọc mã (`decodeKhqr`)

Thứ tự kiểm:

1. CRC và độ dài.
2. Tag `29` hoặc `30` đọc được dạng TLV và có `00` chứa **đúng một** `@`. Không có thì `UNSUPPORTED_SCHEME`. AID của
   PromptPay ở cùng vị trí không bao giờ có `@`, nên PromptPay không bị nhận nhầm là KHQR.
   - Có cả `29` lẫn `30` hợp lệ: lấy `29`, tag `30` nằm trong `extraFields`. Chưa thấy QR nào như vậy.
3. Cửa hàng: thiếu `30.01` hoặc `30.02` thì `MISSING_TAG` ở cả hai chế độ.
4. Tag `00` và `01` như VietQR.
5. Tag `52`, `53`, `58`, `59`, `60` theo thứ tự tăng dần:
   - `53` thiếu: `MISSING_TAG` ở **cả hai** chế độ, vì không đoán được là KHR hay USD.
   - **Chế độ chặt:** thiếu tag khác cũng là `MISSING_TAG`.
   - **Chế độ chấp nhận lệch chuẩn (mặc định):** mỗi tag thiếu có một cảnh báo `MISSING_OPTIONAL_TAG`. `58` được điền
     `KH`; `52`, `59`, `60` để trống.
6. QR động (`01` = `12`) không có `99.01`: chế độ chặt báo `MISSING_TAG` `99.01`, chế độ chấp nhận lệch chuẩn cảnh báo.

Ngoài ra:
- `currency` suy từ `53`: `116` là `KHR`, `840` là `USD`, mã khác thì không có `currency` (vẫn có `currencyCode`).
- `timestamp` giữ mọi sub-tag của `99` nguyên văn. `createdAt`, `expiresAt` chỉ có khi giá trị là 13 chữ số.
- **Hàm đọc không so với giờ hiện tại.** Mọi mẫu động trong test của SDK đã hết hạn từ 2024; nếu hàm đọc tự kiểm thì
  kết quả test thay đổi theo ngày chạy. Muốn kiểm thì gọi `isKhqrExpired(data, nowMs)`: `true` khi `nowMs > expiresAt`
  (như SDK), `undefined` khi không có `expiresAt`.
- Tag trùng trong `29`, `30`, `62`, `64`, `99` báo `DUPLICATE_TAG`. Tag cấp đầu không được diễn giải trả trong
  `extraFields`.

## Mẫu thử (`vectors/khqr/`)

- 5 mẫu chép nguyên văn từ thư mục `test/` của `bakong-khqr@1.0.20`. `expected` viết tay, rồi đối chiếu bằng
  `BakongKHQR.decode` của SDK (`node check-khqr.mjs` trong `tools/oracle/`). CRC của cả 5 được kiểm lại bằng hàm Python
  độc lập.
  - 3 mẫu `valid`: cá nhân USD có `62`, `64` tiếng Khmer, `99`; cửa hàng cùng nội dung; cửa hàng ACLEDA có `61` và `KM`.
  - 2 mẫu `lenient`: QR động không có `99.01` (KHR `50000.0`; KHR có tag `15` UnionPay).
- 2 mẫu `invalid`: CRC sai; `30.00` bị bỏ `@` (chỉ chứng minh `decodeKhqr` không nhận ra, CRC tính lại bằng Python).

## Chưa được kiểm

- **Chưa quét thử bằng app Bakong hay app ngân hàng Campuchia nào.**
- Chưa có KHQR thật chụp ở cửa hàng.
- Chưa có mẫu nào có cả `29` lẫn `30`.
