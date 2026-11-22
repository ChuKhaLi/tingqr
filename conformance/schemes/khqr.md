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
2. Nhận diện (chủ dự án chọn, 2026-11-19), không đạt thì `UNSUPPORTED_SCHEME`:
   - tag `58`, nếu có, phải đúng là `KH`. Một chữ `@` một mình là dấu hiệu yếu: tag 26–51 là template chung, loại QR
     nào cũng có thể dùng;
   - tag `29` hoặc `30` đọc được dạng TLV và có `00` dạng `tên@ngân-hàng` (đúng một `@`, tên và ngân hàng không rỗng).

   AID của PromptPay không bao giờ có `@`, nên **cùng một tag** không bị đọc thành cả hai loại. PromptPay Thái có
   `58 = TH`, nên chỉ chuỗi **không có** tag 58 mới có thể khớp cả hai (xem `detect.md`).
   - Có cả `29` lẫn `30` hợp lệ: lấy `29`, tag `30` nằm trong `extraFields`. Chưa thấy QR nào như vậy.
3. Cửa hàng: thiếu `30.01` hoặc `30.02` thì `MISSING_TAG` ở cả hai chế độ.
4. Tag `00` và `01` như VietQR (thiếu `01`: `MISSING_TAG`, mẫu `khqr-missing-poi`).
5. Tag `52`, `53`, `58`, `59`, `60` theo thứ tự tăng dần:
   - `53` thiếu: `MISSING_TAG` ở **cả hai** chế độ, vì không đoán được là KHR hay USD.
   - **Chế độ chặt:** thiếu tag khác cũng là `MISSING_TAG`.
   - **Chế độ chấp nhận lệch chuẩn (mặc định):** mỗi tag thiếu có một cảnh báo `MISSING_OPTIONAL_TAG`. `58` được điền
     `KH`; `52`, `59`, `60` để trống.
6. `99.00` hoặc `99.01` có mặt nhưng không phải 13 chữ số: chế độ chặt báo `INVALID_VALUE` ở sub-tag đó; chế độ chấp
   nhận lệch chuẩn giữ nguyên văn trong `timestamp`, không điền `createdAt`/`expiresAt`.
7. QR động (`01` = `12`) không có `99.01` đọc được: chế độ chặt báo `MISSING_TAG` `99.01`, chế độ chấp nhận lệch chuẩn
   cảnh báo `MISSING_OPTIONAL_TAG` `99.01`.

Ngoài ra:
- `currency` là tag `53` nguyên văn (mã số ISO 4217), giống mọi loại QR khác. `currencyAlpha` là `KHR` khi `116`, `USD`
  khi `840`; mã khác thì không có `currencyAlpha` (chủ dự án chọn, 2026-11-19).
- `timestamp` giữ mọi sub-tag của `99` nguyên văn. `createdAt`, `expiresAt` chỉ có khi giá trị là 13 chữ số.
- **Hàm đọc không so với giờ hiện tại.** Mọi mẫu động trong test của SDK đã hết hạn từ 2024; nếu hàm đọc tự kiểm thì
  kết quả test thay đổi theo ngày chạy. Muốn kiểm thì gọi `isKhqrExpired(data, nowMs)`: `true` khi `nowMs > expiresAt`
  (như SDK), `undefined` khi không có `expiresAt`.
- Tag trùng trong `29`, `30`, `62`, `64`, `99` báo `DUPLICATE_TAG`. Tag cấp đầu không được diễn giải trả trong
  `extraFields`.

## Tạo mã (`encodeKhqr`)

- **Thứ tự tag như SDK:** `00`, `01`, `29`/`30`, `52`, `53`, `54`, `58`, `59`, `60`, `62`, `64`, `99`, `63`. Sub-tag
  `62` theo thứ tự `01`, `02`, `03`, `07`, `08`. Có `amount` thì `01` là `12`.
- **`currency`** nhận `KHR`/`USD` hoặc mã số `116`/`840` (đúng giá trị `decodeKhqr` trả trong `currency`, nên đọc rồi
  tạo lại được). Giá trị khác: `INVALID_VALUE` tag `53` (chủ dự án chọn, 2026-11-19).
- **Thời gian không lấy từ đồng hồ.** `createdAt` bắt buộc (13 chữ số mili-giây), nên cùng đầu vào luôn cho cùng chuỗi.
  `expiresAt` bắt buộc khi có `amount` và phải lớn hơn `createdAt`.
  - Tag `99` (`00` = `createdAt`, `01` = `expiresAt`) chỉ được ghi khi có `expiresAt`. Như SDK, QR tĩnh không có
    `expiresAt` thì không có tag `99`, nên `createdAt` không xuất hiện trong chuỗi.
- **Số tiền, ghi giống SDK nhưng chặt hơn SDK:** KHR là số nguyên lớn hơn 0. USD lớn hơn 0, tối đa hai chữ số thập phân:
  số nguyên ghi nguyên (`1`), có phần lẻ thì ghi hai chữ số (`1.5` → `1.50`, `'1.0'` → `1.00`), như SDK. Tối đa 13 ký
  tự. Không làm tròn. Khác SDK:
  - KHR dạng chuỗi chỉ nhận chữ số: `'1000.0'` bị từ chối (SDK nhận và ghi `1000`);
  - tingqr bỏ số 0 thừa ở đầu (SDK giữ nguyên với USD số nguyên).
  - Chỉ USD `1.5` có mẫu sinh bằng SDK; USD số nguyên chưa có mẫu từ SDK.
- **Giới hạn độ dài** lấy từ `constant/index.js` của SDK; sai thì `INVALID_VALUE` kèm tag:
  - `bakongAccountId` tối đa 32 ký tự, dạng `tên@ngân-hàng` (`29.00`/`30.00`). "Đúng một `@`" theo
    `helper/checkAccountID.js` của SDK (bộ tạo mã của SDK chỉ đòi có `@`); "tên và ngân hàng không rỗng" là quy tắc
    thêm của tingqr;
  - `accountInformation`, `merchantId`, `acquiringBank` tối đa 32. Cửa hàng bắt buộc `merchantId` (`30.01`) và
    `acquiringBank` (`30.02`). `accountInformation` chỉ dành cho cá nhân, `merchantId` chỉ cho cửa hàng; dùng nhầm thì
    `INVALID_VALUE` ở `29`/`30`;
  - `merchantName` 1–25 (`59`), `merchantCity` tối đa 15, mặc định `Phnom Penh` (`60`), `merchantCategoryCode` 4 chữ
    số, mặc định `5999` (`52`);
  - các trường `62` mỗi trường tối đa 25;
  - `alternateLanguage`: `language` 1–2 chữ cái ASCII, giữ nguyên hoa/thường (`64.00`; độ dài theo SDK `bakong-khqr`,
    chỉ chữ cái vì EMVCo MPM ghi đây là mã ISO 639; mẫu `khqr-encode-language-not-letters`), `merchantName` bắt buộc như
    SDK, tối đa 25 (`64.01`),
    `merchantCity` tối đa 15 (`64.02`).
- **Chữ:** chỉ `alternateLanguage` được có chữ ngoài ASCII (ví dụ Khmer). Trường khác có chữ ngoài ASCII in được thì
  `NON_ASCII`.
- Chưa hỗ trợ tạo tag `15` (UnionPay).

## Mẫu thử (`vectors/khqr/`)

- 5 mẫu chép nguyên văn từ thư mục `test/` của `bakong-khqr@1.0.20` (thư mục này có trong gói npm, kiểm lại được).
  `expected` viết tay, rồi so với các trường mà `BakongKHQR.decode` của SDK tách ra (`node check-khqr.mjs` trong
  `tools/oracle/`). Hàm `decode` của SDK **không kiểm gì** (không CRC, không tag bắt buộc), nên đây chỉ là đối chiếu
  cách tách trường; nhãn `valid`/`lenient` dựa vào quy tắc ở trên. CRC của cả 5 được kiểm bằng `tools/crc16.py`.
  - 3 mẫu `valid`: cá nhân USD có `62`, `64` tiếng Khmer, `99`; cửa hàng cùng nội dung; cửa hàng ACLEDA có `61` và `KM`.
  - 2 mẫu `lenient`: QR động không có `99.01` (KHR `50000.0`; KHR có tag `15` UnionPay).
- 2 mẫu `invalid`: CRC sai; `30.00` bị bỏ `@` (chỉ chứng minh `decodeKhqr` không nhận ra, CRC tính lại bằng
  `tools/crc16.py`).
- 1 mẫu `lenient`: `99.01` không phải 13 chữ số, sửa từ mẫu cá nhân USD, CRC bằng `tools/crc16.py`.
- 4 mẫu `valid` có `input`, sinh bằng `tools/oracle/gen-khqr.mjs`: SDK tạo với `Date.now` gán cố định
  `1731000000000`, `BakongKHQR.verify` của SDK chấp nhận. tingqr phải tạo ra đúng từng byte.
- 6 mẫu `encode-invalid`, mỗi mẫu vi phạm một quy tắc tạo mã ở trên.

## Chưa được kiểm

- **Chưa quét thử bằng app Bakong hay app ngân hàng Campuchia nào.**
- Chưa có KHQR thật chụp ở cửa hàng.
- Chưa có mẫu nào có cả `29` lẫn `30`.
