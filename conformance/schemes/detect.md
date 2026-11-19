# `detect()`: nhận diện loại QR

`detect(payload)` đọc mọi loại QR mà tingqr hỗ trợ và trả kết quả có kiểu theo `scheme`:
`{ scheme, data, alsoMatches }`.

## Cách làm

1. Chuỗi được parse **một lần** (CRC, độ dài, tag trùng). Lỗi ở bước này (`CRC_MISMATCH`, `TRUNCATED`, …) được trả nguyên
   vẹn.
2. Các loại được thử theo thứ tự, mỗi loại ở **chế độ chấp nhận lệch chuẩn**:

   | Thứ tự | `scheme` | Nhận ra bằng |
   |---|---|---|
   | 1 | `vietqr` | tag `38`, `00` = `A000000727` |
   | 2 | `vnpay` | tag `26`, `00` = `A000000775` |
   | 3 | `promptpay` | tag `29`/`30`, `00` = AID `A000000677…` |
   | 4 | `khqr` | tag `29`/`30`, `00` có đúng một `@` |

   Một loại **nhận ra** chuỗi khi hàm đọc của nó không trả `UNSUPPORTED_SCHEME`.
3. Loại đầu tiên nhận ra chuỗi là kết quả. Nếu hàm đọc của loại đó trả lỗi khác (ví dụ `MISSING_TAG`), `detect` trả lỗi
   đó và **không thử loại sau**: chuỗi rõ ràng là loại này, chỉ bị hỏng.
4. `alsoMatches`: các loại **sau** cũng nhận ra chuỗi, theo thứ tự thử, kể cả khi hàm đọc của chúng báo lỗi. Ví dụ QR
   cửa hàng có cả tag `38` VietQR lẫn tag `26` VNPAY cho `{ scheme: 'vietqr', alsoMatches: ['vnpay'] }`; dữ liệu VNPAY
   lấy bằng `decodeVnpayQr`.
5. Không loại nào nhận ra: `UNKNOWN_SCHEME`. `error.fields` chứa các trường cấp đầu đã đọc, để ứng dụng tự xem.

## PromptPay và KHQR dùng chung tag `29`/`30`

PromptPay đặt AID ở sub-tag `00`; KHQR đặt tài khoản Bakong `tên@ngân-hàng`. AID chỉ gồm chữ số hex nên không bao giờ có
`@`, vì vậy hai loại không thể cùng nhận ra một chuỗi. Test `detect.spec.ts` kiểm điều này trên mọi mẫu PromptPay và KHQR.

## Mẫu thử (`vectors/detect/`)

- `scheme: 'detect'`; `expected` chỉ là `{ scheme, alsoMatches }`, vì dữ liệu từng loại đã có mẫu riêng.
- 4 mẫu chép chuỗi từ mẫu đã có của từng loại (`source` trỏ tới mẫu gốc).
- 1 mẫu có cả VietQR lẫn VNPAY, ghép tag `38` và `26` của hai mẫu README `vietnam-qr-pay`, CRC tính bằng Python.
- 1 mẫu `invalid` `UNKNOWN_SCHEME`, dựng tay: tag `29` có AID lạ `A000000999`. Không phải QR thật.
- Ngoài ra, `detect.spec.ts` chạy `detect` trên mọi mẫu `valid` và `lenient` của bốn loại.
