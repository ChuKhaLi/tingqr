# VNPAY-QR

QR thanh toán cho cửa hàng của VNPAY. Có khung EMVCo (merchant-presented), nhưng thông tin merchant nằm ở tag 26 với GUID
riêng, không phải tag 38 của VietQR.

**Đặc tả:** VNPAY không công bố đặc tả công khai. Mô tả dưới đây dựa trên `vietnam-qr-pay` (MIT,
https://github.com/xuannghia/vietnam-qr-pay), bộ duy nhất mà tingqr biết có tạo và đọc VNPAY-QR, và trên QR cửa hàng
công khai trong README của nó.

## Cấu trúc

| Tag | Giá trị | Ghi chú |
|---|---|---|
| `00` | `01` | |
| `01` | `11` / `12` | VNPAY ghi `11` cả khi có số tiền; tingqr đọc là `static`, không cảnh báo |
| `26` | template | `00` = `A000000775` (so không phân biệt hoa thường), `01` = mã merchant; sub-tag khác trả trong `providerData` |
| `52` | MCC | chuẩn EMV yêu cầu; VNPAY ngoài đời thường **không có** |
| `53` | `704` | |
| `54` | số tiền | nguyên văn |
| `58` | `VN` | |
| `59` | tên merchant | |
| `60` | thành phố | chuẩn EMV yêu cầu; VNPAY ngoài đời thường **không có** |
| `62` | template | `01` hoá đơn, `02` số điện thoại, `03` cửa hàng, `04` khách hàng thân thiết, `05` tham chiếu, `06` nhãn khách, `07` máy, `08` nội dung |
| `63` | CRC | như VietQR |

## Đọc mã (`decodeVnpayQr`)

Thứ tự kiểm:

1. CRC và độ dài.
2. Tag `26` với GUID `A000000775`, nếu không có thì `UNSUPPORTED_SCHEME`.
3. `26.01`, nếu thiếu thì `MISSING_TAG`.
4. Tag `00` và `01` như VietQR (thiếu `01`: `MISSING_TAG`, mẫu `vnpay-missing-poi`).
5. Tag `52`, `53`, `58`, `59`, `60` theo thứ tự tăng dần:
   - **Chế độ chấp nhận lệch chuẩn (mặc định):** mỗi tag thiếu thêm một cảnh báo `MISSING_OPTIONAL_TAG`. `53` và `58` được điền
     mặc định `704` và `VN`; `52`, `59`, `60` để trống.
   - **Chế độ chặt (`{ mode: 'strict' }`):** thiếu tag nào thì `MISSING_TAG`. Hầu hết VNPAY-QR ngoài đời sẽ báo lỗi ở
     chế độ này; dùng nó để kiểm mã có đúng chuẩn EMVCo không.

Ngoài ra:
- Tag trùng trong `26` hoặc `62` báo `DUPLICATE_TAG`.
- Tag cấp đầu không được diễn giải trả trong `extraFields`.

## Mẫu thử (`vectors/vnpay/`)

- 3 mẫu `lenient` sinh bằng `tools/oracle/gen-vnpay.mjs`. Chỉ một oracle (`vietnam-qr-pay@1.5.1`), merchant giả.
- 1 mẫu `lenient` từ README của `vietnam-qr-pay`: QR CellphoneS công khai.
- 2 mẫu `invalid` sửa từ các mẫu trên. CRC của mẫu thiếu `26.01` được tính lại bằng hàm Python độc lập.

## Chưa được kiểm

- **Chưa có VNPAY-QR thật nào chụp ở cửa hàng.** Sẽ có ở Plan 2, Task 5.
- **Chưa quét thử bằng app.**
- Chưa có mẫu VNPAY nào có đủ `52`/`60`. Chế độ chặt chỉ được kiểm bằng chuỗi dựng tay trong test đơn vị.
