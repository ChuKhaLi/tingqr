# Plan 1: Nền móng và VietQR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng repo tingqr (setup Claude Code, định dạng `conformance/`, gói `@tingqr/core`) và làm xong tạo + đọc VietQR, có mẫu thử lấy từ hai bộ tạo mã độc lập có giấy phép MIT.

**Architecture:** Repo một khối chia theo ngôn ngữ (cách A). `conformance/` là nguồn sự thật chung: JSON Schema cho mẫu thử, bảng mã lỗi, mô tả loại QR, mẫu thử. `@tingqr/core` có tầng EMV (TLV, CRC, đọc chặt / chấp nhận lệch chuẩn) và module `vietqr` dựng trên tầng đó. Một bộ chạy mẫu thử đọc mọi file trong `conformance/vectors/` để bản .NET (Plan 8) dùng lại đúng cách kiểm này.

**Tech Stack:** pnpm 10 workspace, TypeScript 5 (strict), tsup (ESM + CJS + `.d.ts`), Vitest, Ajv (chỉ devDependency), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-18-tingqr-design.md` (đọc mục 2, 3, 5.1–5.3, 5.9, 5.10). Nền: `docs/huong-di/2026-11-18-nghien-cuu-va-huong-di.md` mục 2.

## Lộ trình các plan (để biết plan này dừng ở đâu)

1. **Plan 1 (file này):** nền móng, setup Claude Code, tầng EMV, VietQR, CI TypeScript.
2. Plan 2: VNPAY-QR, nhận diện MoMo/ZaloPay, công cụ QR thật ở máy (`conformance/private/` → "công thức", spec 5.2a). Cần chủ dự án chụp QR thật.
3. Plan 3: PromptPay, KHQR, `detect()`.
4. Plan 4: vẽ SVG (port bộ mã hoá QR có giấy phép MIT).
5. Plan 5: danh sách ngân hàng, link mở app, `@tingqr/bank-logos`, skill `update-banks` và Action hằng tháng.
6. Plan 6: `@tingqr/angular`, `@tingqr/nestjs`, thử trong Noel tree.
7. Plan 7: README, bảng thử trên app thật, phát hành npm qua OIDC, skill `release-drill` → **v0.1**.
8. Plan 8: bản .NET (`TingQR.Core`, `TingQR.AspNetCore`, `TingQR.BankLogos`), `dotnet/CLAUDE.md`, `ci-dotnet` → **v0.2**.

## Global Constraints

- Lõi `@tingqr/core` **không có dependency lúc chạy** (`dependencies: {}`); chạy được trên trình duyệt, Node và Workers: không import `node:*` trong `src/`.
- Node ≥ 20 (`"engines": { "node": ">=20" }`), tsup `target: 'es2022'`.
- Giấy phép MIT, dòng bản quyền: `Copyright (c) 2026 Chung Nguyen` (giống `../zkteco-protocol/LICENSE`).
- Tài liệu viết tiếng Việt; code, tên gói, API, thông báo lỗi bằng tiếng Anh.
- Không tự bịa chuỗi QR. Mỗi mẫu thử có `source`. Mẫu `invalid` được tạo bằng cách sửa một mẫu `valid` và ghi rõ đã sửa gì.
- Không lấy chuỗi hay code từ repo GPL hoặc không ghi giấy phép. `vietqr@1.2.0` (MIT, Casso) và `vietnam-qr-pay@1.5.1` (MIT, xuannghia) được phép **chạy** để sinh mẫu.
- Mã lỗi là bảng chung trong `conformance/errors.json`; TypeScript không được có mã nào ngoài bảng.
- CRC: CRC-16/CCITT-FALSE (đa thức `0x1021`, khởi tạo `0xFFFF`), tính trên byte UTF-8 của mọi ký tự từ đầu tới hết `6304`, in 4 chữ hex **hoa**. Giá trị kiểm chuẩn: `crc16("123456789") === "29B1"`.
- Mọi file văn bản dùng LF; file trong `conformance/vectors/` không bị git đổi xuống dòng (`-text`).
- Không chạy `npm publish`, `git push` trong plan này.

## Review Focus

1. **QR có xuống dòng CRLF hoặc khoảng trắng ở cuối** (chép từ máy quét, file lưu trên Windows): `decodeVietQr` vẫn đọc được, kèm cảnh báo `TRIMMED_WHITESPACE`; không bao giờ báo `CRC_MISMATCH` vì `\r\n`. → test ở Task 4.
2. **CRC viết thường** (`6304ae9f`) trong QR thật: đọc chấp nhận, so CRC không phân biệt hoa thường. → test ở Task 4.
3. **Nội dung chuyển khoản có dấu** (`"Chuyển tiền"`): `encodeVietQr` ném `NON_ASCII`, thông báo nhắc `removeVietnameseAccents`; không tự sửa nội dung. → test ở Task 5.
4. **Trường dài đúng 99 và 100 ký tự**: 99 qua, 100 ném `FIELD_TOO_LONG` (lỗi issue #15 của `vietnam-qr-pay`). → test ở Task 3 (tầng TLV) và Task 5 (nội dung VietQR ở mốc 95/96 ký tự).
5. **Số tiền không hợp lệ khi tạo** (`0`, `-1`, `1.5`, `"50,000"`, 14 chữ số): ném `INVALID_VALUE`. Khi đọc thì giữ nguyên chuỗi tag 54 (kể cả `"50000.00"`). → test ở Task 5 và Task 6.

---

## Cấu trúc file

```
tingqr/
├─ .gitattributes                         (Task 1)
├─ LICENSE                                (Task 1)
├─ package.json                           (Task 1: lệnh gom chung)
├─ CLAUDE.md                              (Task 1: sửa)
├─ .claude/settings.json                  (Task 1)
├─ .claude/agents/evidence-review.md      (Task 1)
├─ .claude/agents/parity-review.md        (Task 1)
├─ .claude/skills/add-scheme/SKILL.md     (Task 1)
├─ conformance/
│  ├─ README.md                           (Task 2)
│  ├─ vectors.schema.json                 (Task 2)
│  ├─ errors.json                         (Task 2)
│  ├─ schemes/vietqr.md                   (Task 7)
│  ├─ vectors/vietqr/*.json               (Task 7)
│  └─ tools/oracle/{package.json, gen-vietqr.mjs}   (Task 7)
├─ ts/
│  ├─ CLAUDE.md, package.json, pnpm-workspace.yaml, tsconfig.base.json   (Task 1)
│  └─ packages/core/
│     ├─ package.json, tsconfig.json, tsup.config.ts, vitest.config.ts   (Task 1)
│     ├─ src/index.ts                     (Task 1, mở rộng dần)
│     ├─ src/vietqr.ts                    (Task 5: entry phụ `@tingqr/core/vietqr`)
│     ├─ src/errors.ts                    (Task 3)
│     ├─ src/emv/crc.ts                   (Task 3)
│     ├─ src/emv/tlv.ts                   (Task 3)
│     ├─ src/emv/payload.ts               (Task 4)
│     ├─ src/text.ts                      (Task 5)
│     ├─ src/schemes/vietqr/{types.ts, encode.ts, decode.ts}   (Task 5, 6)
│     └─ test/*.spec.ts
└─ .github/workflows/ci-ts.yml            (Task 8)
```

---

### Task 1: Khung repo và setup Claude Code

**Files:**
- Create: `.gitattributes`, `LICENSE`, `package.json`, `.claude/settings.json`, `.claude/agents/evidence-review.md`, `.claude/agents/parity-review.md`, `.claude/skills/add-scheme/SKILL.md`, `ts/CLAUDE.md`, `ts/package.json`, `ts/pnpm-workspace.yaml`, `ts/tsconfig.base.json`, `ts/packages/core/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,src/index.ts}`
- Modify: `CLAUDE.md`
- Test: `ts/packages/core/test/smoke.spec.ts`

**Interfaces:**
- Produces: lệnh `pnpm test:all`, `pnpm build:all`, `pnpm typecheck:all` ở gốc; `pnpm -C ts test|build|typecheck`; gói `@tingqr/core` build ra `dist/index.{js,cjs,d.ts}`.

- [ ] **Step 1: Viết file cấu hình gốc**
  - `.gitattributes`: `* text=auto eol=lf`, `conformance/vectors/** -text`, `*.png binary`, `*.webp binary`.
  - `LICENSE`: MIT, dòng bản quyền ở Global Constraints.
  - `package.json` gốc: `"private": true`, `"packageManager": "pnpm@10.34.1"`, scripts `test:all` = `pnpm -C ts test`, `build:all` = `pnpm -C ts build`, `typecheck:all` = `pnpm -C ts typecheck`. (Plan 8 nối thêm lệnh dotnet.)

- [ ] **Step 2: Viết workspace TypeScript**
  - `ts/pnpm-workspace.yaml`: `packages: ['packages/*']`.
  - `ts/package.json`: private; scripts `test`, `build`, `typecheck` chạy `pnpm -r <lệnh>`; devDependencies `typescript ^5.7`, `tsup ^8.3`, `vitest ^2.1`, `@types/node ^22` (chỉ cho test).
  - `ts/tsconfig.base.json`: chép `compilerOptions` của `../zkteco-protocol/tsconfig.json`, đổi `lib` thành `["ES2022"]` và **bỏ** `"types": ["node"]` (src không được dùng API Node); file tsconfig của test thêm lại `types: ["node"]`.
  - `ts/packages/core/package.json`: `name: "@tingqr/core"`, `version: "0.0.0"`, `type: "module"`, `sideEffects: false`, `dependencies: {}`, `engines.node: ">=20"`, `files: ["dist"]`, `exports` có `"."` và `"./vietqr"`, mỗi cái có `import` (`.js` + `.d.ts`) và `require` (`.cjs` + `.d.cts`) theo mẫu `exports` của zkteco; scripts `build: tsup`, `test: vitest run`, `typecheck: tsc --noEmit`.
  - `tsup.config.ts`: `entry: ['src/index.ts', 'src/vietqr.ts']`, `format: ['esm','cjs']`, `dts: true`, `target: 'es2022'`, `clean: true`, `sourcemap: true`. Task 1 tạo `src/vietqr.ts` rỗng (`export {}`) để build chạy.
  - `vitest.config.ts`: `include: ['test/**/*.spec.ts']`.

- [ ] **Step 3: Viết test khói `test/smoke.spec.ts`**

```ts
import { VERSION } from '../src/index.js'
test('core exports a version string', () => { expect(VERSION).toMatch(/^\d+\.\d+\.\d+/) })
```

- [ ] **Step 4: Chạy để thấy test fail**

Run: `pnpm -C ts install && pnpm test:all`
Expected: FAIL, `VERSION` không tồn tại.

- [ ] **Step 5: `src/index.ts` export `const VERSION = '0.0.0'`**

- [ ] **Step 6: Chạy lại test, typecheck, build**

Run: `pnpm test:all && pnpm typecheck:all && pnpm build:all`
Expected: 1 test PASS; có `ts/packages/core/dist/index.js`, `index.cjs`, `index.d.ts`, `vietqr.js`.

- [ ] **Step 7: Setup Claude Code** (spec 5.10)
  - `.claude/settings.json`: theo khung `../zkteco-protocol/.claude/settings.json`.
    - `allow`: `Bash(pnpm install*)`, `Bash(pnpm test*)`, `Bash(pnpm build*)`, `Bash(pnpm typecheck*)`, `Bash(pnpm -C ts *)`, `Bash(npx vitest*)`, `Bash(npx tsc*)`, `Bash(dotnet build*)`, `Bash(dotnet test*)`, `Bash(dotnet restore*)`, `Bash(node conformance/tools/*)`, các lệnh git chỉ đọc (`status`, `diff`, `log`, `show`, `branch`), `Bash(gh run list*)`, `Bash(gh run view*)`, `Bash(gh pr list*)`, `Bash(gh issue list*)`.
    - `ask`: `Bash(npm publish*)`, `Bash(pnpm publish*)`, `Bash(dotnet nuget push*)`, `Bash(git push*)`.
    - `deny`: `Read(./conformance/private/**)`. Lý do: QR thật chỉ được đọc qua script rút công thức, không được lọt vào ngữ cảnh rồi vào commit.
  - `.claude/agents/evidence-review.md`: chép từ `../zkteco-protocol/.claude/agents/evidence-review.md`, rồi viết lại:
    - Đoạn mở đầu, theo khung tingqr: "sản phẩm là bằng chứng rằng chuỗi QR đúng định dạng và app ngân hàng đọc được". Các nguồn bằng chứng là mẫu có `source`, oracle MIT, QR thật ở máy, bảng thử trên app thật.
    - Mục ví dụ: thay bằng các dạng lỗi của tingqr. Ví dụ: mẫu thử sinh bởi chính code đang test (vòng tròn); ghi "chạy với app X" khi chưa ai quét; `derived: true` bị trình bày như QR thật; test vắng mặt không có đối chứng có mặt.
    - Giữ nguyên mục "How to work" và các mẫu lỗi chung.
  - `.claude/agents/parity-review.md`: frontmatter `name: parity-review`, `tools: Read, Grep, Glob, Bash`. Mô tả: dùng trước khi merge.
    - Với mỗi thay đổi hành vi trong `ts/` hoặc `dotnet/`, kiểm ba điều:
      - ngôn ngữ kia có phần tương ứng, hoặc thay đổi ghi rõ "chưa làm ở <ngôn ngữ>, theo dõi ở <plan/issue>";
      - có mẫu trong `conformance/vectors/` chứng minh hành vi đó;
      - mã lỗi mới có trong `conformance/errors.json`.
    - Trước Plan 8 chưa có `dotnet/`: chỉ kiểm hai điều sau, và nhắc rằng mọi hành vi phải mô tả được bằng mẫu thử.
  - `.claude/skills/add-scheme/SKILL.md`: frontmatter `name: add-scheme`, description "Dùng khi thêm một loại QR thanh toán mới vào tingqr". Danh sách việc theo đúng thứ tự spec 5.10:
    1. Tìm mẫu thật kèm nguồn và giấy phép (spec 5.2, 5.2a).
    2. Viết `conformance/schemes/<id>.md`.
    3. Thêm mẫu thử, chạy validator.
    4. Viết code TypeScript cho tới khi bộ chạy mẫu thử xanh.
    5. Code .NET (từ v0.2).
    6. Tài liệu.
    7. Thêm dòng vào bảng thử trên app thật, chỉ khi đã quét thật.
  - `ts/CLAUDE.md`: lệnh pnpm; quy tắc "src không import `node:*`, không thêm dependency vào core"; test đặt ở `test/*.spec.ts`; bộ chạy mẫu thử ở `test/conformance.spec.ts`.
  - `CLAUDE.md` gốc: thêm mục "Làm song song" (việc TypeScript và .NET chạy song song phải ở hai worktree riêng) và mục "LSP" (bật plugin LSP TypeScript; C# từ Plan 8). Thêm mục "Lệnh" (`pnpm test:all`, `pnpm build:all`, `pnpm typecheck:all`) và mục "Quy tắc conformance trước, code sau". Sửa dòng trạng thái thành "Plan 1 đang làm: `docs/superpowers/plans/2026-11-18-plan-1-nen-mong-va-vietqr.md`".

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold ts workspace, @tingqr/core and Claude Code setup"
```

---

### Task 2: Định dạng `conformance/`: JSON Schema, bảng mã lỗi, bộ kiểm

**Files:**
- Create: `conformance/README.md`, `conformance/vectors.schema.json`, `conformance/errors.json`
- Test: `ts/packages/core/test/conformance-format.spec.ts`
- Modify: `ts/packages/core/package.json` (devDependency `ajv ^8`, `ajv-formats` không cần)

**Interfaces:**
- Produces:
  - Định dạng file mẫu thử (dưới đây), dùng ở Task 7 và mọi plan sau.
  - `conformance/errors.json` có dạng `{ "errors": [{ "code", "en", "vi" }], "warnings": [{ "code", "en", "vi" }] }`.

- [ ] **Step 1: Viết `vectors.schema.json`** (JSON Schema draft 2020-12). Một file = một mẫu.

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `id` | string `^[a-z0-9-]+$`, phải trùng tên file (không đuôi) | có | |
| `scheme` | string, ví dụ `vietqr` | có | |
| `kind` | `valid` \| `invalid` \| `lenient` | có | `lenient`: chế độ chặt báo lỗi `error`, chế độ chấp nhận lệch chuẩn đọc ra `expected` kèm `warnings` |
| `payload` | string | có | |
| `input` | object | không | Chỉ ở `valid`: `encode(input)` phải bằng `payload` từng byte, trừ khi `roundTrip: false` |
| `roundTrip` | boolean, mặc định `true` | không | |
| `expected` | object | có với `valid`/`lenient` | Dữ liệu đọc ra mong đợi |
| `warnings` | string[] (mã cảnh báo) | không | Cảnh báo mong đợi khi đọc (`valid`: thường rỗng) |
| `error` | string (mã lỗi) | có với `invalid`/`lenient` | |
| `source` | string, minLength 10 | có | |
| `derived` | boolean | không | `true` nếu sửa từ mẫu khác hoặc rút công thức từ QR thật |
| `derivedFrom` | string (id mẫu gốc) | khi `derived` và sửa từ mẫu khác | |
| `note` | string | không | |

  Dùng `if/then` để buộc các điều kiện "có với …".

- [ ] **Step 2: Viết `errors.json`**
  - Lỗi:
    - `CRC_MISSING`: thiếu tag 63 hoặc tag 63 không nằm ở cuối.
    - `CRC_MISMATCH`.
    - `BAD_LENGTH`: hai ký tự độ dài không phải số.
    - `TRUNCATED`: độ dài vượt quá phần còn lại của chuỗi.
    - `FIELD_TOO_LONG`.
    - `NON_ASCII`.
    - `MISSING_TAG`.
    - `INVALID_VALUE`.
    - `UNSUPPORTED_SCHEME`: hàm của scheme X nhận chuỗi của scheme khác.
    - `UNKNOWN_SCHEME`: chưa dùng ở Plan 1, để dành cho `detect` (Plan 3).
  - Cảnh báo:
    - `TRIMMED_WHITESPACE`.
    - `MISSING_OPTIONAL_TAG`: thiếu tag mà chuẩn yêu cầu nhưng scheme thực tế hay bỏ, chỉ ở chế độ chấp nhận lệch chuẩn.
    - `LOWERCASE_CRC`.
  - Mỗi mã có câu mô tả `en` và `vi`.

- [ ] **Step 3: Viết test `conformance-format.spec.ts`**
  - `every vector file matches vectors.schema.json`: duyệt đệ quy `conformance/vectors/**/*.json` (đường dẫn `new URL('../../../../conformance/', import.meta.url)`), kiểm bằng Ajv.
  - Kiểm thêm: `id` trùng tên file; `error` và mọi `warnings` có trong `errors.json`; `payload` không chứa `\r`.
  - `vector set is not empty`: đếm ≥ 1 file (đối chứng có mặt). Ở Task 2 chưa có mẫu nào, nên test này **fail** cho tới Task 7. Đánh dấu nó `test.todo` ở Task 2 và đổi thành test thật ở Task 7, Step 6.
  - `schema rejects a vector without source`: dựng object thiếu `source` trong test, kiểm Ajv báo sai (để chứng minh schema không dễ dãi).
  - `schema rejects an invalid vector without error`: tương tự.

- [ ] **Step 4: Chạy test**

Run: `pnpm -C ts test -- conformance-format`
Expected: hai test "rejects" PASS, test duyệt file PASS (chưa có file nào), test "not empty" ở trạng thái todo.

- [ ] **Step 5: `conformance/README.md`**
  - Giải thích các trường của file mẫu.
  - Quy tắc nguồn (spec 5.2, 5.2a).
  - Cách thêm mẫu.
  - Ghi rõ `conformance/private/` không bao giờ commit.

- [ ] **Step 6: Commit**

```bash
git add conformance ts && git commit -m "feat(conformance): vector schema, shared error codes, format checks"
```

---

### Task 3: Lỗi, CRC và TLV

**Files:**
- Create: `ts/packages/core/src/errors.ts`, `src/emv/crc.ts`, `src/emv/tlv.ts`
- Test: `test/errors.spec.ts`, `test/crc.spec.ts`, `test/tlv.spec.ts`

**Interfaces:**
- Produces (export từ `src/index.ts`):

```ts
export const ERROR_CODES: readonly ['CRC_MISSING','CRC_MISMATCH','BAD_LENGTH','TRUNCATED','FIELD_TOO_LONG','NON_ASCII','MISSING_TAG','INVALID_VALUE','UNSUPPORTED_SCHEME','UNKNOWN_SCHEME']
export type ErrorCode = typeof ERROR_CODES[number]
export const WARNING_CODES: readonly ['TRIMMED_WHITESPACE','MISSING_OPTIONAL_TAG','LOWERCASE_CRC']
export type WarningCode = typeof WARNING_CODES[number]
export interface Warning { code: WarningCode; message: string; tag?: string }
export class TingQrError extends Error { readonly code: ErrorCode; readonly tag?: string }  // name = 'TingQrError'
export type Result<T> = { ok: true; value: T; warnings: Warning[] } | { ok: false; error: TingQrError }
export function crc16(input: string): string
export interface TlvField { tag: string; value: string }
export interface TlvNode extends TlvField { children?: TlvNode[] }
export function field(tag: string, value: string): string        // ném FIELD_TOO_LONG nếu > 99 ký tự
export function encodeFields(fields: readonly TlvField[]): string
export function parseTlv(input: string): TlvNode[]               // ném BAD_LENGTH | TRUNCATED; không tự tách con
export function parseTemplate(value: string): TlvNode[]          // = parseTlv, dùng cho tag template
```

  Quy tắc chiều dài: đếm theo **code point** (`[...value].length`), đúng nghĩa "số ký tự" của EMVCo. Plan 3 kiểm lại bằng mẫu KHQR có chữ Khmer (ghi trong `conformance/schemes/khqr.md`).

- [ ] **Step 1: Test `errors.spec.ts`**
  - `ERROR_CODES and WARNING_CODES equal conformance/errors.json`: so hai mảng mã với file JSON (cùng phần tử, không thừa không thiếu).
  - `TingQrError carries code and tag`: `new TingQrError('NON_ASCII', 'msg', '62')` có `.code === 'NON_ASCII'`, `.tag === '62'`, `instanceof Error`.
- [ ] **Step 2: Test `crc.spec.ts`**
  - `crc16('123456789') === '29B1'`.
  - Mẫu thật của `vietnam-qr-pay` (README, MIT): `crc16('00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304') === 'AE9F'`.
  - `crc16('') === 'FFFF'`.
  - Kết quả luôn 4 ký tự hoa (dùng một chuỗi cho CRC nhỏ hơn `0x1000`: tìm bằng vòng lặp trong test qua `'A'.repeat(n)` cho tới khi gặp, rồi assert độ dài 4 và có số 0 đứng đầu).
- [ ] **Step 3: Test `tlv.spec.ts`**
  - `field('00','01') === '000201'`.
  - `field('62', 'x'.repeat(99))` có độ dài 103.
  - `field('62','x'.repeat(100))` ném `TingQrError` code `FIELD_TOO_LONG`, `tag === '62'`.
  - `parseTlv('000201010211')` ra hai node `{tag:'00',value:'01'}`, `{tag:'01',value:'11'}`.
  - `parseTlv('00AB01')` ném `BAD_LENGTH`.
  - `parseTlv('000501')` ném `TRUNCATED`.
  - Khứ hồi: `encodeFields(parseTlv(s)) === s` với chuỗi mẫu `vietnam-qr-pay` ở trên (cả phần `6304AE9F`).
  - Chữ có dấu đếm theo ký tự: `field('59','Đà')` === `'5902Đà'`.
- [ ] **Step 4: Chạy, thấy fail** — `pnpm -C ts test` → FAIL vì chưa có module.
- [ ] **Step 5: Viết `errors.ts`, `emv/crc.ts`, `emv/tlv.ts`, export từ `index.ts`**
  - CRC: thuật toán theo bit hoặc theo bảng, đều được, nhưng phải chạy trên byte UTF-8 (`new TextEncoder().encode`).
- [ ] **Step 6: Chạy, thấy pass** — `pnpm -C ts test` → PASS.
- [ ] **Step 7: Commit** — `git commit -m "feat(core): error codes, CRC16-CCITT-FALSE, TLV read/write"`

---

### Task 4: Đọc payload EMV: CRC, khoảng trắng, chế độ chặt / chấp nhận lệch chuẩn

**Files:**
- Create: `ts/packages/core/src/emv/payload.ts`
- Test: `test/payload.spec.ts`

**Interfaces:**
- Consumes: `crc16`, `parseTlv`, `field`, `encodeFields`, `TingQrError`, `Warning` (Task 3).
- Produces:

```ts
export type ParseMode = 'strict' | 'lenient'
export interface EmvPayload { fields: TlvNode[]; crc: string; raw: string }   // raw = chuỗi sau khi bỏ khoảng trắng hai đầu
export function parsePayload(input: string): Result<EmvPayload>
export function buildPayload(fields: readonly TlvField[]): string
export function getField(p: EmvPayload, tag: string): TlvNode | undefined
```

  - `buildPayload`: nối các field (không gồm 63), thêm `'6304'`, thêm `crc16(...)`.
  - `parsePayload`:
    - Bỏ khoảng trắng ASCII hai đầu (gồm `\r\n\t `). Nếu có bỏ thì thêm cảnh báo `TRIMMED_WHITESPACE`.
    - Tag cuối cùng phải là `63` dài 4. Nếu không thì `CRC_MISSING`.
    - So CRC không phân biệt hoa thường. CRC viết thường thì thêm cảnh báo `LOWERCASE_CRC`. CRC sai thì `CRC_MISMATCH`.
    - Hàm không biết scheme. Việc kiểm tag bắt buộc và chế độ chặt hay chấp nhận lệch chuẩn nằm ở từng scheme (Task 6), vì mỗi loại QR yêu cầu tag khác nhau.

- [ ] **Step 1: Test `payload.spec.ts`** (`S` = mẫu `vietnam-qr-pay` ở Task 3)
  - `buildPayload` của các field lấy từ `S` (bỏ tag 63) trả về đúng `S`.
  - `parsePayload(S)` trả `ok`, `crc === 'AE9F'`, `warnings` rỗng, các tag cấp đầu đúng thứ tự `['00','01','38','53','58','63']`.
  - `parsePayload(S + '\r\n')` và `parsePayload('  ' + S)` trả `ok` kèm `TRIMMED_WHITESPACE`.
  - `parsePayload(S.slice(0,-4) + 'ae9f')` trả `ok` kèm `LOWERCASE_CRC`.
  - `parsePayload(S.slice(0,-1) + '0')` trả `{ok:false}` code `CRC_MISMATCH`.
  - `parsePayload(S.slice(0,-8))` (bỏ cả `6304AE9F`) trả `CRC_MISSING`.
  - `parsePayload('0002')` trả lỗi `TRUNCATED`. Hàm không bao giờ ném lỗi ra ngoài: mọi `TingQrError` từ `parseTlv` được bọc vào `Result`.
- [ ] **Step 2: Chạy, thấy fail**
- [ ] **Step 3: Viết `payload.ts`, export từ `index.ts`**
- [ ] **Step 4: Chạy, thấy pass** — `pnpm -C ts test`
- [ ] **Step 5: Commit** — `git commit -m "feat(core): EMV payload parse/build with CRC and whitespace handling"`

---

### Task 5: Tạo VietQR và hàm bỏ dấu

**Files:**
- Create: `ts/packages/core/src/text.ts`, `src/schemes/vietqr/types.ts`, `src/schemes/vietqr/encode.ts`
- Modify: `src/vietqr.ts` (entry phụ), `src/index.ts`
- Test: `test/text.spec.ts`, `test/vietqr-encode.spec.ts`

**Interfaces:**
- Consumes: `field`, `buildPayload`, `TingQrError` (Task 3, 4).
- Produces (export từ cả `@tingqr/core` và `@tingqr/core/vietqr`):

```ts
export const VIETQR_GUID = 'A000000727'
export type VietQrService = 'account' | 'card'          // QRIBFTTA | QRIBFTTC
export interface VietQrInput {
  bankBin: string            // ^\d{6}$
  accountNumber: string      // ^[A-Za-z0-9]{3,25}$ (giống vietqr-node)
  service?: VietQrService    // mặc định 'account'
  amount?: number | string   // số nguyên VND, 1..13 chữ số, > 0
  purpose?: string           // tag 62.08, chỉ ASCII in được, ≤ 95 ký tự
}
export function encodeVietQr(input: VietQrInput): string        // ném TingQrError
export function removeVietnameseAccents(s: string): string      // từ src/text.ts, export ở '@tingqr/core'
```

  Thứ tự tag khi tạo (theo vietqr-node, spec nghiên cứu mục 2): `00`=`01`; `01`=`12` nếu có `amount` khác rỗng, ngược lại `11`; `38` = { `00`:GUID, `01`:{ `00`:bankBin, `01`:accountNumber }, `02`: `QRIBFTTA`/`QRIBFTTC` }; `53`=`704`; `54`=amount (nếu có); `58`=`VN`; `62`={ `08`:purpose } (nếu có); `63`.

  Lỗi:
  - BIN hoặc số tài khoản sai mẫu: `INVALID_VALUE`, kèm `tag` (`'38'`).
  - `amount` không phải số nguyên dương 1–13 chữ số (gồm `0`, số âm, số lẻ, chuỗi có dấu phẩy): `INVALID_VALUE`, tag `'54'`.
  - `purpose` có ký tự ngoài khoảng `0x20–0x7E`: `NON_ASCII`, tag `'62'`. Thông báo phải nhắc `removeVietnameseAccents`.
  - `purpose` dài hơn 95 ký tự: `FIELD_TOO_LONG`, tag `'62'`. Lỗi do `field()` của tag 62 bắn ra, không viết kiểm riêng.

- [ ] **Step 1: Test `text.spec.ts`**
  - `removeVietnameseAccents('Chuyển tiền Đà Nẵng') === 'Chuyen tien Da Nang'`.
  - `removeVietnameseAccents('đĐ') === 'dD'`.
  - Chuỗi ASCII giữ nguyên.
- [ ] **Step 2: Test `vietqr-encode.spec.ts`**
  - `encodeVietQr({ bankBin:'970416', accountNumber:'257678859' }) === '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'`. Đây là mẫu README của `vietnam-qr-pay`; nhờ nó, test này không vòng tròn.
  - `service:'card'` cho ra chuỗi chứa `0208QRIBFTTC`.
  - `amount: 50000` và `amount: '50000'` cho cùng kết quả, chuỗi có `010212` và `540550000`.
  - Không có amount thì có `010211` và không có tag `54`.
  - `purpose: 'Chuyển tiền'` ném `NON_ASCII`; `error.message` chứa `removeVietnameseAccents`.
  - Mốc độ dài: `purpose: 'A'.repeat(95)` qua; `'A'.repeat(96)` ném `FIELD_TOO_LONG` tag `'62'`.
  - `amount` là `0`, `-1`, `1.5`, `'50,000'`, `'1'.repeat(14)` đều ném `INVALID_VALUE`; `'1'.repeat(13)` qua.
  - `bankBin: '97042'` và `accountNumber: '0123-456'` ném `INVALID_VALUE`.
  - `import { encodeVietQr } from '../src/vietqr.js'` là cùng hàm với bản ở `index.js`.
- [ ] **Step 3: Chạy, thấy fail**
- [ ] **Step 4: Viết `text.ts`** (NFD, bỏ dấu kết hợp `\p{M}`, `đ→d`, `Đ→D`), **`types.ts`**, **`encode.ts`**; export.
- [ ] **Step 5: Chạy, thấy pass** — `pnpm -C ts test`
- [ ] **Step 6: Commit** — `git commit -m "feat(vietqr): encode VietQR account/card, static/dynamic"`

---

### Task 6: Đọc VietQR

**Files:**
- Create: `ts/packages/core/src/schemes/vietqr/decode.ts`
- Modify: `src/schemes/vietqr/types.ts`, `src/vietqr.ts`, `src/index.ts`
- Test: `test/vietqr-decode.spec.ts`

**Interfaces:**
- Consumes: `parsePayload`, `getField`, `parseTemplate`, `Result`, `Warning`, `ParseMode`.
- Produces:

```ts
export interface VietQrData {
  bankBin: string
  accountNumber: string
  service: VietQrService
  initiation: 'static' | 'dynamic'      // tag 01: '11' | '12'
  amount?: string                        // nguyên văn tag 54
  purpose?: string                       // tag 62.08
  additionalData?: Record<string, string>  // mọi sub-tag của 62 (gồm '08'), key là mã sub-tag
  merchantName?: string                  // tag 59
  merchantCity?: string                  // tag 60
  merchantCategoryCode?: string          // tag 52
  currency: string                       // tag 53 nguyên văn ('704'); khi lenient mà thiếu thì '704'
  country: string                        // tag 58; khi lenient mà thiếu thì 'VN'
}
export function decodeVietQr(payload: string, options?: { mode?: ParseMode }): Result<VietQrData>   // mặc định 'strict'
```

  Quy tắc:
  - Không có tag 38, hoặc 38.00 khác `A000000727` (so không phân biệt hoa thường): `UNSUPPORTED_SCHEME`.
  - Thiếu 38.01.00 hoặc 38.01.01, hoặc 38.02 không phải `QRIBFTTA`/`QRIBFTTC`: `MISSING_TAG` hoặc `INVALID_VALUE`, kèm `tag` dạng `'38.01'`, `'38.02'`.
  - 00 khác `01`, hoặc 01 không thuộc {11,12}: `INVALID_VALUE`.
  - Tag 53 và 58:
    - Chế độ `strict`: thiếu thì `MISSING_TAG`.
    - Chế độ `lenient`: thiếu thì thêm cảnh báo `MISSING_OPTIONAL_TAG` kèm `tag`, rồi điền mặc định.
  - Lỗi CRC hay độ dài từ `parsePayload` được đưa ra nguyên vẹn. Cảnh báo của `parsePayload` được gộp vào kết quả.

- [ ] **Step 1: Test `vietqr-decode.spec.ts`**
  - Mẫu `S` đọc ra `{ bankBin:'970416', accountNumber:'257678859', service:'account', initiation:'static', currency:'704', country:'VN' }`. Các trường tuỳ chọn không có mặt, kiểm bằng `toStrictEqual`.
  - Khứ hồi: với 5 đầu vào ở Task 5 (static, card, amount, purpose 95 ký tự, amount 13 chữ số), `decodeVietQr(encodeVietQr(x))` khớp `x` (đổi `amount` thành chuỗi, `service` mặc định `'account'`).
  - Tag 54 là `"50000.00"`: dựng bằng `buildPayload` với field tay, đọc ra `amount === '50000.00'`.
  - Bỏ tag 58 khỏi `S` (dựng lại bằng `buildPayload`):
    - Chế độ `strict` trả lỗi `MISSING_TAG`, `tag === '58'`.
    - Chế độ `lenient` trả `ok`, `country === 'VN'`, có cảnh báo `MISSING_OPTIONAL_TAG` tag `'58'`.
  - Đổi GUID thành `A000000775` (dựng lại) thì trả `UNSUPPORTED_SCHEME`.
  - Đổi 38.02 thành `QRIBFTTX` thì trả `INVALID_VALUE`, tag `'38.02'`.
  - CRC sai thì trả `CRC_MISMATCH`; `S + '\n'` thì trả `ok` kèm `TRIMMED_WHITESPACE`.
- [ ] **Step 2: Chạy, thấy fail**
- [ ] **Step 3: Viết `decode.ts`, export**
- [ ] **Step 4: Chạy, thấy pass**
- [ ] **Step 5: Commit** — `git commit -m "feat(vietqr): decode with strict/lenient modes"`

---

### Task 7: Mẫu thử VietQR từ hai oracle MIT và bộ chạy mẫu thử

**Files:**
- Create: `conformance/tools/oracle/package.json`, `conformance/tools/oracle/gen-vietqr.mjs`, `conformance/schemes/vietqr.md`, `conformance/vectors/vietqr/*.json`
- Test: `ts/packages/core/test/conformance.spec.ts`
- Modify: `test/conformance-format.spec.ts` (bỏ `todo`)

**Interfaces:**
- Consumes: `encodeVietQr`, `decodeVietQr` (Task 5, 6), định dạng mẫu (Task 2).
- Produces: `test/conformance.spec.ts` có bảng `SCHEMES: Record<string, { encode?: (input: any) => string; decode: (payload: string, o?: { mode?: ParseMode }) => Result<unknown> }>`. Plan 2 và 3 thêm dòng vào bảng này. Plan 8 viết bộ chạy tương đương bằng C#.

- [ ] **Step 1: Viết oracle**
  - `conformance/tools/oracle/package.json`: private, devDependencies ghim cứng `"vietqr": "1.2.0"`, `"vietnam-qr-pay": "1.5.1"`. Thư mục này có `node_modules` riêng, không nằm trong workspace `ts/`.
  - `gen-vietqr.mjs`:
    - Với mỗi đầu vào giả trong bảng dưới, gọi `genQRText` của `vietqr` và hàm tạo VietQR của `vietnam-qr-pay`, rồi so hai chuỗi.
    - Cùng ra một chuỗi: ghi file mẫu `valid` với `input` và `expected`, `source` = `"vietqr@1.2.0 genQRText + vietnam-qr-pay@1.5.1 (MIT), agree; fake account"`.
    - Khác nhau: **không ghi file**, in ra hai chuỗi và dừng với mã thoát 1, để người chạy quyết định rồi ghi tay lý do vào `note`.
    - Oracle nào không hỗ trợ một trường hợp (ví dụ `card` hay không có ở `vietqr`): dùng một oracle, `source` ghi rõ "single oracle".
    - Script ghi file JSON có thụt lề 2 và xuống dòng LF ở cuối.

| id | bankBin | accountNumber | service | amount | purpose |
|---|---|---|---|---|---|
| `vietqr-static-account` | 970422 | 0123456789 | account | – | – |
| `vietqr-dynamic-amount-purpose` | 970422 | 0123456789 | account | 50000 | TINGQR TEST |
| `vietqr-amount-13-digits` | 970436 | 1234567890 | account | 1234567890123 | – |
| `vietqr-purpose-95-chars` | 970415 | 9876543210 | account | 10000 | `A` × 95 |
| `vietqr-card` | 970422 | 9704220123456789 | card | 20000 | – |

- [ ] **Step 2: Chạy oracle**

Run: `cd conformance/tools/oracle && npm install && node gen-vietqr.mjs`
Expected: 5 file trong `conformance/vectors/vietqr/`, hoặc lệnh dừng và in ra chỗ hai oracle khác nhau. Nếu dừng thì ghi chỗ khác nhau vào `conformance/schemes/vietqr.md` và vào báo cáo task, **không** tự sửa oracle cho khớp.

- [ ] **Step 3: Thêm mẫu tay**
  - `vietqr-readme-sample.json`: `valid`, là chuỗi `S`, `input` = `{bankBin:'970416',accountNumber:'257678859'}`. `source` = `"vietnam-qr-pay README (MIT), https://github.com/xuannghia/vietnam-qr-pay"`.
  - `vietqr-crc-mismatch.json`: `invalid`, `error: CRC_MISMATCH`, `derived: true`, `derivedFrom: vietqr-readme-sample`, `note` ghi rõ đổi ký tự cuối thành `0`.
  - `vietqr-missing-country.json`: `lenient`, `error: MISSING_TAG`, `warnings: ['MISSING_OPTIONAL_TAG']`, `derived: true`, `derivedFrom: vietqr-static-account`, `note` ghi bỏ tag 58 và tính lại CRC. Payload sinh bằng `buildPayload` trong một lần chạy node ngắn, ghi lệnh đã chạy vào `note`.
- [ ] **Step 4: Viết `conformance.spec.ts`**
  - Đọc mọi mẫu, sinh một test cho mỗi mẫu theo `kind`:
    - `valid`: `decode(payload, {mode:'strict'})` ra `ok` và `toStrictEqual(expected)`; `warnings` khớp (mặc định rỗng). Nếu có `input` và `roundTrip !== false` thì `encode(input) === payload`.
    - `invalid`: `decode` ở cả hai chế độ trả lỗi `error`.
    - `lenient`: chế độ strict trả lỗi `error`; chế độ lenient ra `ok`, `toStrictEqual(expected)` và mã cảnh báo khớp `warnings`.
  - Scheme không có trong `SCHEMES` thì test **fail**, không bỏ qua.
  - Thêm một test đối chứng: số test sinh ra bằng đúng số file mẫu, và ≥ 8.
- [ ] **Step 5: Viết `conformance/schemes/vietqr.md`**
  - Cấu trúc tag, quy tắc tạo và đọc, các giới hạn (95 ký tự nội dung, 13 chữ số tiền, ASCII).
  - Nguồn: bản NAPAS IBFT v1.5.2 lan truyền, vietqr-node, vietnam-qr-pay.
  - Ghi chú: đây là đặc tả do cộng đồng tổng hợp, NAPAS chưa công bố chính thức.
- [ ] **Step 6: Đổi test `vector set is not empty` ở Task 2 từ `todo` thành test thật**
- [ ] **Step 7: Chạy toàn bộ**

Run: `pnpm test:all`
Expected: PASS, gồm ≥ 8 test sinh từ mẫu thử.

- [ ] **Step 8: Kiểm bộ chạy mẫu thử có cắn thật** (không commit thay đổi tạm)
  - Tạm sửa `encode.ts` cho tag 53 ra `'705'`, chạy `pnpm test:all`. Expected: các mẫu `valid` có `input` FAIL.
  - Hoàn lại, chạy lại. Expected: PASS.
- [ ] **Step 9: Commit** — `git commit -m "test(conformance): VietQR vectors from two MIT oracles and shared runner"` (gồm `package-lock.json` của oracle, không gồm `node_modules`).

---

### Task 8: CI TypeScript

**Files:**
- Create: `.github/workflows/ci-ts.yml`
- Modify: `CLAUDE.md` (trạng thái: Plan 1 xong)

**Interfaces:**
- Consumes: lệnh `pnpm -C ts install --frozen-lockfile`, `typecheck`, `build`, `test` (Task 1).

- [ ] **Step 1: Viết `ci-ts.yml`**
  - Chạy khi push lên `main` và khi có pull request, với `paths`: `ts/**`, `conformance/**`, `.github/workflows/ci-ts.yml`, `package.json`.
  - Ma trận: `os: [ubuntu-latest, windows-latest]`, `node: ['20', '22', '24']`.
  - Các bước: `actions/checkout@v5`, `pnpm/action-setup@v6` (version 10), `actions/setup-node@v5` (cache pnpm, `cache-dependency-path: ts/pnpm-lock.yaml`), rồi `pnpm -C ts install --frozen-lockfile`, `pnpm -C ts typecheck`, `pnpm -C ts build`, `pnpm -C ts test`.
  - Thêm bước kiểm lõi không có dependency: `node -e` đọc `ts/packages/core/package.json`, thoát lỗi nếu `dependencies` khác rỗng.
  - Ghi chú trong file vì sao có Windows: CRLF làm sai CRC (Review Focus 1).
- [ ] **Step 2: Kiểm cú pháp cục bộ**

Run: `npx --yes yaml-lint .github/workflows/ci-ts.yml` (hoặc `node -e "require('yaml')"` nếu không có mạng, bước này chỉ kiểm cú pháp YAML)
Expected: không lỗi. Ghi trong báo cáo task: CI chỉ thật sự chạy khi repo được đẩy lên GitHub. Plan này không push, nên **CI chưa chạy lần nào**.

- [ ] **Step 3: Chạy lại toàn bộ cục bộ, kiểm `.gitattributes`**

Run: `pnpm test:all && pnpm typecheck:all && pnpm build:all && git ls-files --eol conformance/vectors | head`
Expected: PASS; các file mẫu có `i/lf`.

- [ ] **Step 4: Cập nhật `CLAUDE.md`**: trạng thái "Plan 1 xong (ngày); tiếp theo Plan 2 cần QR thật do chủ dự án chụp". Ghi rõ CI chưa chạy trên GitHub.
- [ ] **Step 5: Commit** — `git commit -m "ci: TypeScript workflow on ubuntu and windows"`
