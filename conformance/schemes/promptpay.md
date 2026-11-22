# PromptPay (Thái Lan)

QR thanh toán của Thái Lan theo khung EMVCo (merchant-presented). Có hai dạng: chuyển tiền (tag `29`) và thanh toán hoá
đơn (tag `30`).

**Đặc tả:** "Thai QR Code Payment Standard" của Ngân hàng Thái Lan **chưa đọc được**: trang gốc trả 404, bản lưu trên
Wayback chưa tải được (2026-11-18). Quy tắc dưới đây dựa vào **ba thư viện độc lập, giấy phép MIT**, nhưng mức độ chung
không đều:

- **Cả ba cùng có:** chuyển tiền tag `29` với AID `A000000677010111`, sub-tag `01`–`03`, và các tag cấp đầu.
- **Hai trong ba** (`promptparse`, `thai-qr-payment`): thanh toán hoá đơn tag `30` với AID `A000000677010112`.
- **Chỉ `thai-qr-payment`:** AID OTA `…0114`, AID xuyên biên giới `…2006`, sub-tag `04` (tài khoản ngân hàng) và `05`
  (mã OTA). Ba mẫu `promptpay-tqp-*` vì vậy chỉ dựa vào một thư viện.
- **Lựa chọn của tingqr, không thư viện nào áp:** biller 13 hoặc 15 chữ số, tham chiếu tối đa 20 ký tự, thứ tự ưu tiên
  proxy (xem dưới).

Ba thư viện:

- `promptpay-qr@0.5.0` (dtinth, https://github.com/dtinth/promptpay-qr);
- `promptparse@1.7.1` (maythiwat, https://github.com/maythiwat/promptparse);
- `thai-qr-payment@1.2.0` (uunw, https://github.com/uunw/thai-qr-payment).

## Cấu trúc

| Tag | Giá trị | Ghi chú |
|---|---|---|
| `00` | `01` | |
| `01` | `11` / `12` | có số tiền thì cả ba thư viện ghi `12` |
| `29` | template chuyển tiền | `00` = AID, xem bảng dưới; `01` số điện thoại (`0066` + 9 số), `02` số CMND hoặc mã số thuế (13 số), `03` ví điện tử (15 số), `04` tài khoản ngân hàng (mã ngân hàng 3 số + số tài khoản), `05` mã OTA |
| `30` | template hoá đơn | `00` = AID; `01` mã biller (13 hoặc 15 số), `02` tham chiếu 1, `03` tham chiếu 2 |
| `52` | MCC | QR cá nhân thường không có |
| `53` | `764` (THB) | |
| `54` | số tiền | nguyên văn; các thư viện ghi `30.00`, `4.22`, `100.00` |
| `58` | `TH` | |
| `59`, `60` | tên, thành phố | có thể là chữ Thái; độ dài đếm theo ký tự |
| `62` | template | `07` thường được gọi là "ref3" |
| `63` | CRC | như VietQR |

| AID (sub-tag `00`) | Tag | Ý nghĩa |
|---|---|---|
| `A000000677010111` | `29` | chuyển tiền |
| `A000000677010114` | `29` | chuyển tiền OTA (`ota: true`) |
| `A000000677010112` | `30` | thanh toán hoá đơn |
| `A000000677012006` | `30` | thanh toán hoá đơn xuyên biên giới (`crossBorder: true`) |

**Thứ tự tag:** ba thư viện ghi `53`, `54`, `58` theo ba thứ tự khác nhau (`promptpay-qr` ghi `58` trước `53`). Hàm đọc
chấp nhận mọi thứ tự.

## Đọc mã (`decodePromptPayQr`)

Thứ tự kiểm:

1. CRC và độ dài.
2. Tag `29` có AID chuyển tiền, hoặc tag `30` có AID hoá đơn (so không phân biệt hoa thường). AID của tag này đặt ở tag
   kia không được tính. Không có thì `UNSUPPORTED_SCHEME`. Có cả hai thì lấy `29`, tag `30` nằm trong `extraFields`.
3. Chuyển tiền:
   - `proxyType` là sub-tag đầu tiên có mặt theo thứ tự `01`, `02`, `03`, `04`. `proxy` là giá trị nguyên văn. Thứ tự
     này là lựa chọn của tingqr: `thai-qr-payment` xét `04` trước rồi mới `01`–`03`. Chưa có mẫu nào có hai proxy.
   - `mobile` chỉ điền khi `29.01` có dạng `0066` + 9 số, viết lại thành `0` + 9 số. Dạng khác vẫn có trong `proxy`.
   - Không có sub-tag nào trong `01`–`04`:
     - **Chế độ chấp nhận lệch chuẩn (mặc định):** `proxyType: 'unknown'`, `proxy: ''`, cảnh báo `MISSING_OPTIONAL_TAG` tag `29`.
     - **Chế độ chặt:** `MISSING_TAG` `29.01`.
4. Hoá đơn: thiếu `30.01` thì `MISSING_TAG` ở cả hai chế độ.
5. Tag `00` và `01` như VietQR (thiếu `01`: `MISSING_TAG`, mẫu `promptpay-missing-poi`).
6. Tag `53`, `58`: chế độ chặt thiếu thì `MISSING_TAG`; chế độ chấp nhận lệch chuẩn điền `764` / `TH` kèm cảnh báo.
   Không bắt buộc `52`, `59`, `60`.

Ngoài ra:
- `subFields` chứa mọi sub-tag của `29`/`30` trừ `00`. Tag trùng trong template báo `DUPLICATE_TAG`.
- Tag cấp đầu không được diễn giải (ví dụ `81` của TrueMoney) trả trong `extraFields`.
- **TrueMoney** là ví điện tử (`proxyType: 'eWallet'`, `proxy` bắt đầu bằng `14`). tingqr không gắn nhãn TrueMoney.
- **Chưa xác nhận:** "ref3" ở `62.07` và các trường xuyên biên giới ở `62.08`. tingqr chỉ trả nguyên văn trong
  `additionalData`, không đặt tên.

## Tạo mã (`encodePromptPayQr`)

- **Thứ tự tag:** `00`, `01`, `29`/`30`, `53`, `54` (nếu có), `58`, `63`, tăng dần như EMVCo và như `thai-qr-payment`.
  Có `amount` thì `01` là `12`, không có thì `11`.
- **`mobile`:** bỏ mọi ký tự không phải số, rồi phải còn `0` + 9 số, `66` + 9 số hoặc `0066` + 9 số. Ghi là `0066` + 9 số.
  Sai thì `INVALID_VALUE` tag `29.01`.
- **`nationalId`** đúng 13 chữ số (`29.02`), **`eWallet`** đúng 15 chữ số (`29.03`), **`billerId`** 13 hoặc 15 chữ số
  (`30.01`). Không bỏ dấu gạch: có ký tự không phải số là `INVALID_VALUE`.
- **Chỉ một đích:** `target` có từ hai trong `mobile`, `nationalId`, `eWallet`, `billerId` thì `INVALID_VALUE` tag `29`.
  tingqr không tự chọn một.
- **`reference1`, `reference2`** (`30.02`, `30.03`): ASCII in được (không thì `NON_ASCII`), tối đa 20 ký tự (không thì
  `INVALID_VALUE`). **Giới hạn 20 chưa có nguồn:** không thư viện nào áp giới hạn này, và đặc tả chưa đọc được. Chuỗi
  rỗng coi như không có.
- **Biller 13 hoặc 15 chữ số** cũng là lựa chọn của tingqr; các thư viện không kiểm độ dài biller.
- **`amount`** (`54`): số hoặc chuỗi dạng `^\d{1,10}(\.\d{1,2})?$`, lớn hơn 0. Luôn ghi hai chữ số thập phân (`30.00`),
  bỏ số 0 thừa ở đầu (`0001.5` → `1.50`). Không làm tròn: `1.234` hay `0.1 + 0.2` bị từ chối. Chuỗi rỗng coi như không có
  số tiền.

## Mẫu thử (`vectors/promptpay/`)

- 17 mẫu `valid` chép nguyên văn từ file test của ba thư viện, ở đúng phiên bản trên:
  - `promptpay-qr` `index.test.js`: 6 mẫu.
  - `promptparse` `src/index.test.ts`: 8 mẫu.
  - `thai-qr-payment` `packages/payload/src/builder.test.ts`: 3 mẫu.
- `expected` viết tay, rồi đối chiếu bằng `parse()` của `promptparse` (`node check-promptpay.mjs` trong
  `tools/oracle/`). `promptparse` chỉ đọc tag; nó không phân loại AID. Vì vậy `kind`, `ota`, `crossBorder` (theo bảng
  AID của chính script), `proxyType`, `mobile`, `extraFields` và cảnh báo **không** được oracle kiểm.
- Không mẫu `promptpay-*` nào có trong gói npm của các thư viện; chúng được chép từ file test trên GitHub ở đúng tag
  phiên bản (`v0.5.0`, `1.7.1`, `v1.2.0`). Muốn kiểm lại thì mở các file đó ở tag tương ứng.
- 1 mẫu `invalid`: CRC sai, sửa từ mẫu `promptpay-dtinth-mobile`.
- 5 mẫu `valid` có `input`, sinh bằng `tools/oracle/gen-promptpay.mjs`: builder của `thai-qr-payment` tạo, `parse()` của
  `promptparse` đọc lại khớp từng trường và thứ tự tag. tingqr phải tạo ra đúng từng byte.
- 8 mẫu `encode-invalid`, mỗi mẫu vi phạm một quy tắc tạo mã ở trên.

## Chưa được kiểm

- **Chưa đọc đặc tả Thai QR.**
- **Chưa quét thử bằng app ngân hàng Thái nào.**
- Chưa có QR PromptPay thật chụp ở cửa hàng.
