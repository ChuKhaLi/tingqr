# Plan 4: `@tingqr/render` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gói `@tingqr/render` vẽ chuỗi QR thành ma trận và SVG, có ô logo ở giữa, kèm trang quét thử VietQR bằng app thật.

**Architecture:**
- Port nguyên vẹn `qrcodegen.ts` của Nayuki (v1.8.0) vào `src/qrcodegen.ts`.
- `toMatrix` bọc `encodeSegments`. `toSvg` vẽ từ ma trận: một `<rect>` nền và một `<path>` ô tối. Logo xoá ô ở giữa rồi chèn `<image>`.
- Mẫu ma trận (`kind: "matrix"`) sinh từ file Nayuki gốc (bản vendored, kiểm SHA-256) và chạy bằng bộ chạy riêng của gói `render`.

**Tech Stack:** TypeScript, tsup, Vitest, Stryker (đã có trong `core`); `typescript` trong oracle để dịch file Nayuki.

**Spec:** `docs/superpowers/specs/2026-11-19-tingqr-render-design.md` (thiết kế đã duyệt 2026-11-19). Spec chung: `docs/superpowers/specs/2026-11-18-tingqr-design.md` mục 5.6.

**Điều kiện trước:** gộp PR #4 (CJS subpath) và PR #5 (tiền tệ KHQR) vào `main` trước khi bắt đầu. Plan này không sửa các file của hai PR đó, nhưng nên làm trên `main` mới nhất.

## Global Constraints

- **Dependency:**
  - `@tingqr/render` chỉ có dependency lúc chạy là `@tingqr/core` (`workspace:*`).
  - Không import `node:*` trong `src/`, không dùng DOM. `toSvg` trả về chuỗi.
  - Phải chạy được trên trình duyệt, Node, Cloudflare Workers và Angular SSR.
- **Đóng gói:**
  - Đầu ra kép ESM và CJS kèm `.d.ts`, build bằng tsup, chỉ một entry.
  - `sideEffects: false`, giấy phép MIT.
  - Ngân sách tarball **25 000 byte**.
- **Lỗi:**
  - Đầu vào sai ném `TingQrError('INVALID_VALUE', message)` lấy từ `@tingqr/core`. Không thêm mã lỗi mới, không đặt `tag`.
  - Không âm thầm đổi đầu vào: không tự tăng `minVersion`, không tự thu nhỏ logo, không tự đổi `ecc` khi người dùng đã chọn.
- **Port Nayuki:**
  - Giữ nguyên header giấy phép MIT của Nayuki.
  - Ghi nguồn: tag `v1.8.0`, commit `720f62bddb7226106071d4728c292cb1df519ceb`, file `typescript-javascript/qrcodegen.ts`, SHA-256 `c4749095a91bf9696e3a303998b9905e467094f53041e64393e65e6d887737fd`.
  - Ghi công trong `NOTICE` của repo và của gói.
- **Mẫu thử:**
  - Mẫu ma trận chỉ sinh từ file Nayuki **gốc**, không bao giờ từ code đã port.
  - Chạy oracle chỉ qua `node conformance/tools/oracle/<script>`, để chủ dự án được hỏi trước.
- **Dữ liệu thật:**
  - Claude **không đọc** `conformance/private/`, không chạy trang quét thử với dữ liệu thật, không đọc file HTML sinh ra từ dữ liệu thật.
  - Lệnh Bash có chuỗi `conformance/private` bị chặn. Trong test, dùng biến môi trường `TINGQR_SCAN_INPUTS` trỏ tới file tạm.
- **Giá trị mặc định:**
  - `ecc: 'M'`, `boostEcc: true`, `minVersion: 1`, `maxVersion: 40`, mask tự chọn;
  - `margin: 4` (cho phép 0–16), `foreground: '#000000'`, `background: '#ffffff'`;
  - logo: `size` 0.2 (cho phép (0, 0.25]), `padding` 1 (cho phép 0–4).
- **Mutation:** ngưỡng 90% cho `src/**/*.ts` của `render`, trừ `src/qrcodegen.ts`.

## Review Focus

1. **Chuỗi Unicode (Thái, Khmer, emoji ngoài BMP):**
   - Phải mã hoá UTF-8 ở chế độ byte, đúng như Nayuki.
   - Ma trận phải khớp oracle.
   - Mẫu ma trận có chuỗi KHQR tiếng Khmer và chuỗi PromptPay tiếng Thái → Task 2, 3.
2. **Logo ở phiên bản nhỏ và ở mép giới hạn:**
   - Phiên bản 1 với logo mặc định phải bị từ chối.
   - Vùng xoá đúng 10% thì được, hơn 10% thì không.
   - Vùng xoá chạm hàng 8 thì bị từ chối (hàng 10 khi phiên bản ≥ 7).
   - → Task 5.
3. **SVG nhúng vào trang web:**
   - `href` logo dạng `javascript:`, chuỗi có `"` hay `<`, và màu có ký tự lạ không được làm vỡ thẻ hay chèn được nội dung.
   - → Task 4, 5.
4. **Mức sửa lỗi sau khi nâng:**
   - `boostEcc` có thể nâng M lên Q/H. `QrMatrix.ecc` phải báo mức **thực dùng**.
   - Có logo mà người dùng truyền `ecc: 'H'` thì được; truyền `'M'` thì bị từ chối.
   - → Task 3, 5.
5. **Chuỗi quá dài** (vượt `maxVersion` ở mức sửa lỗi đã chọn):
   - Phải ném `INVALID_VALUE` có thông báo rõ.
   - Không được lọt `RangeError` của Nayuki ra ngoài.
   - → Task 3.

---

## Cấu trúc file

```
ts/packages/render/
├─ package.json, tsconfig.json, tsconfig.test.json, tsup.config.ts, vitest.config.ts, stryker.config.json, NOTICE
├─ src/
│  ├─ qrcodegen.ts      (Task 3: port Nayuki)
│  ├─ matrix.ts         (Task 3: toMatrix, kiểu)
│  ├─ color.ts          (Task 4: kiểm màu, tương phản)
│  ├─ svg.ts            (Task 4: toSvg, path, thoát ký tự)
│  ├─ logo.ts           (Task 5: hình học vùng xoá, kiểm href)
│  └─ index.ts
├─ scripts/scan-sheet.mjs                 (Task 6)
└─ test/{conformance-root.ts, smoke, matrix-conformance, matrix, color, svg, logo, scan-sheet}.spec.ts
ts/scripts/check-render-package.mjs       (Task 7)
conformance/
├─ vectors.schema.json, README.md         (Task 1: kind "matrix"; Task 6: định dạng scan-inputs)
├─ vectors/render/*.json                  (Task 2)
├─ tools/oracle/{gen-render.mjs, vendor/nayuki-qrcodegen-v1.8.0.ts}   (Task 2)
├─ scan-inputs.example.json, scans.md     (Task 6)
ts/packages/core/test/conformance.spec.ts (Task 1: bỏ qua vectors/render)
NOTICE, .gitignore, .github/workflows/{ci-ts,mutation-ts}.yml, CLAUDE.md, ts/CLAUDE.md
```

---

### Task 1: Khung gói và loại mẫu `matrix`

**Files:**
- Create:
  - `ts/packages/render/{package.json, tsconfig.json, tsconfig.test.json, tsup.config.ts, vitest.config.ts}`
  - `src/index.ts`, `test/smoke.spec.ts`, `test/conformance-root.ts`
- Modify:
  - `conformance/vectors.schema.json`, `conformance/README.md`
  - `ts/packages/core/test/conformance.spec.ts`, `ts/packages/core/test/conformance-format.spec.ts`
- Test: `ts/packages/core/test/conformance-format.spec.ts`, `ts/packages/render/test/smoke.spec.ts`

**Interfaces:**
- Produces:
  - Gói `@tingqr/render` build và test được qua `pnpm -r`.
  - `CONFORMANCE_DIR` trong `ts/packages/render/test/conformance-root.ts`: chép y hệt bản của `core`.
  - Mẫu `kind: "matrix"`:
    - **có** `input: { text: string, ecc?, boostEcc?, minVersion?, maxVersion?, mask? }`;
    - **có** `expected: { size, version, ecc, mask, rows: string[] }`;
    - **không có** `payload`.
  - Bộ chạy của `core` bỏ qua mọi file trong `vectors/render/`.

- [ ] **Step 1: Test schema** trong `conformance-format.spec.ts`:
  - Schema chấp nhận `{ id:'x', scheme:'render', kind:'matrix', input:{ text:'A' }, expected:{ size:21, version:1, ecc:'M', mask:0, rows:[] }, source:'test fixture inside conformance-format.spec.ts' }`.
  - Schema từ chối mẫu `matrix` thiếu `input`, thiếu `expected`, hoặc có `payload`.
- [ ] **Step 2: Chạy, thấy fail.**
  - Lệnh: `pnpm -C ts/packages/core test conformance-format`.
  - Kỳ vọng: fail ở `kind` enum.
- [ ] **Step 3: Sửa `vectors.schema.json`:**
  - Thêm `"matrix"` vào enum `kind`.
  - Nhánh `else` (phải có `payload`) không áp cho `matrix`.
  - Thêm nhánh `matrix`: bắt buộc `input` và `expected`, cấm `payload` và `error`.
- [ ] **Step 4: Chạy lại, thấy pass.**
- [ ] **Step 5: Cho bộ chạy của `core` bỏ qua `vectors/render/`.**
  - Sửa hàm `files()` hoặc lọc theo `scheme === 'render'`.
  - Test `the runner sees every vector file` đếm cùng tập đã lọc.
  - Chú thích trong file nói lý do: `render` phụ thuộc `core`, nên `core` không gọi `render`.
- [ ] **Step 6: Khung gói, sao từ `core`:**
  - `package.json`:
    - `name: "@tingqr/render"`, `type: "module"`;
    - `exports` cho `"."` có `import`/`require`/`types` như `core`;
    - `files: ["dist", "NOTICE"]`;
    - `dependencies: { "@tingqr/core": "workspace:*" }`;
    - scripts `build`, `test`, `typecheck`, `mutate`.
  - `tsup.config.ts`: `entry: ['src/index.ts']`, `format: ['esm','cjs']`, `dts: true`, `sourcemap: false`.
  - `smoke.spec.ts`: `import * as render from '../src/index.js'` và `expect(render).toBeDefined()`.
- [ ] **Step 7: Kiểm cài đặt và chạy.**
  - Lệnh: `pnpm -C ts install && pnpm test:all && pnpm typecheck:all && pnpm build:all`.
  - Kỳ vọng: PASS. Gói mới nằm trong output của `pnpm -r`.
- [ ] **Step 8: Ghi `kind: "matrix"` vào bảng trong `conformance/README.md`:**
  - Quy tắc so sánh: `toMatrix(input.text, input without text)` phải cho đúng `size`, `version`, `ecc`, `mask`.
  - `rows[y][x] === '1'` khi và chỉ khi `modules[y][x]`.
- [ ] **Step 9: Commit** — `chore(render): package skeleton and matrix vector kind`

---

### Task 2: Oracle Nayuki và mẫu ma trận

**Files:**
- Create:
  - `conformance/tools/oracle/vendor/nayuki-qrcodegen-v1.8.0.ts`: file gốc, không sửa một byte nào.
  - `conformance/tools/oracle/gen-render.mjs`
  - `conformance/vectors/render/*.json`
- Modify:
  - `conformance/tools/oracle/package.json`: thêm `typescript` ghim cứng đúng bản trong `ts/package.json`.
  - `conformance/README.md`: bảng oracle.
  - `.gitattributes`: file vendored là `-text`, để SHA-256 không đổi trên Windows.

**Interfaces:**
- Consumes: định dạng mẫu `matrix` (Task 1).
- Produces: các file `vectors/render/render-*.json`, dùng ở Task 3.

- [ ] **Step 1: Vendor file gốc.**
  - Tải `https://raw.githubusercontent.com/nayuki/QR-Code-generator/720f62bddb7226106071d4728c292cb1df519ceb/typescript-javascript/qrcodegen.ts`.
  - Kiểm `sha256sum` = `c4749095a91bf9696e3a303998b9905e467094f53041e64393e65e6d887737fd` trước khi commit.
- [ ] **Step 2: Viết `gen-render.mjs`:**
  - Đọc file vendored, kiểm lại SHA-256 (sai thì thoát với mã khác 0).
  - Dịch bằng `ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020 } })`.
  - Lấy `qrcodegen` bằng `new Function(js + '\nreturn qrcodegen;')()`.
  - Với mỗi case, gọi `QrCode.encodeSegments(QrSegment.makeSegments(text), Ecc[...], minVersion ?? 1, maxVersion ?? 40, mask ?? -1, boostEcc ?? true)`.
  - Ghi `expected`:
    - `size`, `version`;
    - `ecc`: chữ L/M/Q/H theo `errorCorrectionLevel.ordinal`;
    - `mask`;
    - `rows`: mỗi hàng là chuỗi `0`/`1` lấy từ `getModule(x, y)`.
  - Ghi `source`: `"nayuki/QR-Code-generator v1.8.0 (MIT), commit 720f62b, run by gen-render.mjs"`.
  - Với chuỗi lấy từ mẫu khác, `note` trỏ tới `id` mẫu gốc.
- [ ] **Step 3: Danh sách case.** Phủ đủ thiết kế mục 5.5:

  | id | text | tuỳ chọn |
  |---|---|---|
  | `render-vietqr-alnum` | payload của `vietqr-readme-sample` (chỉ gồm ký tự chữ-số) | mặc định |
  | `render-vietqr-purpose-h` | payload của `vietqr-dynamic-amount-purpose` | `ecc: 'H'` |
  | `render-vnpay` | payload của `vnpay-readme-cellphones` | `ecc: 'Q'` |
  | `render-promptpay-thai` | payload của `promptpay-promptparse-thai-name` | `ecc: 'L'` |
  | `render-khqr-khmer` | payload của `khqr-sdk-individual-usd` (phiên bản ≥ 7) | mặc định |
  | `render-numeric` | `'0123456789'` | mặc định |
  | `render-no-boost` | `'HELLO'` | `ecc: 'L', boostEcc: false` |
  | `render-mask-0` … `render-mask-7` | `'TINGQR'` | `mask: 0` … `7` |
  | `render-min-version-10` | `'A'` | `minVersion: 10` |
  | `render-v1-full-m` | 14 ký tự byte (`'tingqr-render!'`) | `ecc: 'M', boostEcc: false`: vừa đúng phiên bản 1 |
  | `render-v2-overflow-m` | 15 ký tự byte (`'tingqr-render!!'`) | như trên: lên phiên bản 2 |
  | `render-emoji` | `'ting 😀 qr'` | mặc định |

  Thêm các mẫu `encode-invalid` (`scheme: 'render'`, `input` là `{ text, ...options }`, `error: 'INVALID_VALUE'`, viết tay, `source` ghi "design 5.2"):
  - `ecc: 'X'`
  - `minVersion: 0`
  - `maxVersion: 41`
  - `minVersion: 5, maxVersion: 4`
  - `mask: 8`
  - `mask: 1.5`
  - chuỗi 3000 chữ `'a'` với `maxVersion: 40, ecc: 'H'` (quá sức chứa)
- [ ] **Step 4: Chạy** `node conformance/tools/oracle/gen-render.mjs` (chủ dự án được hỏi trước).
  - Kỳ vọng: in danh sách `id`.
  - Kiểm `render-v1-full-m` ra `version: 1` và `render-v2-overflow-m` ra `version: 2`. Nếu lệch thì chỉnh độ dài chuỗi cho đúng biên rồi chạy lại.
- [ ] **Step 5: Chạy** `pnpm test:all`. Kỳ vọng: PASS (`conformance-format` kiểm schema của các mẫu mới).
- [ ] **Step 6: Commit** — `test(render): Nayuki oracle and matrix vectors`

---

### Task 3: Port Nayuki và `toMatrix`

**Files:**
- Create: `src/qrcodegen.ts`, `src/matrix.ts`, `test/matrix-conformance.spec.ts`, `test/matrix.spec.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `vectors/render/*.json` (Task 2); `TingQrError` từ `@tingqr/core`.
- Produces:

```ts
export type Ecc = 'L' | 'M' | 'Q' | 'H'
export interface MatrixOptions { ecc?: Ecc; boostEcc?: boolean; minVersion?: number; maxVersion?: number; mask?: number }
export interface QrMatrix { size: number; version: number; ecc: Ecc; mask: number; modules: boolean[][] }  // modules[y][x]
export function toMatrix(text: string, options?: MatrixOptions): QrMatrix
```

- [ ] **Step 1: Bộ chạy mẫu `matrix-conformance.spec.ts`.**
  - Đọc `vectors/render/` qua `CONFORMANCE_DIR`.
  - Với `matrix`: so `size`, `version`, `ecc`, `mask`, và `rows` với `modules` (map sang chuỗi `0`/`1`).
  - Với `encode-invalid`: `toMatrix(text, options)` ném `TingQrError` có `code === v.error`.
  - Có test đếm: số mẫu chạy bằng số file trong thư mục, và ít nhất 20.
- [ ] **Step 2: `matrix.spec.ts`:**
  - Mặc định là `ecc: 'M'`: với `t` là payload `render-vietqr-alnum` và `'A'`, `toMatrix(t)` bằng đúng `toMatrix(t, { ecc: 'M' })`.
  - `boostEcc` mặc định nâng mức: `toMatrix('A').ecc === 'H'`. Còn `toMatrix('A', { boostEcc: false }).ecc === 'M'`.
  - `modules` là mảng mới mỗi lần gọi; sửa nó không ảnh hưởng lần gọi sau.
  - Chuỗi quá dài ném `TingQrError`, `code === 'INVALID_VALUE'`, `message` chứa `'too long'`. Không lọt `RangeError`.
  - `text` không phải chuỗi ném `INVALID_VALUE`.
- [ ] **Step 3: Chạy, thấy fail** (`pnpm -C ts/packages/render test`). Kỳ vọng: không import được `toMatrix`.
- [ ] **Step 4: Port `src/qrcodegen.ts`:**
  - Chép file vendored.
  - Chỉ đổi `namespace qrcodegen { … }` và hai `namespace qrcodegen.QrCode` / `qrcodegen.QrSegment` thành `export` cấp module, theo cách `tsc` chấp nhận với `isolatedModules`.
  - Giữ header gốc. Thêm khối comment ngay dưới, ghi: nguồn, commit, SHA-256 của bản gốc, và **danh sách mọi thay đổi**.
  - Không đổi thuật toán và tên.
  - Kiểm: `diff` giữa bản gốc và bản port chỉ có các dòng đã liệt kê.
- [ ] **Step 5: `src/matrix.ts`:**
  - Kiểm tuỳ chọn theo `Global Constraints`, sai thì ném `INVALID_VALUE`. Ví dụ thông báo: `Option mask must be an integer 0–7.`
  - Gọi `encodeSegments(makeSegments(text), …)`.
  - Bắt `RangeError` "Data too long" và đổi thành `INVALID_VALUE` với `Text is too long for a QR code of version ≤ ${maxVersion} at ECC ${ecc}.`
  - Dựng `modules`.
  - Export từ `index.ts`.
- [ ] **Step 6: Chạy, thấy pass.** `pnpm -C ts/packages/render test && pnpm typecheck:all`.
- [ ] **Step 7: Commit** — `feat(render): port Nayuki QR encoder and toMatrix`

---

### Task 4: `toSvg` không logo

**Files:**
- Create: `src/color.ts`, `src/svg.ts`, `test/color.spec.ts`, `test/svg.spec.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `toMatrix`, `MatrixOptions` (Task 3).
- Produces (`LogoOptions` được khai báo ở Task 5):

```ts
export interface SvgOptions extends MatrixOptions {
  margin?: number; foreground?: string; background?: string; size?: number | string; logo?: LogoOptions
}
export function toSvg(text: string, options?: SvgOptions): string
// color.ts (nội bộ)
export function parseHexColor(value: string): [number, number, number]   // ném INVALID_VALUE nếu không phải #rgb/#rrggbb
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number  // WCAG 2.x
// svg.ts (nội bộ)
export function escapeAttr(value: string): string   // & < > " ' → &amp; &lt; &gt; &quot; &#39;
```

- **Hình dạng đầu ra:**
  - `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W W"[ width="S" height="S"] shape-rendering="crispEdges">`, với `W = size + 2 × margin`.
  - Tiếp theo là `<rect width="W" height="W" fill="BG"/>`. Bỏ thẻ này khi nền là `transparent`.
  - Tiếp theo là `<path fill="FG" d="…"/>`.
  - Mỗi đoạn ô tối liền nhau trên một hàng là `M{x+margin} {y+margin}h{len}v1h-{len}z`, các đoạn nối liền không dấu cách.
  - Cuối cùng là `</svg>`.

- [ ] **Step 1: `color.spec.ts`:**
  - `parseHexColor('#fff')` → `[255,255,255]`; `'#1A2b3C'` → `[26,43,60]`.
  - Từ chối: `'fff'`, `'#ffff'`, `'red'`, `'#ggg'`, `'#fff" onload="x'`.
  - `contrastRatio` của đen/trắng = 21, của trắng/trắng = 1. Một cặp có tỉ lệ ngay dưới 4.5 cho kết quả < 4.5.
- [ ] **Step 2: `svg.spec.ts`:**
  - Dịch ngược `d` thành tập ô (hàm trợ giúp trong test) phải **bằng đúng** `toMatrix(...).modules`. Kiểm với `margin` 0 và 4.
  - `viewBox` = `0 0 W W`. Không có `width`/`height` khi không truyền `size`.
  - `size: 300` cho `width="300" height="300"`; `size: '40mm'` cho `width="40mm"`.
  - Từ chối `size`: `-1`, `'40 mm'`, `'40mm"'`, `'1e3'`.
  - Từ chối `margin`: 17, -1, 1.5.
  - `background: 'transparent'` thì không có `<rect`, và nhận mọi `foreground` hex.
  - Từ chối màu: `foreground: '#ffffff'` trên nền trắng; `foreground: '#777777'` trên nền trắng (tương phản < 4.5); màu ô sáng hơn nền (`#ffffff` trên `#000000`).
  - `escapeAttr('<a "b" & \'c\'>')` === `'&lt;a &quot;b&quot; &amp; &#39;c&#39;&gt;'`.
  - Màu viết hoa (`'#FFF'`) và viết thường (`'#fff'`) đều hợp lệ, và xuất ra đúng giá trị đã truyền.
- [ ] **Step 3: Chạy, thấy fail.**
- [ ] **Step 4: Viết `color.ts`, `svg.ts`.**
  - Hàm thoát ký tự `& < > " '` dùng cho mọi giá trị thuộc tính.
  - Tuỳ chọn ma trận chuyển nguyên cho `toMatrix`.
- [ ] **Step 5: Chạy, thấy pass.**
- [ ] **Step 6: Commit** — `feat(render): toSvg`

---

### Task 5: Logo ở giữa

**Files:**
- Create: `src/logo.ts`, `test/logo.spec.ts`
- Modify: `src/svg.ts`, `src/index.ts`

**Interfaces:**
- Consumes: `toSvg`, `QrMatrix` (Task 3–4).
- Produces:

```ts
export interface LogoOptions { href: string; size?: number; padding?: number; background?: string }
// logo.ts (nội bộ)
export function logoBox(matrix: Pick<QrMatrix, 'size' | 'version'>, size: number, padding: number):
  { logoStart: number; logoSide: number; clearStart: number; clearSide: number }   // toạ độ ô, chưa cộng margin
export function checkLogoHref(href: string): string   // trả lại href hoặc ném INVALID_VALUE
```

- **Hình học:**
  - `n = ceil(size × matrix.size)`. Nếu `n` khác chẵn lẻ với `matrix.size` thì `n += 1`.
  - `logoSide = n`, `logoStart = (matrix.size − n) / 2`.
  - `clearSide = n + 2 × padding`, `clearStart = logoStart − padding`.
- **Từ chối (`INVALID_VALUE`):**
  - `clearSide² > 0.10 × matrix.size²`;
  - hoặc `clearStart < (version ≥ 7 ? 11 : 9)`. Ngưỡng 9 tránh finder, dải phân cách, ô định dạng ở hàng/cột 8 và timing ở hàng/cột 6. Ngưỡng 11 tránh thêm ô thông tin phiên bản ở 3 hàng/cột trước finder trên-phải và dưới-trái.
- **`ecc` khi có logo:** không truyền `ecc` thì dùng `'H'`; truyền `'H'` thì được; truyền mức khác thì `INVALID_VALUE`.
- **`href` hợp lệ** (`checkLogoHref`) khi khớp một trong:
  - `^data:image/(png|jpeg|webp|svg\+xml)(;base64)?,`
  - `^https?://`
  - đường dẫn tương đối: không có `:` đứng trước `/`, `?` hoặc `#` đầu tiên, và không bắt đầu bằng `//`.
- **SVG:**
  - Ô tối trong vùng xoá bị bỏ khỏi `d`.
  - Sau `<path>`, thêm `<rect x y width height fill="LOGO_BG"/>` phủ vùng xoá (nếu nền logo không phải `transparent`).
  - Tiếp theo là `<image href="…" x y width height preserveAspectRatio="xMidYMid meet"/>` đặt ở vùng logo. Toạ độ cộng `margin`.
  - `LOGO_BG` mặc định bằng `background` của QR. Nếu cả hai đều `transparent` thì không có `rect`.

- [ ] **Step 1: `logo.spec.ts`:**
  - **Hình học:**
    - Phiên bản 5 (size 37), `size` 0.2, `padding` 1 → `logoSide` 9, `clearSide` 11, `clearStart` 13.
    - Phiên bản 3 (29) → 7 / 9 / 10.
  - **Từ chối:**
    - Phiên bản 1 (21) với mặc định: `clearStart` 7 < 9.
    - Một cấu hình có `clearSide² / size²` vừa trên 0.10.
    - Một cấu hình phiên bản ≥ 7 có `clearStart` 9 hoặc 10, dù hợp lệ ở phiên bản < 7.
  - **Chấp nhận:** đúng mép 10% và đúng `clearStart` 9 (hoặc 11 khi phiên bản ≥ 7).
  - **`size`:** 0, 0.26, -0.1 bị từ chối; 0.25 được. **`padding`:** 5, 1.5 bị từ chối.
  - **`checkLogoHref`:**
    - Nhận: `data:image/png;base64,AAAA`, `https://x.vn/a.png`, `logo.svg`, `img/logo.png`.
    - Từ chối: `javascript:alert(1)`, `JAVASCRIPT:x`, `data:text/html,x`, `//evil.com/a.png`, `vbscript:x`, ` javascript:x` (có khoảng trắng đầu).
  - **SVG có logo:**
    - Dịch ngược `d`: không có ô nào trong vùng xoá. Mọi ô ngoài vùng xoá vẫn đúng như `toMatrix`.
    - Có `<image` với `href` đã thoát ký tự.
    - Mức sửa lỗi:
      - không truyền `ecc` thì kết quả mã hoá ở H (so với `toMatrix(text, { ecc: 'H' })`);
      - `ecc: 'H'` được;
      - `ecc: 'M'` → `INVALID_VALUE`.
    - `href` chứa `"` (ví dụ `logo.svg" onload="x`) bị thoát thành `&quot;`, không tạo thuộc tính mới.
- [ ] **Step 2: Chạy, thấy fail.**
- [ ] **Step 3: Viết `logo.ts`, nối vào `svg.ts`.** Thông báo lỗi nêu số liệu và gợi ý, ví dụ `Logo area is 12.4% of the code (max 10%); use a smaller size or padding, or a larger minVersion.`
- [ ] **Step 4: Chạy, thấy pass.**
- [ ] **Step 5: Commit** — `feat(render): centre logo with excavation and ECC H`

---

### Task 6: Trang quét thử và bảng kết quả

**Files:**
- Create:
  - `ts/packages/render/scripts/scan-sheet.mjs`
  - `ts/packages/render/test/scan-sheet.spec.ts`
  - `conformance/scan-inputs.example.json`
  - `conformance/scans.md`
- Modify:
  - `.gitignore`: thêm `ts/packages/render/scan-sheet/`.
  - `conformance/README.md`: định dạng file đầu vào thật, cách chạy, quy tắc an toàn.

**Interfaces:**
- Consumes: `toSvg` (Task 4–5) từ `dist` của gói; `encodeVietQr`, `decodeVietQr` từ `@tingqr/core`.
- Produces: script và các hàm thuần (export từ `scan-sheet.mjs`):

```js
export function loadEntries({ conformanceDir, scanInputsPath })  // → [{ id, real: boolean, payload, expect: { bankBin, accountNumber, amount?, purpose? } }]
export function renderSheet(entries, { logoHref })               // → chuỗi HTML
```

- **Nguồn mã:**
  - Mẫu giả: mọi file `conformance/vectors/vietqr/*.json` có `kind: 'valid'` và có `input`. Đánh dấu `real: false`.
  - Mã thật: file JSON ở `process.env.TINGQR_SCAN_INPUTS`, mặc định là `join(conformanceDir, 'private', 'scan-inputs.json')`. File là mảng `{ id, input }`, `input` như `encodeVietQr`. Đánh dấu `real: true`.
  - Thiếu file thật thì bỏ qua, không lỗi.
  - Mỗi entry có `payload = encodeVietQr(input)`. `expect` lấy từ `decodeVietQr(payload)`.
- **HTML:**
  - Đầu trang có cảnh báo: "Dừng ở màn hình xác nhận. Nếu chuyển thì chỉ chuyển cho chính mình, số tiền nhỏ."
  - Mỗi entry có hai QR: không logo, và có logo. Logo thử là SVG `data:` do script tự dựng (chữ "tq" trên nền tròn), không phải logo ngân hàng.
  - QR in ở kích thước `size: '40mm'`.
  - Mã giả có nhãn "Tài khoản giả: chỉ kiểm app đọc được mã, không chuyển tiền".
  - Có CSS `@media print` để vừa trang A4.
- **Đầu ra:** `ts/packages/render/scan-sheet/index.html`. Script chỉ in số mã và đường dẫn file, không bao giờ in `payload` hay số tài khoản.

- [ ] **Step 1: `scan-sheet.spec.ts`** (file thật giả lập bằng file tạm qua `scanInputsPath`, không đụng thư mục riêng tư):
  - `loadEntries` không có file thật: chỉ có mẫu giả, đều `real: false`, số lượng bằng số mẫu VietQR `valid` có `input`.
  - Có file tạm với một entry: entry đó `real: true`, `expect.accountNumber` đúng.
  - `renderSheet`: có cảnh báo; mỗi entry có 2 `<svg`; mẫu giả có nhãn "Tài khoản giả"; chứa `40mm`.
  - Chạy script như tiến trình con với `TINGQR_SCAN_INPUTS` trỏ file tạm chứa số tài khoản `'9999888877'`: stdout **không** chứa `9999888877`.
- [ ] **Step 2: Chạy, thấy fail.**
- [ ] **Step 3: Viết script.** Script import `toSvg` từ `../dist/index.js` (build trước khi chạy). Thêm script `"scan-sheet": "pnpm build && node scripts/scan-sheet.mjs"` vào `package.json`.
- [ ] **Step 4: Tạo các file đi kèm:**
  - `conformance/scan-inputs.example.json`: dữ liệu giả, BIN `970422`, tài khoản `0123456789`.
  - `conformance/scans.md`:
    - đoạn mở đầu: ai điền, quy tắc an toàn, chỉ ghi `id`;
    - bảng trống có cột: ngày, người quét, app và phiên bản, thiết bị, `id`, logo (có/không), màn hình/giấy, kết quả, ghi chú.
- [ ] **Step 5: Chạy, thấy pass.** Chạy thử `pnpm -C ts/packages/render scan-sheet` **không** có file thật: in số mã, tạo được file HTML.
- [ ] **Step 6: Commit** — `feat(render): scan sheet for real-app VietQR tests`

---

### Task 7: Đóng gói, mutation, CI, tài liệu

**Files:**
- Create:
  - `ts/scripts/check-render-package.mjs`
  - `ts/packages/render/{NOTICE, stryker.config.json}`
  - `NOTICE` (gốc repo)
- Modify:
  - `.github/workflows/ci-ts.yml`, `.github/workflows/mutation-ts.yml`
  - `ts/package.json`: script `check:render`.
  - `CLAUDE.md`, `ts/CLAUDE.md`.

- [ ] **Step 1: `check-render-package.mjs`:**
  - `dependencies` đúng bằng `{ "@tingqr/core": "workspace:*" }`;
  - không có peer/optional dependency;
  - tarball ≤ 25 000 byte;
  - `require('@tingqr/render').toSvg` là function.

  Chạy `pnpm build:all && pnpm -C ts check:render`, ghi kích thước vào commit.
- [ ] **Step 2: NOTICE.** `NOTICE` của gói và của repo ghi:
  - "This product includes software from the QR Code generator library by Project Nayuki (MIT License), https://www.nayuki.io/page/qr-code-generator-library";
  - kèm toàn văn giấy phép trong header.
- [ ] **Step 3: Mutation.**
  - `stryker.config.json` sao từ `core`, với `mutate: ["src/**/*.ts", "!src/qrcodegen.ts"]`.
  - Thêm devDependencies Stryker như `core`.
  - Chạy `pnpm -C ts/packages/render mutate`. Kỳ vọng: ≥ 90%.
  - Đột biến không tương đương còn sống: viết test giết nó. Đột biến tương đương: liệt kê trong commit message.
- [ ] **Step 4: CI.**
  - `ci-ts.yml`: thêm bước `node ts/scripts/check-render-package.mjs` sau bước kiểm `core`.
  - `mutation-ts.yml`: thêm `ts/packages/render/**` vào `paths`, thêm bước `pnpm -C ts/packages/render mutate`, và tải báo cáo của `render`.
- [ ] **Step 5: Tài liệu.**
  - `CLAUDE.md`: trạng thái Plan 4; "trang quét thử có, chưa có kết quả quét"; giới hạn logo là tạm thời.
  - `ts/CLAUDE.md`:
    - gói `render`;
    - file Nayuki không sửa tay ngoài danh sách thay đổi;
    - lệnh `scan-sheet` chỉ chủ dự án chạy với dữ liệu thật.
- [ ] **Step 6: Kiểm toàn bộ.**
  - Lệnh: `pnpm test:all && pnpm typecheck:all && pnpm build:all && pnpm -C ts check:core && pnpm -C ts check:render && pnpm test:recipe`.
  - Kỳ vọng: PASS. Mutation `core` vẫn ≥ 90%.
- [ ] **Step 7: Commit** — `chore(render): package checks, mutation, CI and docs`
