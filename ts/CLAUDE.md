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
- `pnpm check:core` (sau `pnpm build`): lõi không có dependency/peer/optional, tarball dưới 40 KB, mỗi subpath CJS `require` được, tầng EMV chỉ có một bản trong CJS.
- **CJS subpath là file một dòng** `module.exports = require('./index.cjs')`, do `onSuccess` trong `tsup.config.ts` ghi
  đè (CJS không tách chunk được, để nguyên thì mỗi subpath tự chứa một bản lõi). ESM vẫn tách chunk bình thường.
  Thêm subpath mới: thêm vào `SUBPATHS` ở `tsup.config.ts` và ở `scripts/check-core-package.mjs`.
