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
    `dist`, có `LICENSE` giống của repo, tarball dưới 30 KB.
  - `pnpm -C packages/render scan-sheet`: trang quét thử. Chỉ chủ dự án chạy khi có dữ liệu thật; khi thử, dùng
    `TINGQR_SCAN_INPUTS=../../../conformance/scan-inputs.example.json` (đường dẫn tính từ `packages/render`; file không có thì script chỉ in mẫu, không báo lỗi).
- `pnpm test` và `pnpm typecheck` tự build trước (`render` đọc `@tingqr/core` qua `dist`, test trang quét thử chạy `dist` của
  `render`), nên chạy được trên clone sạch.
- `pnpm check:core` (sau `pnpm build`): lõi không có dependency/peer/optional, có `LICENSE` giống của repo, tarball dưới
  40 KB, mỗi subpath CJS `require` được, tầng EMV chỉ có một bản trong CJS.
- **CJS subpath là file một dòng** `module.exports = require('./index.cjs')`, do `onSuccess` trong `tsup.config.ts` ghi
  đè (CJS không tách chunk được, để nguyên thì mỗi subpath tự chứa một bản lõi). ESM vẫn tách chunk bình thường.
  Thêm subpath mới: thêm vào `SUBPATHS` ở `tsup.config.ts` và ở `scripts/check-core-package.mjs`.
- **`@tingqr/core/banks`** là ngoại lệ: không xuất từ gốc. Nó nằm trong `STANDALONE` của `tsup.config.ts`, nên bản CJS là
  bundle riêng, mang bản `TingQrError` riêng. `instanceof` vẫn đúng giữa các bản nhờ `Symbol.hasInstance` trong
  `errors.ts`.
  - `src/banks/data.ts` sinh từ `conformance/banks/` bằng `node conformance/tools/banks/sync-ts.mjs`. Không sửa tay;
    `banks-sync.spec.ts` báo khi lệch. File này không chạy mutation.
  - Ngân sách tarball core nâng lên 45 KB ngày 2026-11-20 (chủ dự án duyệt), vì dữ liệu ngân hàng.
