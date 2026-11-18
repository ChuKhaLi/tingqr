# ts/ — phần TypeScript

- Lệnh (chạy trong `ts/`): `pnpm install`, `pnpm test`, `pnpm build`, `pnpm typecheck`.
  Một file test: `pnpm -C packages/core exec vitest run <tên>`.
- `@tingqr/core` **không có dependency lúc chạy** và không import `node:*` trong `src/` (phải chạy được trên
  trình duyệt, Node, Workers). devDependency thì được.
- Test đặt ở `packages/<gói>/test/*.spec.ts`. Bộ chạy mẫu thử dùng chung ở `packages/core/test/conformance.spec.ts`;
  thêm loại QR mới = thêm dòng vào bảng `SCHEMES` ở đó.
- Mã lỗi và cảnh báo lấy từ `../conformance/errors.json`; không thêm mã ngoài bảng.
