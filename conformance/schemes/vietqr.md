# VietQR (NAPAS 247)

**Đặc tả:** NAPAS chưa công bố đặc tả chính thức. Mô tả dưới đây do cộng đồng tổng hợp từ bản "NAPAS QR Switching / IBFT
v1.5.2" lan truyền trên mạng, và từ hai thư viện MIT `vietqr` (Casso, https://github.com/vietqr/vietqr-node) và
`vietnam-qr-pay` (xuannghia, https://github.com/xuannghia/vietnam-qr-pay). Đây không phải tài liệu của NAPAS.

## Cấu trúc (EMVCo merchant-presented)

| Tag | Giá trị | Ghi chú |
|---|---|---|
| `00` | `01` | Payload format indicator |
| `01` | `11` tĩnh, `12` động | `12` khi có số tiền |
| `38` | template | Merchant account information của VietQR |
| `38.00` | `A000000727` | GUID của NAPAS; so không phân biệt hoa thường khi đọc |
| `38.01` | template | `00` = BIN ngân hàng (6 số), `01` = số tài khoản hoặc số thẻ |
| `38.02` | `QRIBFTTA` / `QRIBFTTC` | chuyển vào tài khoản / vào thẻ |
| `53` | `704` | VND |
| `54` | số tiền | chỉ khi có số tiền |
| `58` | `VN` | |
| `62` | template | `08` = nội dung chuyển khoản; các sub-tag khác có thể có ở QR thật |
| `63` | CRC | CRC-16/CCITT-FALSE trên byte UTF-8 từ đầu tới hết `6304`, 4 chữ hex |

QR cá nhân không có tag `52`, `59`, `60`. Khi đọc, tingqr trả lại các tag này nếu có.

## Tạo mã (`encodeVietQr`)

- Thứ tự tag: `00`, `01`, `38`, `53`, `54` (nếu có), `58`, `62` (nếu có), `63`. Cả hai oracle đều dùng thứ tự này.
- BIN: đúng 6 chữ số. Số tài khoản: 3–25 chữ hoặc số (theo `vietqr-node`).
- Số tiền: số nguyên VND dương, 1–13 chữ số, không có số 0 đứng đầu. Chuỗi rỗng coi như không có.
- Nội dung: chỉ ASCII in được (`0x20–0x7E`), tối đa 95 ký tự, vì tag 62 = `08` + `LL` + nội dung ≤ 99. Có dấu thì báo
  `NON_ASCII`, không tự bỏ dấu. Có hàm `removeVietnameseAccents` để dev tự gọi.
- Không thêm tag nào ngoài bảng trên: app ngân hàng có thể từ chối.

## Đọc mã (`decodeVietQr`)

- Không có tag 38 với GUID `A000000727`: `UNSUPPORTED_SCHEME`.
- Thiếu `38.01.00`, `38.01.01` hay `38.02`: `MISSING_TAG`. Mã dịch vụ lạ: `INVALID_VALUE`.
- Tag `00` khác `01` hoặc vắng: `INVALID_VALUE` `00`. Tag `01` vắng: `MISSING_TAG` `01` (mẫu `vietqr-missing-poi`); có
  nhưng khác `11`/`12`: `INVALID_VALUE` `01`. Cả hai chế độ đều vậy. PromptPay và KHQR theo đúng luật này.
- Tag không phải hai chữ số: `BAD_TAG`. Tag 63 không phải đúng 4 chữ hex: `CRC_MISSING`.
- Tag trùng ở cấp đầu hoặc trong `38`, `38.01`, `62`: `DUPLICATE_TAG`, ở cả hai chế độ.
- Chế độ chấp nhận lệch chuẩn (mặc định): thiếu `53` hoặc `58` thì điền `704` / `VN` và cảnh báo `MISSING_OPTIONAL_TAG`.
  Chế độ chặt (`{ mode: 'strict' }`): thiếu thì `MISSING_TAG`.
- Tag `54` trả về nguyên văn (kể cả `50000.00`).
- Khoảng trắng hai đầu (space, tab, CR, LF, BOM `U+FEFF`, no-break space `U+00A0`) được bỏ kèm cảnh báo
  `TRIMMED_WHITESPACE`; CRC viết thường được chấp nhận kèm `LOWERCASE_CRC`.

## Mẫu thử (`vectors/vietqr/`)

- 5 mẫu `valid` sinh bằng `tools/oracle/gen-vietqr.mjs`:
  - 4 mẫu mà `vietqr@1.2.0` và `vietnam-qr-pay@1.5.1` cho ra cùng một chuỗi;
  - `vietqr-card` chỉ có một oracle, vì `genQRText` của `vietqr` luôn ghi `QRIBFTTA`.
- 1 mẫu `valid` từ README của `vietnam-qr-pay` (MIT).
- 3 mẫu `invalid` (CRC sai, tag không phải chữ số, tag 63 không phải 4 chữ hex) và 2 mẫu `lenient` (thiếu tag 58, thiếu
  tag 53) sửa từ các mẫu trên. CRC của mẫu `lenient` được tính lại bằng một hàm Python độc lập.
- 13 mẫu `encode-invalid` (chỉ có `input`, không có chuỗi QR) ghim các luật tạo mã: chữ có dấu, nội dung 96 ký tự hoặc
  không phải chuỗi, số tiền 0 / có số 0 đứng đầu / số lẻ / 14 chữ số, BIN 5 hoặc 7 số / có ký tự lạ / không phải chuỗi,
  số tài khoản quá ngắn, mã dịch vụ lạ. Bản .NET phải chạy đạt các mẫu này.
- Mọi số tài khoản đều là số giả.

## Chưa được kiểm

- **Đã quét bằng app thật** (chủ dự án, 2026-11-21, Samsung Galaxy S22 Ultra, Android 16, trên màn hình và trên giấy; xem `conformance/scans.md`): MB Bank 6.5.31 và MyVIB 1.80.3 đọc đúng QR tĩnh và QR có số tiền tạo cho tài khoản thật, cả bản có logo giữa lẫn không logo. App VIB báo "lỗi không xác định" với mẫu chuyển vào thẻ (`QRIBFTTC`, số thẻ bịa). Chưa thử app ngân hàng nào khác, chưa thử iPhone.
- **Chưa có QR thật nào ngoài mẫu README.** Các biến thể ngoài đời (sub-tag 62 khác, tag 59/60) sẽ thêm ở Plan 2 từ QR
  chụp thật.
