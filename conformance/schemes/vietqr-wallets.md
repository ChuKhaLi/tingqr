# Ví MoMo và ZaloPay trong VietQR

QR "nhận tiền" của MoMo và ZaloPay là VietQR (tag 38, GUID `A000000727`) chuyển vào một tài khoản do ví quản lý. tingqr
đọc chúng bằng `decodeVietQr`. Trường `provider` cho biết đó là QR của ví nào, **chỉ khi** dấu hiệu đã được một QR thật
chứng minh (spec 5.3).

## Giả thuyết (chưa kiểm trên QR thật)

Nguồn: README của `vietnam-qr-pay` (MIT, https://github.com/xuannghia/vietnam-qr-pay). Các chuỗi trong README do thư viện
đó sinh ra để minh hoạ, không phải QR chụp từ app. Mẫu thử tương ứng: `vectors/vietqr/vietqr-readme-*.json`.

| Ví | BIN | Số tài khoản | Dấu hiệu khác |
|---|---|---|---|
| MoMo (tài khoản mới) | `971025` | bắt đầu `PSP` | `62.05` bắt đầu `MOMOW2W` |
| MoMo (tài khoản cũ) | `970454` (BVBank) | dạng `99MM…` | `62.05` = `MOMOW2W` + 8 số cuối số tài khoản; tag `80` = 3 số cuối số điện thoại |
| ZaloPay | `970454` (BVBank) | dạng `99ZP…` | có tag `26` chưa rõ nghĩa (README bỏ qua) |

**Vì sao không dùng riêng BIN:** `970454` là BIN của BVBank. Một tài khoản BVBank thường có cùng BIN đó. Luật dựa riêng
vào BIN sẽ gắn nhầm mọi QR BVBank thành ví.

## Quan sát từ QR thật

**Chưa có.** Chủ dự án hoãn việc chụp QR thật (2026-11-18). Khi có, làm theo `conformance/README.md` mục "QR thật": bỏ
file vào `conformance/private/`, chạy `node conformance/tools/recipe/extract.mjs`, rồi ghi quan sát vào đây.

## Luật đang bật

**Không có.** `decodeVietQr` chưa bao giờ trả `provider`. Spec 5.3 chỉ cho bật một ví khi có ít nhất một mẫu
`vietqr-real-<ví>-*` chứng minh dấu hiệu nhận diện; các giả thuyết ở trên chưa đủ.

Việc còn lại khi có QR thật (Plan 2, Task 5–6):
- Chạy `extract.mjs`, commit các mẫu `*-real-*`.
- Ghi quan sát vào mục trên, đối chiếu với từng giả thuyết.
- Thêm `VietQrData.provider` và luật nhận diện cho ví có bằng chứng; luật không được dựa riêng vào BIN.
- Test: mọi mẫu ví thật ra đúng `provider`; mọi mẫu ngân hàng (kể cả một QR BVBank thường dựng tay) không có `provider`.
