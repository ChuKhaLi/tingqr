# Plan 2: VNPAY-QR, ví MoMo/ZaloPay, QR thật ở máy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đọc được VNPAY-QR; nhận ra QR của ví MoMo và ZaloPay khi có bằng chứng từ QR thật; có công cụ biến QR thật ở máy (`conformance/private/`) thành "công thức" commit được.

**Architecture:**
- Thêm module `vnpay` cạnh `vietqr` trong `@tingqr/core`, dùng chung tầng EMV.
- `VietQrData` có thêm `extraFields` (các tag cấp đầu không được diễn giải, ví dụ tag 26 của ZaloPay, tag 80 của MoMo cũ) và `provider`.
- Công cụ `conformance/tools/recipe/` đọc QR thật ở máy, che giá trị nhạy cảm, tính lại CRC bằng hàm riêng (không dùng tingqr), ghi mẫu `derived: true`. `expected` lấy từ bộ đọc của `vietnam-qr-pay` (oracle độc lập) cộng nhãn ví do người chụp ghi.
- Luật nhận diện ví chỉ được bật khi có ít nhất một mẫu rút từ QR thật của ví đó.

**Tech Stack:** TypeScript, Vitest, Stryker (đã có); `node --test` cho công cụ recipe; `jsqr` (Apache-2.0), `pngjs` (MIT), `jpeg-js` (BSD-3) chỉ trong `conformance/tools/recipe/`.

**Spec:** `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 2 "Mục tiêu", 5.2, 5.2a, 5.3). Nền: `docs/huong-di/2026-11-18-nghien-cuu-va-huong-di.md` mục 2.

## Global Constraints

- `@tingqr/core` không có dependency lúc chạy, `src/` không import `node:*` (CI `check:core` kiểm).
- Mọi mã lỗi và cảnh báo nằm trong `conformance/errors.json`. Plan này **không thêm mã mới**.
- **Không tự bịa chuỗi QR.** Nguồn được phép:
  - mẫu README của `vietnam-qr-pay` (MIT);
  - chuỗi do `vietnam-qr-pay@1.5.1` sinh ra (oracle);
  - mẫu sửa từ các mẫu trên;
  - công thức rút từ QR thật trong `conformance/private/`.
- **QR thật không bao giờ được commit, in ra màn hình, hay lọt vào thông báo test.** Công cụ và test chỉ in tên file và kết quả đúng/sai.
- Luật nhận diện ví (`provider`) chỉ gán khi dấu hiệu đã được một mẫu rút từ QR thật chứng minh. Dấu hiệu chỉ có trong README của `vietnam-qr-pay` là **giả thuyết**, ghi trong tài liệu, không bật trong code (spec 5.3).
- Điểm mutation của `@tingqr/core` giữ ≥ 90% (`pnpm -C ts/packages/core mutate`).
- Lệnh chạy công cụ trong `conformance/tools/` thuộc nhóm "hỏi trước" trong `.claude/settings.json`. Executor phải xin phép, không tìm cách lách.

## Review Focus

1. **VNPAY-QR ngoài đời không có tag 52 và 60, tag 01 là `11` dù có số tiền.** `decodeVnpayQr(p, { mode: 'lenient' })` đọc được kèm cảnh báo; chế độ chặt báo `MISSING_TAG` tag `52`. Không được coi `11` có số tiền là lỗi. → Task 2.
2. **Gọi nhầm hàm** (`decodeVietQr` với chuỗi VNPAY và ngược lại) phải trả `UNSUPPORTED_SCHEME`, không phải lỗi khác hay đọc sai. → Task 2.
3. **QR thật bị lộ khi chạy công cụ hoặc test** (in payload, ghi log, thông báo lỗi của Vitest chứa chuỗi). Mọi thông báo chỉ có tên file. → Task 3, Task 4.
4. **Che giá trị làm hỏng cấu trúc:** độ dài trường đổi, ký tự đổi loại (số thành chữ), tiền tố như `PSP`, `MOMOW2W`, `99ZP` bị mất. Công thức phải giữ nguyên độ dài và loại ký tự, giữ tiền tố chữ cái. → Task 3.
5. **Tài khoản BVBank thường bị gắn nhầm là ZaloPay hay MoMo** chỉ vì BIN `970454`. Luật phải dựa vào dấu hiệu khác BIN. → Task 6.

---

## Cấu trúc file

```
conformance/
├─ schemes/vnpay.md                     (Task 2)
├─ schemes/vietqr-wallets.md            (Task 1, Task 6)
├─ vectors/vnpay/*.json                 (Task 2)
├─ vectors/vietqr/*-readme-*.json       (Task 1)
├─ vectors/<scheme>/*-real-*.json       (Task 5: công thức từ QR thật)
├─ tools/oracle/gen-vnpay.mjs           (Task 2)
└─ tools/recipe/
   ├─ package.json                      (Task 3)
   ├─ mask.mjs, crc.mjs, oracle-map.mjs (Task 3)
   ├─ extract.mjs                       (Task 4)
   └─ test/*.test.mjs                   (Task 3, 4)
ts/packages/core/
├─ src/schemes/vietqr/{types,decode}.ts (Task 1, 6: sửa)
├─ src/schemes/vnpay/{types,decode}.ts  (Task 2)
├─ src/vnpay.ts                         (Task 2: entry `@tingqr/core/vnpay`)
├─ test/vnpay-decode.spec.ts            (Task 2)
├─ test/private.spec.ts                 (Task 4)
└─ tsup.config.ts, package.json         (Task 2: thêm entry)
```

---

### Task 1: `extraFields` cho VietQR, mẫu ví từ README

**Files:**
- Modify: `ts/packages/core/src/schemes/vietqr/types.ts`, `src/schemes/vietqr/decode.ts`
- Create:
  - `conformance/vectors/vietqr/vietqr-readme-momo-new.json`
  - `conformance/vectors/vietqr/vietqr-readme-momo-old.json`
  - `conformance/vectors/vietqr/vietqr-readme-zalopay.json`
  - `conformance/vectors/vietqr/vietqr-readme-purpose.json`
  - `conformance/schemes/vietqr-wallets.md`
- Test: `ts/packages/core/test/vietqr-decode.spec.ts`

**Interfaces:**
- Produces: `VietQrData.extraFields?: Record<string, string>`.
  - Chứa mọi tag cấp đầu mà `decodeVietQr` không diễn giải, tức mọi tag ngoài `00 01 38 52 53 54 58 59 60 62 63`.
  - Khoá là mã tag, giá trị nguyên văn. Template không được tách.
  - Không có tag thừa thì **không có** thuộc tính này.

- [ ] **Step 1: Test**
  - Chuỗi README MoMo cũ (`…62190515MOMOW2W34875080` + `8003046` + `6304EBC8`) đọc ra `extraFields` toStrictEqual `{ '80': '046' }` và `additionalData` toStrictEqual `{ '05': 'MOMOW2W34875080' }`.
  - Mẫu README `S` (Plan 1) không có thuộc tính `extraFields` (`'extraFields' in value === false`).
  - Một chuỗi dựng tay có tag `26` và tag `80` trả cả hai trong `extraFields`.
- [ ] **Step 2: Chạy, thấy fail** — `pnpm -C ts/packages/core test vietqr-decode`
- [ ] **Step 3: Sửa `decode.ts`** điền `extraFields` theo quy tắc trên.
- [ ] **Step 4: Thêm 4 mẫu `valid`** (không có `input`, vì encoder không tạo 62.05 và tag 80). Chuỗi chép nguyên văn từ README `vietnam-qr-pay@1.5.1`:
  - `vietqr-readme-momo-new`: `00020101021138620010A000000727013200069710250118PSP1234567890000000208QRIBFTTA53037045802VN62190515MOMOW2W123456786304821F`
  - `vietqr-readme-momo-old`: `00020101021138620010A00000072701320006970454011899MM24011M348750800208QRIBFTTA53037045802VN62190515MOMOW2W3487508080030466304EBC8`
  - `vietqr-readme-zalopay`: `00020101021138620010A00000072701320006970454011899ZP24009M072482670208QRIBFTTA53037045802VN6304073C`
  - `vietqr-readme-purpose`: `00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA5303704540410005802VN62150811Chuyen tien6304BBB8`
  - `expected` viết tay từ chuỗi, đối chiếu với kết quả `new QRPay(payload)` của oracle; ghi lệnh đối chiếu vào `note`.
  - `source` ghi rõ: "vietnam-qr-pay README (MIT); ví dụ do thư viện sinh, **không phải QR thật chụp từ app**".
  - Chưa có `provider` (Task 6 mới thêm).
- [ ] **Step 5: Viết `conformance/schemes/vietqr-wallets.md`**
  - Giả thuyết theo README `vietnam-qr-pay`, ghi rõ là **chưa kiểm** trên QR thật:
    - **MoMo mới:** BIN `971025`, số tài khoản bắt đầu `PSP`, `62.05` bắt đầu `MOMOW2W`.
    - **MoMo cũ:** BIN `970454`, số tài khoản `99MM…`, `62.05` = `MOMOW2W` + 8 số cuối của số tài khoản, tag `80` là 3 số cuối điện thoại.
    - **ZaloPay:** BIN `970454`, số tài khoản `99ZP…`, có tag `26` chưa rõ nghĩa (README bỏ qua nó).
  - Quy tắc bật luật: Task 6.
- [ ] **Step 6: Chạy toàn bộ** — `pnpm test:all` → PASS.
- [ ] **Step 7: Commit** — `feat(vietqr): expose uninterpreted top-level tags as extraFields; wallet README vectors`

---

### Task 2: Đọc VNPAY-QR

**Files:**
- Create:
  - `ts/packages/core/src/schemes/vnpay/types.ts`, `src/schemes/vnpay/decode.ts`, `src/vnpay.ts`
  - `conformance/tools/oracle/gen-vnpay.mjs`
  - `conformance/vectors/vnpay/*.json`
  - `conformance/schemes/vnpay.md`
- Modify: `src/index.ts`, `tsup.config.ts` (thêm entry `src/vnpay.ts`), `package.json` (`exports["./vnpay"]` theo mẫu `./vietqr`), `test/conformance.spec.ts` (thêm `vnpay: { decode: decodeVnpayQr }` vào `SCHEMES`)
- Test: `ts/packages/core/test/vnpay-decode.spec.ts`

**Interfaces:**
- Consumes: `parsePayload`, `getField`, `parseTemplate(value, path)`, `Result`, `Warning`, `ParseMode`.
- Produces:

```ts
export const VNPAY_GUID = 'A000000775'
export interface VnpayQrData {
  merchantId: string                     // 26.01
  providerData?: Record<string, string>  // các sub-tag khác của 26 (trừ 00, 01)
  initiation: 'static' | 'dynamic'       // tag 01; '11' có số tiền vẫn là 'static', không cảnh báo
  amount?: string                        // tag 54 nguyên văn
  currency: string                       // 53; lenient thiếu thì '704'
  country: string                        // 58; lenient thiếu thì 'VN'
  merchantName?: string                  // 59
  merchantCity?: string                  // 60
  merchantCategoryCode?: string          // 52
  additionalData?: Record<string, string>  // mọi sub-tag 62
  billNumber?: string; mobileNumber?: string; store?: string; loyaltyNumber?: string
  reference?: string; customerLabel?: string; terminal?: string; purpose?: string   // 62.01 … 62.08
  extraFields?: Record<string, string>   // tag cấp đầu ngoài 00 01 26 52 53 54 58 59 60 62 63
}
export function decodeVnpayQr(payload: string, options?: { mode?: ParseMode }): Result<VnpayQrData>
```

  **Quy tắc, kiểm theo đúng thứ tự:**
  1. `parsePayload`: lỗi CRC hoặc độ dài được đưa ra nguyên vẹn.
  2. Không có tag `26`, hoặc `26.00` khác `A000000775` (so không phân biệt hoa thường): `UNSUPPORTED_SCHEME`.
  3. Thiếu `26.01`: `MISSING_TAG` tag `26.01`.
  4. `00` khác `01`, hoặc `01` không thuộc {11, 12}: `INVALID_VALUE`.
  5. Tag `52`, `53`, `58`, `59`, `60` theo thứ tự tăng dần.
     - **Chế độ chặt:** thiếu tag nào thì `MISSING_TAG` tag đó.
     - **Chế độ chấp nhận lệch chuẩn:** mỗi tag thiếu thêm một cảnh báo `MISSING_OPTIONAL_TAG` (theo thứ tự tăng dần). `53` và `58` điền mặc định; `52`, `59`, `60` để trống.
  - Tag trùng trong `26` và `62`: `DUPLICATE_TAG` (qua `parseTemplate` có `path`).

- [ ] **Step 1: Test `vnpay-decode.spec.ts`**
  - Mẫu README `V` = `00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685`.
    - **Chế độ chặt:** lỗi `MISSING_TAG` tag `52`.
    - **Chế độ chấp nhận lệch chuẩn:**
      - Đọc ra `merchantId '0105313144'`, `amount '21090000'`, `initiation 'static'`, `merchantName 'CELLPHONES'`, `store 'CPSHN ONLINE'`, `reference '02190806161312785'`, `terminal 'ONLHN'`, `purpose 'CellphoneS'`.
      - Cảnh báo là đúng `[['MISSING_OPTIONAL_TAG','52'], ['MISSING_OPTIONAL_TAG','60']]`.
  - Một chuỗi VNPAY dựng bằng `buildPayload`, có đủ 52/59/60, đọc ở chế độ chặt ra `ok`, không cảnh báo, có `merchantCategoryCode` và `merchantCity`.
  - `decodeVnpayQr(S_vietqr)` trả `UNSUPPORTED_SCHEME`. `decodeVietQr(V)` cũng trả `UNSUPPORTED_SCHEME` (Review Focus 2).
  - Thiếu `26.01`: `MISSING_TAG` `26.01`. Trùng `62.07`: `DUPLICATE_TAG` `62.07`. Có sub-tag `26.02`: nằm trong `providerData`.
  - Entry `@tingqr/core/vnpay` export đúng cùng hàm.
- [ ] **Step 2: Chạy, thấy fail.**
- [ ] **Step 3: Viết `types.ts`, `decode.ts`, `src/vnpay.ts`**, export qua `index.ts`, thêm entry vào tsup và `exports`.
  - Phần đọc tag 62 và các tag merchant dùng chung với VietQR: tách thành helper trong `src/emv/` nếu trùng lặp quá 10 dòng (builder tự quyết, giữ hành vi VietQR không đổi).
- [ ] **Step 4: Chạy, thấy pass.**
- [ ] **Step 5: Viết oracle `gen-vnpay.mjs`** (cùng khung `gen-vietqr.mjs`).
  - Gọi `QRPay.initVNPayQR` của `vietnam-qr-pay@1.5.1`. Đây là oracle **duy nhất** có VNPAY, nên `source` ghi "single oracle".
  - Ghi mẫu `kind: 'lenient'`, `error: 'MISSING_TAG'`, `warnings: ['MISSING_OPTIONAL_TAG','MISSING_OPTIONAL_TAG']`. Lý do: oracle không ghi 52/60, giống VNPAY ngoài đời.
  - `expected` dựng từ đầu vào của trường hợp, không lấy từ tingqr.
  - Các trường hợp (merchant giả):

| id | merchantId | merchantName | store | terminal | amount | purpose | reference | billNumber | mobileNumber |
|---|---|---|---|---|---|---|---|---|---|
| `vnpay-static` | 0123456789 | TINGQR SHOP | TINGQR STORE | TQ01 | – | – | – | – | – |
| `vnpay-amount-purpose-ref` | 0123456789 | TINGQR SHOP | TINGQR STORE | TQ01 | 150000 | TINGQR TEST | REF0001 | – | – |
| `vnpay-bill-mobile` | 0987654321 | TINGQR BILL | BILL STORE | TQ02 | 250000 | – | – | HD0001 | 0900000000 |

  - Chạy: `cd conformance/tools/oracle && pnpm install && node gen-vnpay.mjs` (lệnh này cần chủ dự án cho phép).
- [ ] **Step 6: Thêm mẫu tay**
  - `vnpay-readme-cellphones`: `lenient`, là chuỗi `V`. `source` = README `vietnam-qr-pay` (MIT), ghi rõ "QR cửa hàng công khai trong README".
  - `vnpay-crc-mismatch`: `invalid`, sửa từ `vnpay-readme-cellphones`.
  - `vnpay-missing-merchant-id`: `invalid`, `error: MISSING_TAG`. Bỏ `26.01` khỏi `vnpay-static`, CRC tính bằng Python độc lập như Plan 1, ghi lệnh vào `note`.
- [ ] **Step 7: `conformance/schemes/vnpay.md`**
  - Cấu trúc tag, quy tắc chặt và chấp nhận lệch chuẩn, đặc điểm ngoài đời (không có 52/60, `11` có số tiền).
  - Nguồn, và mục "Chưa được kiểm": chưa quét bằng app.
- [ ] **Step 8: Chạy** — `pnpm test:all && pnpm typecheck:all && pnpm build:all && pnpm -C ts check:core` → PASS.
- [ ] **Step 9: Commit** — `feat(vnpay): decode VNPAY-QR with strict/lenient modes`

---

### Task 3: Công cụ công thức: che giá trị, CRC riêng, ánh xạ oracle

**Files:**
- Create: `conformance/tools/recipe/package.json`, `mask.mjs`, `crc.mjs`, `oracle-map.mjs`, `test/mask.test.mjs`, `test/crc.test.mjs`
- Modify: `conformance/README.md` (mục công cụ recipe)

**Interfaces:**
- Produces:
  - `crc16(payload: string): string`: tự viết, **không import tingqr**.
  - `maskPayload(payload: string): { payload: string; masked: string[] }`.
    - Trả chuỗi đã che và CRC tính lại.
    - `masked` liệt kê đường dẫn tag đã che, ví dụ `['38.01.01', '62.05']`. Không chứa giá trị.
  - `oracleExpected(payload: string): { scheme: 'vietqr' | 'vnpay'; expected: object; missing: string[] }`.
    - Dùng `new QRPay(payload)` của `vietnam-qr-pay`, ánh xạ sang hình dạng `VietQrData` / `VnpayQrData`.
    - `missing` là các tag bắt buộc bị thiếu, tính theo bảng khai báo trong file: vietqr `['53','58']`, vnpay `['52','53','58','59','60']`.

  **Luật che, theo đường dẫn tag:**

  | Luật | Đường dẫn | Cách che |
  |---|---|---|
  | `keep` | `00 01 52 53 54 58 60 63`, mọi `xx.00` (GUID), `38.01.00` (BIN), `38.02` | giữ nguyên |
  | `digits` | `38.01.01`, `26.01`, `62.01` … `62.07`, `80` | thay từng chữ số bằng chữ số giả; giữ nguyên chữ cái (giữ `PSP`, `MOMOW2W`, `99ZP`, `99MM`) |
  | `all` | `59`, `62.08`, mọi đường dẫn không có trong bảng | chữ cái thành `X`, chữ số thành chữ số giả, ký tự khác giữ nguyên |

  - Chữ số giả: xác định theo `(đường dẫn, vị trí)`, ví dụ `(vị trí * 7 + 3) % 10`. Cùng đầu vào luôn ra cùng kết quả.
  - Độ dài và loại ký tự không đổi.
  - Tách template theo `26`, `38`, `38.01`, `62` (và mọi tag 26–51), rồi ghép lại với độ dài 2 chữ số như cũ.

- [ ] **Step 1: Test `crc.test.mjs`** (`node --test`)
  - `crc16('123456789') === '29B1'`.
  - Mẫu README MoMo mới tính ra đúng `821F`.
- [ ] **Step 2: Test `mask.test.mjs`** (dùng chuỗi README, không dùng QR thật)
  - MoMo mới: sau khi che, chuỗi vẫn bắt đầu bằng `…0118PSP`, `62.05` vẫn bắt đầu `MOMOW2W`, phần số khác chuỗi gốc. `masked` toEqual `['38.01.01','62.05']`. Độ dài chuỗi không đổi. CRC cuối khớp `crc16` của thân.
  - ZaloPay: `99ZP` và `M` giữ nguyên, chữ số đổi, BIN `970454` giữ.
  - VNPAY `V`: `59 CELLPHONES` thành `XXXXXXXXXX`; `62.08 CellphoneS` thành `XXXXXXXXXX`; `54` giữ `21090000`; `26.00` giữ.
  - Chạy hai lần ra cùng kết quả.
  - Tag lạ (ví dụ `81`) bị che kiểu `all`.
- [ ] **Step 3: Chạy, thấy fail** — `node --test conformance/tools/recipe/test/`
- [ ] **Step 4: Viết `crc.mjs`, `mask.mjs`, `oracle-map.mjs`.** `package.json` (private, `type: module`):
  - devDependencies ghim cứng `vietnam-qr-pay 1.5.1`, `jsqr`, `pngjs`, `jpeg-js` (bản mới nhất lúc làm, ghim chính xác);
  - script `"test": "node --test test/"`;
  - cài bằng `pnpm install`.
- [ ] **Step 5: Chạy, thấy pass.**
- [ ] **Step 6: Commit** — `feat(recipe): masking, independent CRC and oracle mapping for real-QR recipes`

---

### Task 4: `extract.mjs` và test QR thật ở máy

**Files:**
- Create: `conformance/tools/recipe/extract.mjs`, `conformance/tools/recipe/test/extract.test.mjs`, `ts/packages/core/test/private.spec.ts`
- Modify: `conformance/README.md`

**Interfaces:**
- **Quy ước file trong `conformance/private/`:** `<nhãn-ví>__<mô-tả>.(txt|png|jpg|jpeg)`.
  - `<nhãn-ví>` thuộc `bank | momo | zalopay | vnpay | other`. Nhãn này là bằng chứng do người chụp ghi: "QR này lấy từ app nào".
  - File `.txt` chứa đúng một chuỗi QR.
  - File ảnh được giải bằng `jsqr` (PNG qua `pngjs`, JPG qua `jpeg-js`).
- **`node extract.mjs [--private <dir>] [--out <dir>]`** (mặc định `../../private`, `../../vectors`). Với mỗi file:
  1. Giải ra chuỗi.
  2. `maskPayload`.
  3. `oracleExpected` trên chuỗi **đã che**.
  4. Ghi `vectors/<scheme>/<scheme>-real-<nhãn>-<mô-tả>.json`:
     - `kind` là `valid` nếu `missing` rỗng, ngược lại `lenient` kèm `error: MISSING_TAG` và một `MISSING_OPTIONAL_TAG` cho mỗi tag thiếu;
     - `derived: true`;
     - `source` = `"rút từ QR thật của <nhãn-ví>, chụp ngày <mtime YYYY-MM-DD>; giá trị nhạy cảm đã thay (masked: …), CRC tính lại"`;
     - `note` ghi nhãn ví;
     - nếu nhãn là `momo` hoặc `zalopay` thì `expected.provider` = nhãn.
  - Chỉ in `wrote <id>` hoặc `skip <tên file>: <lý do>`. **Không bao giờ in chuỗi QR**, kể cả chuỗi đã che.
  - File không giải được, hoặc không phải VietQR/VNPAY: in `skip`, không ghi gì.
- **`private.spec.ts`:** nếu `conformance/private/` không tồn tại hoặc không có file `.txt` thì `test.skip`. Ngược lại, mỗi file:
  - Chọn hàm đọc theo GUID (`A000000727` → `decodeVietQr`, `A000000775` → `decodeVnpayQr`), đọc ở chế độ chấp nhận lệch chuẩn, assert `ok`.
  - **Tên test và thông báo assert chỉ chứa tên file.** So sánh bằng `expect(ok, file).toBe(true)`, không bao giờ `toEqual` trên dữ liệu.

- [ ] **Step 1: Test `extract.test.mjs`**
  - Chạy `extract.mjs` với `--private` là một thư mục tạm chứa `momo__readme.txt` (chuỗi README MoMo mới) và `vnpay__readme.txt` (chuỗi `V`), và `--out` là một thư mục tạm.
  - Kiểm:
    - ghi đúng 2 file;
    - mẫu momo có `expected.provider === 'momo'`, `derived === true`;
    - mẫu vnpay có `kind === 'lenient'`;
    - stdout không chứa `PSP1234567890000000` hay `0105313144` (đối chứng: stdout có chứa `wrote`).
- [ ] **Step 2: Chạy, thấy fail.**
- [ ] **Step 3: Viết `extract.mjs`.**
- [ ] **Step 4: Chạy, thấy pass** — `node --test conformance/tools/recipe/test/`.
- [ ] **Step 5: Viết `private.spec.ts`.** Chạy `pnpm test:all`: test này phải **skip** trên máy chưa có `conformance/private/`.
- [ ] **Step 6: `conformance/README.md`**: quy ước tên file, lệnh chạy, cảnh báo không commit, cách lấy chuỗi (chụp màn hình QR trong app tốt hơn chụp ảnh giấy; hoặc dùng app quét QR để chép chuỗi vào `.txt`).
- [ ] **Step 7: Commit** — `feat(recipe): extract recipes from local real QR captures; local-only private test`

---

### Task 5: Chủ dự án chụp QR thật, rút công thức (**cần người**)

Executor **dừng ở đây và hỏi chủ dự án**. Đây là điểm dừng hợp lệ (cần người làm), không phải chỗ để tự quyết.

- [ ] **Step 1: Gửi chủ dự án danh sách cần chụp**, bỏ vào `conformance/private/` theo quy ước ở Task 4:
  - `momo__nhan-tien`: QR "Nhận tiền" trong app MoMo của bạn.
  - `zalopay__nhan-tien`: QR nhận tiền trong app ZaloPay.
  - `bank__<tên-ngân-hàng>`: 1–2 QR nhận tiền từ app ngân hàng của bạn (ví dụ MB).
  - `vnpay__<tên-quán>`: 1–3 QR VNPAY dán ở cửa hàng (chụp rõ, thẳng).
  - Không bắt buộc:
    - `bank__bvbank-thuong`: QR một tài khoản BVBank thường. Rất có ích để tách ZaloPay/MoMo khỏi BVBank (Review Focus 5).
    - `other__viettel-money`, `other__shopeepay`: nếu có.
- [ ] **Step 2: Chạy `node conformance/tools/recipe/extract.mjs`** (xin phép chủ dự án), rồi `pnpm test:all`. Test ở máy chạy cả `private.spec.ts`.
- [ ] **Step 3: Đọc các mẫu `*-real-*` vừa sinh** (đã che, đọc được). Ghi vào `conformance/schemes/vietqr-wallets.md` các dấu hiệu quan sát được ở mỗi ví:
  - BIN, tiền tố số tài khoản, tag `26`, `62.05`, `80`;
  - giả thuyết README nào khớp, cái nào sai.
- [ ] **Step 4: Nếu một mẫu thật không đọc được** (`private.spec.ts` đỏ):
  - Dùng superpowers:systematic-debugging trên **mẫu công thức** tương ứng, không phải trên QR thật.
  - Sửa code, thêm mẫu công thức vào bộ mẫu chung.
- [ ] **Step 5: Commit** — `test(conformance): recipes from real VietQR/VNPAY captures` (chỉ `vectors/**/*-real-*.json` và tài liệu; kiểm `git status` không có gì trong `conformance/private/`).

---

### Task 6: Nhận diện ví `provider`

**Files:**
- Modify: `ts/packages/core/src/schemes/vietqr/types.ts`, `decode.ts`, `conformance/schemes/vietqr-wallets.md`, `conformance/vectors/vietqr/vietqr-readme-momo-*.json`, `vietqr-readme-zalopay.json`
- Test: `ts/packages/core/test/vietqr-wallet.spec.ts`

**Interfaces:**
- Produces: `VietQrData.provider?: 'momo' | 'zalopay'`.

  **Luật bật một ví** (spec 5.3): chỉ khi có ít nhất một mẫu `*-real-<ví>-*` (Task 5) và dấu hiệu dùng để nhận diện có mặt trong mẫu đó. Dấu hiệu phải **không chỉ là BIN**:
  - BIN `970454` là của BVBank.
  - BIN `971025` chỉ được dùng nếu mẫu thật cho thấy nó đi kèm dấu hiệu khác.

  Luật cụ thể (BIN, tiền tố số tài khoản, tag) lấy từ quan sát ở Task 5, Step 3, và được viết vào `vietqr-wallets.md` **trước** khi code.
  - Ví không có mẫu thật thì không bật. Giả thuyết README của ví đó giữ nguyên trong tài liệu, ghi "chưa kiểm".
  - Nếu chủ dự án không chụp được ví nào thì Task 6 chỉ cập nhật tài liệu. Ghi `Ruling:` vào ledger và sang Task 7.

- [ ] **Step 1: Test `vietqr-wallet.spec.ts`**
  - Mỗi mẫu `*-real-momo-*` hoặc `*-real-zalopay-*` (đọc từ `conformance/vectors`, không dùng QR thật) ra đúng `provider`.
  - Mỗi mẫu `bank` (gồm `vietqr-readme-sample`, mọi mẫu oracle Plan 1, và `*-real-bank-*` nếu có) **không có** `provider`.
  - Một mẫu dựng tay BIN `970454` với số tài khoản không có tiền tố ví và không có dấu hiệu ví: **không có** `provider` (Review Focus 5).
- [ ] **Step 2: Chạy, thấy fail.**
- [ ] **Step 3: Viết luật trong `decode.ts`.** Luật đặt trong một bảng dữ liệu, kèm chú thích trỏ tới mục tương ứng trong `vietqr-wallets.md`.
- [ ] **Step 4: Sửa `expected`** của các mẫu README ví nếu luật đã bật khớp với chúng. Không khớp thì để nguyên, ghi `note`.
- [ ] **Step 5: Chạy, thấy pass**; chạy `pnpm -C ts/packages/core mutate` → ≥ 90%. Đột biến mới sống sót thì viết test giết nó.
- [ ] **Step 6: Commit** — `feat(vietqr): recognise MoMo/ZaloPay wallets from real-capture evidence`

---

### Task 7: Tài liệu, mutation, trạng thái

**Files:**
- Modify: `CLAUDE.md`, `ts/CLAUDE.md` (nếu đột biến tương đương mới), `conformance/schemes/vietqr.md`

- [ ] **Step 1:** `pnpm test:all && pnpm typecheck:all && pnpm build:all && pnpm -C ts check:core && node --test conformance/tools/recipe/test/` → PASS. Ghi số test.
- [ ] **Step 2:** `pnpm -C ts/packages/core mutate` → ≥ 90%. Ghi điểm.
- [ ] **Step 3:** Cập nhật `CLAUDE.md`:
  - trạng thái Plan 2;
  - ví nào đã bật nhận diện, dựa trên mẫu nào;
  - VNPAY chưa quét bằng app;
  - bước tiếp là Plan 3.
- [ ] **Step 4: Commit** — `docs: plan 2 status`
