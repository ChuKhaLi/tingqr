# Plan 3: PromptPay, KHQR, `detect()` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo và đọc PromptPay (Thái Lan) và KHQR (Campuchia); một hàm `detect(payload)` đọc mọi QR mà tingqr hỗ trợ và trả kết quả có kiểu theo `scheme`.

**Architecture:**
- Mỗi loại QR là một module mới trong `@tingqr/core` (`promptpay`, `khqr`), có entry phụ riêng, dùng chung tầng EMV.
- `detect` đọc chuỗi một lần, nhận diện loại QR theo tag và mã định danh, rồi gọi đúng hàm đọc ở chế độ chấp nhận lệch chuẩn.
- **Mẫu thử lấy từ test của các thư viện độc lập:**
  - PromptPay: `promptpay-qr`, `promptparse`, `thai-qr-payment`, đều MIT.
  - KHQR: `bakong-khqr`, SDK chính thức của Ngân hàng Quốc gia Campuchia, ISC.
- Mẫu tạo mã được sinh bằng cách chạy chính các thư viện đó (oracle).

**Tech Stack:** TypeScript, Vitest, Stryker (đã có).

**Spec:** `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 2, 5.2, 5.3; mục 3 nghiên cứu nền cho mã định danh từng nước).

**Nguồn nghiên cứu (2026-11-18):**
- Đặc tả Thai QR của Ngân hàng Thái Lan không còn tải được trên trang của họ (404; có bản lưu trên Wayback nhưng chưa đọc được). Quy tắc PromptPay dưới đây vì vậy lấy từ ba thư viện MIT **cùng khớp nhau**.
- KHQR theo "KHQR SDK Documentation v2.9" (tháng 5/2025) của NBC và mã nguồn SDK `bakong-khqr@1.0.20`.

## Global Constraints

- `@tingqr/core` không có dependency lúc chạy, `src/` không import `node:*`.
- Mọi hàm đọc **mặc định chế độ chấp nhận lệch chuẩn**; chặt phải truyền `{ mode: 'strict' }` (spec 5.3, chủ dự án).
- Độ dài trường đếm theo ký tự (code point); CRC tính trên byte UTF-8. Đã đúng cho mẫu KHQR có tiếng Khmer ở tag 64.
- **Mẫu thử chỉ lấy từ nguồn có giấy phép cho phép:**
  - MIT: `promptpay-qr`, `promptparse`, `thai-qr-payment`.
  - ISC khai báo trong `package.json`: `bakong-khqr`.
  - **Không lấy:** chuỗi trong PDF của NBC (không ghi giấy phép), `Frontware/promptpay` (GPL-3.0), `ts-khqr` (không có file LICENSE, lại là bản port của SDK NBC).
- Không thêm mã lỗi mới, trừ khi ghi rõ ở task (Task 1 thêm thuộc tính `fields` cho `TingQrError`, không thêm mã).
- Điểm mutation ≥ 90%. Gói nén `@tingqr/core` ≤ 40 KB.
- Chạy `node conformance/tools/...` cần chủ dự án cho phép.

## Review Focus

1. **Tag 29 dùng chung giữa PromptPay và KHQR.** PromptPay nhận ra bằng AID `A000000677…` ở sub-tag 00; KHQR nhận ra bằng tài khoản Bakong `tên@ngân-hàng` ở sub-tag 00. Nhận nhầm là lỗi nặng nhất của `detect`. → Task 2, 4, 6.
2. **Thứ tự tag ngoài đời không tăng dần.** Ba oracle PromptPay ghi `53/58/54` theo ba thứ tự khác nhau; KHQR ghi `99` sau `64`. Hàm đọc phải chấp nhận mọi thứ tự. → Task 2, 4.
3. **Số tiền:**
   - PromptPay ghi hai chữ số thập phân (`30.00`).
   - KHQR: KHR chỉ được số nguyên; USD tối đa hai chữ số thập phân.
   - Mẫu cũ có `50000.0`, `1.0`.
   - Khi đọc: giữ nguyên văn. Khi tạo: theo luật của từng loại, sai thì báo `INVALID_VALUE`.
   → Task 3, 5.
4. **KHQR có thời điểm hết hạn (`99.01`).** Hàm đọc không được tự so với giờ hiện tại, vì kết quả sẽ thay đổi theo ngày chạy test. Mọi mẫu động trong test của SDK đã hết hạn từ 2024. Việc kiểm hết hạn là hàm riêng, nhận `now` làm tham số. → Task 4, 5.
5. **Chữ Khmer ở tag 64:** độ dài đếm theo ký tự, CRC theo byte UTF-8. Nếu đếm theo byte, mọi mẫu KHQR có tag 64 sẽ đọc sai. → Task 4.

---

## Cấu trúc file

```
ts/packages/core/src/
├─ errors.ts                          (Task 1: TingQrError.fields)
├─ schemes/promptpay/{types,decode,encode}.ts   (Task 2, 3)
├─ schemes/khqr/{types,decode,encode}.ts        (Task 4, 5)
├─ detect.ts                          (Task 6)
├─ promptpay.ts, khqr.ts              (entry phụ)
└─ index.ts
ts/packages/core/{tsup.config.ts, package.json}  (Task 1: bỏ source map khỏi gói; Task 2, 4: thêm entry)
conformance/
├─ schemes/{promptpay,khqr}.md, schemes/detect.md
├─ vectors/promptpay/*.json, vectors/khqr/*.json, vectors/detect/*.json
└─ tools/oracle/{package.json, gen-promptpay.mjs, gen-khqr.mjs}
```

---

### Task 1: Chuẩn bị: kích thước gói, `TingQrError.fields`, oracle mới

**Files:**
- Modify: `ts/packages/core/tsup.config.ts`, `ts/packages/core/package.json`, `src/errors.ts`, `conformance/tools/oracle/package.json`
- Test: `ts/packages/core/test/errors.spec.ts`

**Interfaces:**
- Produces:
  - `TingQrError` có thêm thuộc tính tuỳ chọn `readonly fields?: TlvNode[]`, kèm tham số thứ tư tuỳ chọn ở constructor.
    - Dùng `declare` như `tag`.
    - Không có `fields` thì **không có** thuộc tính.
  - Gói npm không còn chứa file `.map`.

- [ ] **Step 1: Test.**
  - `new TingQrError('UNKNOWN_SCHEME', 'm', undefined, [{ tag: '00', value: '01' }]).fields` toEqual mảng đó.
  - Không truyền `fields` thì `'fields' in e === false`.
- [ ] **Step 2: Chạy, thấy fail. Viết. Chạy, thấy pass.**
- [ ] **Step 3: Bỏ source map khỏi gói.**
  - `tsup.config.ts`: `sourcemap: false`.
  - Chạy `pnpm build:all && pnpm -C ts check:core`, ghi kích thước trước và sau vào ledger. Kỳ vọng giảm rõ so với 33 KB.
- [ ] **Step 4: Thêm oracle.** `conformance/tools/oracle/package.json` thêm devDependencies ghim cứng:
  - `promptparse` (bản mới nhất, kiểm 1.7.1);
  - `promptpay-qr` 0.5.0;
  - `thai-qr-payment` (bản mới nhất);
  - `bakong-khqr` 1.0.20.

  Chạy `pnpm install` trong thư mục đó. Ghi vào `conformance/README.md` (mục oracle) tên, phiên bản và giấy phép từng gói. `bakong-khqr` ghi rõ "ISC khai báo trong package.json, không có file LICENSE".
- [ ] **Step 5: Commit** — `chore: TingQrError.fields, drop source maps from package, add PromptPay/KHQR oracles`

---

### Task 2: Đọc PromptPay

**Files:**
- Create: `src/schemes/promptpay/types.ts`, `decode.ts`, `src/promptpay.ts`, `conformance/schemes/promptpay.md`, `conformance/vectors/promptpay/*.json`
- Modify: `src/index.ts`, `tsup.config.ts`, `package.json` (`exports["./promptpay"]`), `test/conformance.spec.ts` (`SCHEMES.promptpay`)
- Test: `test/promptpay-decode.spec.ts`

**Interfaces:**

```ts
export const PROMPTPAY_AID = {
  creditTransfer: 'A000000677010111', ota: 'A000000677010114',
  billPayment: 'A000000677010112', billPaymentCrossBorder: 'A000000677012006',
} as const
interface PromptPayCommon {
  initiation: 'static' | 'dynamic'
  amount?: string                     // 54 nguyên văn
  currency: string                    // 53; lenient thiếu thì '764'
  country: string                     // 58; lenient thiếu thì 'TH'
  merchantName?: string; merchantCity?: string; merchantCategoryCode?: string
  additionalData?: Record<string, string>
  extraFields?: Record<string, string>
}
export type PromptPayData = PromptPayCommon & (
  | { kind: 'credit-transfer'; ota: boolean                       // tag 29; ota khi AID …0114
      proxyType: 'mobile' | 'nationalId' | 'eWallet' | 'bankAccount' | 'unknown'  // sub-tag 01/02/03/04 đầu tiên có mặt
      proxy: string                                               // giá trị nguyên văn của sub-tag đó
      mobile?: string                                             // chỉ với 'mobile': '0' + 9 số cuối, ví dụ '0812223333'
      otaCode?: string                                            // 29.05
      subFields: Record<string, string> }                         // mọi sub-tag của 29 trừ 00
  | { kind: 'bill-payment'; crossBorder: boolean                  // tag 30; crossBorder khi AID …2006
      billerId: string; reference1?: string; reference2?: string // 30.01, 30.02, 30.03
      subFields: Record<string, string> }
)
export function decodePromptPayQr(payload: string, options?: { mode?: ParseMode }): Result<PromptPayData>
```

**Quy tắc:**
- **Nhận diện:**
  - Tag `29` có `00` là AID chuyển tiền (`…0111`, `…0114`), hoặc tag `30` có `00` là AID thanh toán hoá đơn (`…0112`, `…2006`).
  - Mỗi tag đọc bằng `readSchemeTemplate` với từng AID, so không phân biệt hoa thường.
  - Không khớp AID nào: `UNSUPPORTED_SCHEME`. Có cả 29 lẫn 30 hợp lệ: lấy 29.
- `30.01` thiếu: `MISSING_TAG` `30.01`. Tag 29 không có sub-tag 01–04: `proxyType 'unknown'`, `proxy` là chuỗi rỗng, kèm cảnh báo `MISSING_OPTIONAL_TAG` tag `29`.
  - **Chế độ chặt:** `MISSING_TAG` `29.01`.
- Tag `00` và `01` kiểm như VietQR. Tag `53`, `58` kiểm như VietQR (chặt: `MISSING_TAG`; chấp nhận lệch chuẩn: mặc định `764` / `TH` kèm cảnh báo). Không bắt buộc `52`, `59`, `60` (QR cá nhân không có).
- Mọi thứ tự tag đều đọc được (Review Focus 2).

- [ ] **Step 1: Mẫu thử `valid`, đọc ở cả hai chế độ.** Chép nguyên văn từ test của oracle, `source` ghi repo, file, giấy phép. `expected` viết tay, rồi đối chiếu bằng `parse()` của `promptparse` (ghi lệnh vào `note`).
  - **dtinth `index.test.js`:**
    - mobile `…6197`
    - mobile `+66` `…29C1`
    - nationalId `…7B5A`
    - taxId `…0CBD`
    - eWallet `…9781`
    - amount 4.22 `…E469`
  - **promptparse `src/index.test.ts`:**
    - mobile `…1DCF`
    - amount 30 `…3CAD`
    - amount 20.15 `…42BE`
    - bill payment có ref1/ref2/ref3 `…780E`
    - bill payment biller 15 số `…3EE7`
    - bill payment có số tiền `…4534`
    - TrueMoney `…7C0F`
    - tên cửa hàng tiếng Thái `…8A01`
  - **thai-qr-payment `builder.test.ts`:**
    - cross-border `…9D1C`
    - bank account `…901D`
    - OTA `…8856`
  - Chuỗi đầy đủ: báo cáo nghiên cứu 2026-11-18 trong lịch sử phiên. Builder chép lại từ file test của từng repo ở đúng phiên bản trên, không chép từ báo cáo.
- [ ] **Step 2: Mẫu `invalid`.** CRC sai, sửa từ mẫu dtinth đầu tiên.
- [ ] **Step 3: Test `promptpay-decode.spec.ts`.**
  - Từng `proxyType`.
  - `mobile` chuẩn hoá thành `'0812223333'`.
  - TrueMoney là `eWallet` với `proxy` bắt đầu `14`. tingqr **không** gọi nó là TrueMoney.
  - Bill payment có ref.
  - OTA: `ota: true`, `otaCode`.
  - Cross-border: `crossBorder: true`.
  - Thứ tự `58` trước `53` vẫn đọc được.
  - Gọi nhầm hàm: chuỗi VietQR → `UNSUPPORTED_SCHEME`; chuỗi KHQR (tag 29 có `@`) → `UNSUPPORTED_SCHEME`.
  - Tag 29 không có 01–04: chế độ chấp nhận lệch chuẩn cho `proxyType 'unknown'` kèm cảnh báo; chế độ chặt báo `MISSING_TAG` `29.01`.
- [ ] **Step 4: Chạy, thấy fail. Viết `types.ts`, `decode.ts`, entry, `exports`, dòng `SCHEMES`. Chạy, thấy pass.**
- [ ] **Step 5: Viết `conformance/schemes/promptpay.md`.**
  - Cấu trúc, quy tắc, nguồn.
  - Ghi rõ đặc tả Thai QR **chưa đọc được**; quy tắc là điểm chung của ba thư viện.
  - "ref3" trong `62.07` và trường xuyên biên giới trong `62.08` **chưa xác nhận**, nên tingqr chỉ trả về nguyên văn trong `additionalData`.
- [ ] **Step 6: Commit** — `feat(promptpay): decode PromptPay credit transfer and bill payment`

---

### Task 3: Tạo PromptPay

**Files:**
- Create: `src/schemes/promptpay/encode.ts`, `conformance/tools/oracle/gen-promptpay.mjs`, `conformance/vectors/promptpay/promptpay-encode-*.json`
- Test: `test/promptpay-encode.spec.ts`

**Interfaces:**

```ts
export type PromptPayTarget =
  | { mobile: string }        // chấp nhận '0812223333', '+66 81-222-3333', '66812223333'; bỏ mọi ký tự không phải số
  | { nationalId: string }    // đúng 13 chữ số (gồm mã số thuế)
  | { eWallet: string }       // đúng 15 chữ số
  | { billerId: string; reference1?: string; reference2?: string }  // biller 13 hoặc 15 chữ số
export interface PromptPayInput { target: PromptPayTarget; amount?: number | string }
export function encodePromptPayQr(input: PromptPayInput): string
```

**Quy tắc tạo mã:**
- **Thứ tự tag:** `00`, `01`, `29`/`30`, `53`, `54` (nếu có), `58`, `63`. Đây là thứ tự tăng dần của EMVCo và trùng với `thai-qr-payment`.
- **`mobile`:** sau khi bỏ ký tự không phải số, chuỗi phải có dạng `0` + 9 số, `66` + 9 số, hoặc `0066` + 9 số. Kết quả ghi là `0066` + 9 số. Sai thì `INVALID_VALUE` tag `29.01`.
- **`nationalId`, `eWallet`, `billerId`:** sai độ dài hoặc có ký tự không phải số thì `INVALID_VALUE` ở sub-tag tương ứng.
- **`reference1`, `reference2`:** ASCII in được, tối đa 20 ký tự. Đây là giới hạn của các oracle; đặc tả chưa đọc được (ruling). Sai thì `INVALID_VALUE` hoặc `NON_ASCII`.
- **`amount`:**
  - Số: lớn hơn 0, tối đa 2 chữ số thập phân, tối đa `9999999999.99`.
  - Chuỗi: `^\d{1,10}(\.\d{1,2})?$`, lớn hơn 0.
  - Luôn ghi hai chữ số thập phân (`30.00`). Sai thì `INVALID_VALUE` tag `54`.
  - Làm tròn số thực: dùng chuỗi, không cộng số thực. Ví dụ `0.1 + 0.2` truyền vào là `0.30000000000000004` thì bị từ chối vì quá 2 chữ số thập phân.
- Có `amount` thì `01` là `12`, không có thì `11`.

- [ ] **Step 1: Oracle `gen-promptpay.mjs`.**
  - Dùng builder của `thai-qr-payment` (cùng thứ tự tag) để sinh mẫu `valid` có `input`, cho các trường hợp:
    - mobile `0812223333`, không số tiền;
    - mobile, số tiền `30`;
    - nationalId `1111111111111`;
    - eWallet `012345678901234`;
    - bill payment biller 15 số có ref1 và ref2, số tiền `3649.22`.
  - Với mỗi chuỗi sinh ra, **đối chiếu** bằng `parse()` của `promptparse`: các trường phải khớp `expected`. Lệch thì dừng.
  - `source` ghi "thai-qr-payment@x (MIT) sinh, promptparse@y (MIT) đọc khớp".
- [ ] **Step 2: Mẫu `encode-invalid`.** mobile 8 số, nationalId 12 số, eWallet có chữ, amount `0`, amount `1.234`, ref1 21 ký tự, ref1 có dấu.
- [ ] **Step 3: Test `promptpay-encode.spec.ts`.**
  - Các dạng nhập số điện thoại cho cùng kết quả.
  - `amount: 30` và `'30'` và `'30.00'` cho cùng kết quả.
  - Mẫu dtinth không số tiền: tingqr tạo cùng trường nhưng khác thứ tự, nên `decodePromptPayQr(encode(x))` khớp `decodePromptPayQr(mẫu dtinth)` (so dữ liệu, không so byte).
- [ ] **Step 4: Chạy, thấy fail. Viết `encode.ts`. Chạy, thấy pass.**
- [ ] **Step 5: Commit** — `feat(promptpay): encode PromptPay QR`

---

### Task 4: Đọc KHQR

**Files:**
- Create: `src/schemes/khqr/types.ts`, `decode.ts`, `src/khqr.ts`, `conformance/schemes/khqr.md`, `conformance/vectors/khqr/*.json`
- Modify: `src/index.ts`, `tsup.config.ts`, `package.json` (`exports["./khqr"]`), `test/conformance.spec.ts` (`SCHEMES.khqr`)
- Test: `test/khqr-decode.spec.ts`

**Interfaces:**

```ts
export interface KhqrData {
  accountType: 'individual' | 'merchant'          // tag 29 | 30
  bakongAccountId: string                         // 29.00 / 30.00, dạng 'tên@ngân-hàng'
  accountInformation?: string                     // 29.01
  merchantId?: string                             // 30.01
  acquiringBank?: string                          // 29.02 / 30.02
  initiation: 'static' | 'dynamic'
  currencyCode: string                            // 53 nguyên văn ('116' | '840' | khác)
  currency?: 'KHR' | 'USD'                         // suy từ currencyCode
  amount?: string                                 // 54 nguyên văn
  merchantCategoryCode?: string; merchantName?: string; merchantCity?: string   // 52, 59, 60
  postalCode?: string                             // 61
  unionPay?: string                               // 15
  country: string                                 // 58; lenient thiếu thì 'KH'
  additionalData?: Record<string, string>
  billNumber?: string; mobileNumber?: string; storeLabel?: string; terminalLabel?: string; purpose?: string  // 62.01/02/03/07/08
  alternateLanguage?: { language?: string; merchantName?: string; merchantCity?: string }  // 64.00/01/02
  createdAt?: number; expiresAt?: number           // 99.00 / 99.01, mili-giây Unix, khi là 13 chữ số
  timestamp?: Record<string, string>               // mọi sub-tag 99 nguyên văn
  extraFields?: Record<string, string>
}
export function decodeKhqr(payload: string, options?: { mode?: ParseMode }): Result<KhqrData>
export function isKhqrExpired(data: KhqrData, nowMs: number): boolean | undefined   // undefined khi không có expiresAt
```

**Quy tắc:**
- **Nhận diện:** tag `29` hoặc `30`, đọc được dạng TLV, có sub-tag `00` chứa đúng một `@` và không phải AID PromptPay. Không thì `UNSUPPORTED_SCHEME`.
  - Có cả 29 lẫn 30 hợp lệ: lấy 29, tag 30 nằm trong `extraFields`. Chưa thấy QR nào như vậy, và không có mã cảnh báo
    phù hợp.
- **Tag bắt buộc** `52`, `53`, `58`, `59`, `60`:
  - Chặt: thiếu thì `MISSING_TAG`.
  - Chấp nhận lệch chuẩn: cảnh báo `MISSING_OPTIONAL_TAG`; `58` mặc định `KH`; `53` không có mặc định (KHR hay USD đều có thể), nên thiếu `53` báo `MISSING_TAG` ở **cả hai** chế độ.
- **QR động (`01` = `12`) phải có `99.01`** (SDK v2.8): chặt thì `MISSING_TAG` `99.01`; chấp nhận lệch chuẩn thì cảnh báo.
- `30.01` hoặc `30.02` thiếu (merchant): `MISSING_TAG`.
- **Hàm đọc không so với giờ hiện tại** (Review Focus 4).
- **Tag 64 và 99** đọc như template; giá trị lạ trong `99` (ví dụ `39CA0264…`) vẫn giữ trong `timestamp`, `createdAt` và `expiresAt` chỉ điền khi là 13 chữ số.
- Mã ngôn ngữ `KM`/`km` giữ nguyên văn.

- [ ] **Step 1: Mẫu thử từ test của `bakong-khqr@1.0.20`** (ISC, khai báo trong `package.json`). `expected` viết tay, đối chiếu bằng `BakongKHQR.decode` của oracle.
  - Cá nhân USD có 62, 64 tiếng Khmer, 99 (`…B73E`).
  - Merchant cùng nội dung (`…A560`).
  - KHR `50000.0` (`…1134`).
  - Merchant ACLEDA có tag 61 và `KM` hoa (`…E313`).
  - Tag 15 UnionPay và KHR động (`…6011`).
    - Đây là QR động **không có** `99.01`, nên là mẫu `lenient`: chặt báo `MISSING_TAG` `99.01`.
- [ ] **Step 2: Mẫu `invalid`.** CRC sai; bỏ `@` khỏi `29.00`. Mẫu thứ hai chỉ chứng minh hàm `decodeKhqr` trả `UNSUPPORTED_SCHEME`, nên `kind: invalid`, `error: UNSUPPORTED_SCHEME`, CRC tính bằng Python độc lập.
- [ ] **Step 3: Test `khqr-decode.spec.ts`.**
  - Tên và thành phố tiếng Khmer ở tag 64 đọc đúng (`ចន ស្មីន`, `ភ្នំពញ`).
  - `createdAt`/`expiresAt` là số.
  - `isKhqrExpired(data, 0) === false`, `isKhqrExpired(data, Date.UTC(2030,0,1)) === true`, không có `expiresAt` thì `undefined`.
  - Chuỗi PromptPay → `UNSUPPORTED_SCHEME`.
  - Thiếu `53` → `MISSING_TAG` ở cả hai chế độ.
  - `99` đứng trước `63` sau `64` vẫn đọc được.
- [ ] **Step 4: Chạy, thấy fail. Viết. Chạy, thấy pass.**
- [ ] **Step 5: Viết `conformance/schemes/khqr.md`.**
  - Cấu trúc, quy tắc, nguồn (SDK Doc v2.9, `bakong-khqr@1.0.20`).
  - Cách đếm độ dài.
  - Tag 99.
  - "Chưa quét bằng app".
- [ ] **Step 6: Commit** — `feat(khqr): decode KHQR (individual and merchant)`

---

### Task 5: Tạo KHQR

**Files:**
- Create: `src/schemes/khqr/encode.ts`, `conformance/tools/oracle/gen-khqr.mjs`, `conformance/vectors/khqr/khqr-encode-*.json`
- Test: `test/khqr-encode.spec.ts`

**Interfaces:**

```ts
export interface KhqrInput {
  accountType: 'individual' | 'merchant'
  bakongAccountId: string              // có đúng một '@', ≤ 32 ký tự
  accountInformation?: string          // individual, ≤ 32
  merchantId?: string                  // merchant: bắt buộc, ≤ 32
  acquiringBank?: string               // merchant: bắt buộc, ≤ 32
  merchantName: string                 // ≤ 25
  merchantCity?: string                // ≤ 15, mặc định 'Phnom Penh'
  merchantCategoryCode?: string        // 4 chữ số, mặc định '5999'
  currency: 'KHR' | 'USD'
  amount?: number | string             // KHR: số nguyên > 0; USD: > 0, tối đa 2 chữ số thập phân
  billNumber?: string; mobileNumber?: string; storeLabel?: string; terminalLabel?: string; purpose?: string  // mỗi cái ≤ 25
  alternateLanguage?: { language: string; merchantName?: string; merchantCity?: string }
  createdAt: number                    // mili-giây Unix, bắt buộc (không đọc đồng hồ: kết quả cố định)
  expiresAt?: number                   // bắt buộc khi có amount, phải > createdAt
}
export function encodeKhqr(input: KhqrInput): string
```

**Quy tắc tạo mã:**
- **Thứ tự tag theo SDK chính thức:** `00`, `01`, `29`/`30`, `52`, `53`, `54`, `58`, `59`, `60`, `62`, `64`, `99`, `63`.
- **Định dạng số tiền giống SDK:**
  - KHR ghi số nguyên.
  - USD có phần lẻ thì ghi hai chữ số thập phân; số nguyên thì để nguyên (`1`).
- **Vi phạm giới hạn** báo `INVALID_VALUE` kèm tag:
  - độ dài các trường;
  - KHR có số lẻ;
  - có `amount` mà thiếu `expiresAt`;
  - `expiresAt` ≤ `createdAt`;
  - `@` sai.
- **Chữ:** chỉ `alternateLanguage` được có chữ không phải ASCII (tag 64); các trường khác chữ ngoài ASCII thì `NON_ASCII`.

- [ ] **Step 1: Oracle `gen-khqr.mjs`.**
  - Chạy `BakongKHQR` của `bakong-khqr@1.0.20` với `Date.now` được gán cố định `1731000000000` trong script.
  - Sinh mẫu `valid` có `input` cho:
    - cá nhân KHR tĩnh;
    - cá nhân USD `1.5` có `expiresAt`;
    - merchant KHR `1000` có 62;
    - cá nhân có tag 64 tiếng Khmer.
  - Kiểm lại từng chuỗi bằng `BakongKHQR.verify` của oracle (bỏ qua lỗi hết hạn, mã 46: ghi rõ trong script).
- [ ] **Step 2: Mẫu `encode-invalid`.**
  - KHR `1.5`;
  - USD `1.234`;
  - có amount không có `expiresAt`;
  - `merchantName` 26 ký tự;
  - `bakongAccountId` không có `@`;
  - merchant thiếu `merchantId`.
- [ ] **Step 3: Test `khqr-encode.spec.ts`.**
  - Cùng đầu vào thì cùng chuỗi (không đọc đồng hồ).
  - `decodeKhqr(encodeKhqr(x))` khớp `x`.
  - USD `1` ghi `5401` + `1`.
- [ ] **Step 4: Chạy, thấy fail. Viết `encode.ts`. Chạy, thấy pass.**
- [ ] **Step 5: Commit** — `feat(khqr): encode KHQR with explicit timestamps`

---

### Task 6: `detect()`

**Files:**
- Create: `src/detect.ts`, `conformance/schemes/detect.md`, `conformance/vectors/detect/*.json`
- Modify: `src/index.ts`, `test/conformance.spec.ts`
- Test: `test/detect.spec.ts`

**Interfaces:**

```ts
export type Detected =
  | { scheme: 'vietqr'; data: VietQrData }
  | { scheme: 'vnpay'; data: VnpayQrData }
  | { scheme: 'promptpay'; data: PromptPayData }
  | { scheme: 'khqr'; data: KhqrData }
export type DetectResult = Detected & { alsoMatches: Detected['scheme'][] }
export function detect(payload: string): Result<DetectResult>
```

**Quy tắc:**
- `parsePayload` một lần. Lỗi CRC hoặc độ dài được đưa ra nguyên vẹn.
- **Thứ tự thử:** `vietqr` (38 + `A000000727`), `vnpay` (26 + `A000000775`), `promptpay` (29/30 + AID `A000000677…`), `khqr` (29/30 + `@`).
- Loại đầu tiên **nhận ra** được (hàm đọc không trả `UNSUPPORTED_SCHEME`) là kết quả, ở chế độ chấp nhận lệch chuẩn.
  - Nếu hàm đọc trả lỗi khác (ví dụ `MISSING_TAG`) thì `detect` trả lỗi đó, không thử loại khác.
- `alsoMatches`: các loại sau cũng nhận ra được chuỗi này. Ví dụ QR cửa hàng có cả VietQR lẫn VNPAY.
- Không loại nào nhận ra: `UNKNOWN_SCHEME`, kèm `error.fields` là các trường cấp đầu đã đọc (Task 1).
- Mẫu thử `vectors/detect/*.json`:
  - dùng `scheme: 'detect'`;
  - `expected` là `{ scheme, alsoMatches }`, vì dữ liệu từng loại đã có mẫu riêng;
  - bộ chạy so `{ scheme, alsoMatches }` của kết quả.

- [ ] **Step 1: Mẫu thử `detect`.**
  - Mỗi loại một mẫu, chép chuỗi từ các mẫu đã có, `source` trỏ tới mẫu gốc.
  - Một QR có cả tag 38 VietQR lẫn tag 26 VNPAY, dựng bằng cách ghép trường của hai mẫu README `vietnam-qr-pay`, CRC tính bằng Python độc lập. `expected` = `{ scheme: 'vietqr', alsoMatches: ['vnpay'] }`.
  - Một mẫu `invalid` `UNKNOWN_SCHEME`: chuỗi EMV có tag 29 với AID lạ, dựng tay, CRC bằng Python, ghi rõ là dựng tay để thử nhánh không nhận ra.
- [ ] **Step 2: Test `detect.spec.ts`.**
  - Mọi mẫu `valid` của bốn loại (đọc từ `conformance/vectors`) cho đúng `scheme`.
  - PromptPay tag 29 không bao giờ ra `khqr`, KHQR tag 29 không bao giờ ra `promptpay` (Review Focus 1).
  - `UNKNOWN_SCHEME` có `error.fields`.
  - CRC sai trả `CRC_MISMATCH`.
- [ ] **Step 3: Chạy, thấy fail. Viết `detect.ts`, thêm `SCHEMES.detect` vào bộ chạy (decode = `detect`, map kết quả về `{ scheme, alsoMatches }`). Chạy, thấy pass.**
- [ ] **Step 4: `conformance/schemes/detect.md`**: thứ tự thử, cách xử lý QR có nhiều loại.
- [ ] **Step 5: Commit** — `feat(core): detect() for VietQR, VNPAY, PromptPay and KHQR`

---

### Task 7: Kiểm toàn bộ, mutation, tài liệu

- [ ] **Step 1:** `pnpm test:all && pnpm typecheck:all && pnpm build:all && pnpm -C ts check:core && pnpm test:recipe` → PASS. Ghi kích thước gói.
- [ ] **Step 2:** `pnpm -C ts/packages/core mutate` → ≥ 90%. Đột biến không tương đương sống sót thì viết test giết nó.
- [ ] **Step 3:** Cập nhật `CLAUDE.md`: trạng thái Plan 3; PromptPay và KHQR **chưa quét bằng app thật**; đặc tả Thai QR chưa đọc được.
- [ ] **Step 4: Commit** — `docs: plan 3 status`
