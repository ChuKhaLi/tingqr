# ts/ — phần TypeScript

- Lệnh (chạy trong `ts/`): `pnpm install`, `pnpm test`, `pnpm build`, `pnpm typecheck`.
  Một file test: `pnpm -C packages/core test <tên>`.
- `@tingqr/core` **không có dependency lúc chạy** và không import `node:*` trong `src/` (phải chạy được trên
  trình duyệt, Node, Workers). devDependency thì được.
- Test đặt ở `packages/<gói>/test/*.spec.ts`. Bộ chạy mẫu thử dùng chung ở `packages/core/test/conformance.spec.ts`;
  thêm loại QR mới = thêm dòng vào bảng `SCHEMES` ở đó.
- Mã lỗi và cảnh báo lấy từ `../conformance/errors.json`; không thêm mã ngoài bảng.
- Test không được dùng đường dẫn cố định tới `conformance/`; dùng `CONFORMANCE_DIR` trong `packages/core/test/conformance-root.ts`
  (Stryker chép gói vào thư mục sandbox sâu hơn).
- **Mutation test:** `pnpm -C packages/core mutate` (Stryker, ~1 phút). Ngưỡng chặn 90% trong `stryker.config.json`;
  CI chạy ở `.github/workflows/mutation-ts.yml`. Báo cáo HTML ở `packages/core/reports/mutation/` (không commit).
  - Đột biến sống sót đã biết là tương đương, không cần test: anchor `^`/`$` của regex kiểm tag và độ dài (chỉ nhận lát
    cắt đúng 2 ký tự), nhánh `instanceof TingQrError` khi bắt lỗi (chỉ có TingQrError được ném), và chuỗi thông báo lỗi.
  - Đột biến khác sống sót là lỗ hổng test: viết test giết nó, đừng hạ ngưỡng.
- **`@tingqr/render`:**
  - `src/qrcodegen.ts` là bản port của Nayuki v1.8.0. **Không sửa tay** ngoài danh sách thay đổi ghi ở đầu file. Mẫu
    ma trận trong `conformance/vectors/render/` (sinh từ file gốc bằng `conformance/tools/oracle/gen-render.mjs`) là bằng
    chứng cho bản port.
  - File port có `// @ts-nocheck` và không chạy mutation (`stryker.config.json` loại trừ); code còn lại của gói vẫn
    chặt như `core`.
  - `pnpm check:render` (sau `pnpm build`): chỉ phụ thuộc `@tingqr/core`, toàn văn giấy phép MIT của Nayuki còn trong
    mọi file `dist` có bộ mã hoá (bản ESM tách chunk chung), có `LICENSE` giống của repo, tarball dưới 33 000 byte
    (chủ dự án nâng từ 30 000 ngày 2026-11-21 cho `render/canvas`; đo 32 340 ngày 2026-11-21, còn rất ít chỗ).
  - `src/layout.ts`: kiểm tuỳ chọn và tính bố cục, dùng chung cho `toSvg` và canvas. Thêm luật mới về màu, logo hay ECC
    thì sửa ở đây.
  - **`@tingqr/render/canvas`** (`src/canvas.ts`): `drawQr`, `toPng`, `toPngBlob`, `toPngDataUrl`.
    - **Chỉ ESM:** `scripts/esm-only-canvas.mjs` xoá `dist/canvas.cjs` sau tsup. Lý do: CJS không tách chunk, sẽ chép
      thêm cả bộ mã hoá và vượt ngân sách. `onSuccess` của tsup không làm được, vì chạy trước khi bước `.d.cts` xong.
    - Kiểu DOM chỉ khai báo qua `/// <reference lib="dom" />` ở `canvas.ts`. Test dùng canvas giả
      (`test/fake-canvas.ts`), không có trình duyệt thật.
    - `test/package.spec.ts` chạy trên `dist`: import gốc không kéo code canvas, chỉ một bản bộ mã hoá.
  - `pnpm -C packages/render scan-sheet`: trang quét thử. Chỉ chủ dự án chạy khi có dữ liệu thật; khi thử, dùng
    `TINGQR_SCAN_INPUTS=../../../conformance/scan-inputs.example.json` (đường dẫn tính từ `packages/render`; file không có thì script chỉ in mẫu, không báo lỗi).
- `pnpm test` và `pnpm typecheck` tự build trước (`render` đọc `@tingqr/core` qua `dist`, test trang quét thử chạy `dist` của
  `render`), nên chạy được trên clone sạch.
- `pnpm check:core` (sau `pnpm build`): lõi không có dependency/peer/optional, có `LICENSE` giống của repo, tarball dưới
  45 KB, mỗi subpath CJS `require` được, tầng EMV chỉ có một bản trong CJS.
- **CJS subpath là file một dòng** `module.exports = require('./index.cjs')`, do `onSuccess` trong `tsup.config.ts` ghi
  đè (CJS không tách chunk được, để nguyên thì mỗi subpath tự chứa một bản lõi). ESM vẫn tách chunk bình thường.
  Thêm subpath mới: thêm vào `SUBPATHS` ở `tsup.config.ts` và ở `scripts/check-core-package.mjs`.
- **`@tingqr/core/banks`** là ngoại lệ: không xuất từ gốc. Nó nằm trong `STANDALONE` của `tsup.config.ts`, nên bản CJS là
  bundle riêng, mang bản `TingQrError` riêng. `instanceof` vẫn đúng giữa các bản nhờ `Symbol.hasInstance` trong
  `errors.ts`.
  - `src/banks/data.ts` sinh từ `conformance/banks/` bằng `node conformance/tools/banks/sync-ts.mjs`. Không sửa tay;
    `banks-sync.spec.ts` báo khi lệch. File này không chạy mutation.
  - Ngân sách tarball core nâng lên 45 KB ngày 2026-11-20 (chủ dự án duyệt), vì dữ liệu ngân hàng.
- **`@tingqr/bank-logos`:** không có `src/`.
  - `scripts/gen.mjs` sinh `dist/` (mỗi ảnh một module), `files/` (gitignore) và `LOGOS-NOTICE.md` (commit) từ
    `conformance/banks/logos/`.
  - Bản ESM là data URI. Bản CJS là đường dẫn tới file ảnh, vì chủ dự án chọn không chứa base64 hai lần.
  - Test chạy trên `dist` đã build, gồm cả test tree-shaking bằng esbuild.
  - `pnpm check:bank-logos` (sau `pnpm build`): không dependency, có `LICENSE` và `LOGOS-NOTICE.md`, tarball dưới
    2 270 000 byte.
- **Dữ liệu ngân hàng:** sửa theo skill `update-banks`; công cụ ở `conformance/tools/banks/`
  (`pnpm -C conformance/tools/banks test`, không gọi mạng).
- **`@tingqr/hono`:** tsup, ESM + CJS. `hono` là peer `^4.0.0`; `src` type-check với lib `WebWorker` (có `Response`,
  không có `document`).
  - `pnpm check:hono` (sau `pnpm build`): chỉ phụ thuộc `core` + `render`, không import `node:*`, tarball dưới 6 250 byte.
- **`@tingqr/angular`:** build bằng `ng-packagr` (toolchain Angular 20.3, biên dịch partial) ra `dist/`.
  - `publishConfig.directory: "dist"`, nên `pnpm pack`/`publish` lấy từ `dist` và thay `workspace:*` bằng số phiên bản.
  - **Test chạy trên `dist`** (alias `@tingqr/angular` trong `vitest.config.ts`): `@angular/compiler` ở `test/setup.ts`
    biên dịch JIT các khai báo partial lúc chạy. Vì vậy phải build trước khi test (`pnpm test` ở `ts/` tự build).
    - Không dùng `@analogjs/vite-plugin-angular`: plugin này không nhận ra signal input (lỗi NG0303).
    - Component host viết trong file test được biên dịch JIT từ mã nguồn, nên **không dùng `input()`** ở đó; dùng
      `signal()` thường.
  - `test/ssr.spec.ts` render bằng `@angular/platform-server`, môi trường `node`, zoneless.
  - jsdom không có canvas: `test/component-img.spec.ts` thay `document.createElement('canvas')` bằng canvas giả.
  - `pnpm check:angular` (sau `pnpm build`): đóng gói từ `dist`, peer Angular `>=20.0.0`, không còn `workspace:`, tarball
    dưới 10 000 byte.
- **`@tingqr/nestjs`:** tsup, ESM + CJS. NestJS 12 là ESM thuần, nên bản CJS của gói dựa vào `require(esm)` của Node
  (≥ 20.19).
  - **Mọi tham số inject dùng `@Inject(TOKEN)` tường minh**, vì tsup/esbuild không phát decorator metadata. Code test
    (biên dịch bằng esbuild) cũng phải làm vậy.
  - Test chạy trên `dist` (alias `@tingqr/nestjs` trong `vitest.config.ts`). `test/app.spec.ts` dựng app mẫu
    (`test/sample-app.ts`) trên cả Express và Fastify, gọi qua cổng thật; header so từng chữ.
  - Cấu hình kiểm trong `resolveOptions` (`src/options.ts`) lúc khởi động. Hợp đồng HTTP (header, 404/400, logo phải
    là data URI) theo `conformance/http/svg-response.json`, chung với `@tingqr/hono`; test của cả hai gói đọc file đó.
  - `pnpm check:nestjs` (sau `pnpm build`): chỉ phụ thuộc `core` + `render`, peer NestJS `>=10.0.0`, tarball dưới
    10 000 byte.
- `pnpm typecheck` build mọi gói trước (`pnpm -r build`), vì test Angular và NestJS đọc kiểu gói từ `dist`.
