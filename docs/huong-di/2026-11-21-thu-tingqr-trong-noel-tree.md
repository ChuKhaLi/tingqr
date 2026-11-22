# Thử tingqr trong Noel tree (Plan 6, Task 8)

Ngày: 2026-11-21. Plan: `docs/superpowers/plans/2026-11-21-plan-6-angular-hono.md`. Thiết kế:
`docs/superpowers/specs/2026-11-21-tingqr-angular-hono-design.md` mục 5.4.

## Làm ở đâu

- Repo `../noel-tree`, nhánh `try/tingqr` tách từ `main` của Noel tree (`f286755`). Làm trong **git worktree riêng**
  `../noel-tree-try-tingqr`, vì thư mục `../noel-tree` đang ở nhánh `qua-noi` và có thay đổi chưa commit của một session
  khác. **Không push, không gộp.** Commit thử: `85374dc` (thay code), `9e289ec` (test so chuỗi).
- Bốn gói tingqr cài từ file `.tgz` (`pnpm pack` từ `plan-6`; gói `hono` đóng lại sau khi sửa lỗi 1 ở mục "Lỗi và chỗ thiếu").
  npm cài được cả bốn trong một lệnh, không cần `overrides` (quan sát lúc cài, không lưu log).

## Đã đổi trong Noel tree (hướng A, chủ dự án chọn)

- **Trình duyệt** (`src/app/tree/pay-panel.ts`):
  - chuỗi VietQR tạo bằng `encodeVietQr`, BIN tìm bằng `findBank`; thay `vietQrText` và `binOf`;
  - ảnh QR trên trang là `<tingqr-code mode="img">`; thay `qrcode-generator` cộng canvas tự viết;
  - file PNG để Lưu (QR + số tiền + mã đơn) vẽ QR bằng `drawQr` lên canvas phụ, rồi `drawImage` lên ảnh ghép.
- **Máy chủ:**
  - route mới `GET /api/pay/qr/:code.svg` (`src/api/pay-qr.ts`, `tingqr({ resolve })`). Chỉ trả QR cho đơn SePay còn chờ,
    chưa hết hạn, ở cả bảng `orders` lẫn `baubles`; còn lại 404;
  - `qrUrl` của đơn quà (`orders.ts`) và đơn quả châu (`baubles.ts`) trỏ về route đó, thay `vietqr.app`.
- Test của Noel tree sửa theo:
  - hai test API khoá URL `vietqr.app`;
  - ba test `pay-panel` kiểm phần vẽ cũ.

  Thêm `test/api/pay-qr.spec.ts` (các ca 404) và phần kiểm PNG từng điểm ảnh trong e2e `pay.spec.ts`.

## Kết quả (chạy 2026-11-21, máy của chủ dự án, Windows)

Log từng nằm trong thư mục làm việc của Plan 6 (`.superpowers/sdd/2026-11-21-plan-6-angular-hono/`, không commit; đã xoá
khi dọn dẹp ngày 2026-11-21, sau khi evidence-review đối chiếu số liệu với log):
`noel-test-before.log`, `noel-api-2.log`, `noel-web-3.log`, `noel-measure.log` (tsc, build, budget, tổng JS, đo trước
và sau bằng cùng script), `noel-e2e.log`, `noel-e2e-all.log`, `noel-vietqr-equal.log`.

| Việc | Trước | Sau |
|---|---|---|
| `npm run test:api` | 838 pass | 842 pass (thêm 4) |
| `npm run test:web` | 1402 pass | 1402 pass |
| `tsc` app và Worker | sạch | sạch (`noel-measure.log`) |
| `ng build` (Angular 21.2, SSR) | đạt | đạt |
| JS nạp đầu (`npm run budget`) | 121,6 KB gzip | 121,6 KB gzip (không đổi; `noel-measure.log`) |
| Tổng JS phía trình duyệt (cộng từng file) | 69 file, 1 693 517 byte, gzip 504 292 | 70 file, 1 738 531 byte, gzip 517 508 (**+45 KB thô, +13,2 KB gzip**, đều nạp lười; `noel-measure.log`) |
| e2e `pay.spec.ts`, `bauble.spec.ts` (Chromium thật, `wrangler dev`) | chưa chạy riêng | đạt |
| e2e toàn bộ (`npx playwright test`) | chưa chạy | 81 pass (`noel-e2e-all.log`) |

**Đã chứng minh:**

- `encodeVietQr` của tingqr cho ra **đúng từng byte** chuỗi mà `vietQrText` của Noel tree tạo. Test ba ca trong nhánh thử
  (`src/app/tree/vietqr.spec.ts`, commit `9e289ec`): tài khoản số 20 000 đ, tài khoản ảo có cả chữ lẫn số (13 ký tự, dạng tài khoản nhận của Noel tree; số thật không ghi ở đây)
  10 000 đ, BIN Vietcombank 49 000 đ.
- Trên Chromium thật, ảnh PNG mà `<tingqr-code>` hiện ra khớp từng ô với ma trận của chuỗi VietQR của đơn. e2e đọc
  điểm ảnh ở tâm mỗi ô (14 px mỗi ô, viền 4 ô).
- Gói `@tingqr/angular` (biên dịch partial bằng toolchain Angular 20) được Angular 21.2 build và chạy được.
- Route `@tingqr/hono` chạy trên Workers (`wrangler dev`). Đơn còn chờ thì trả 200 SVG, đúng bằng
  `toSvg(encodeVietQr(...))`; hết hạn thì 404 (test có ca 200 trước). Mã lạ, tên file sai thì 404 (`test/api/pay-qr.spec.ts`).
  "Thu tiền đang tắt thì 404" và "không dùng tham số URL" của route Noel tree chỉ **dựa vào đọc code**: test ở đó dùng mã
  không có đơn nên đằng nào cũng 404. Ở phía tingqr, test `the route never reads the query string` có kiểm thật (route
  trả 200 với cùng ảnh dù có query).

**Chưa chứng minh:**

- `<tingqr-code>` render ở máy chủ **trong Noel tree**. Màn thanh toán chỉ hiện sau khi người dùng bấm, nên chỉ chạy ở
  trình duyệt. SSR mới được kiểm bằng test của tingqr (`ts/packages/angular/test/ssr.spec.ts`, platform-server, zoneless).
- Việc nhấn giữ lưu ảnh và việc quét bằng app ngân hàng: xem mục "Cần chủ dự án".

## Lỗi và chỗ thiếu phải sửa ngược về tingqr

1. **Đã sửa:** `resolve` của `tingqr()` nhận `Context` không mang kiểu môi trường của app, nên `c.env.DB` và
   `c.req.param()` mất kiểu trong ứng dụng thật. Đã thêm generic `tingqr<E, P>()` và `tingqrSvg<E>()` (commit `2557585`,
   có test kiểu).
2. **Chưa sửa, ghi lại:** `drawQr` luôn đặt lại cỡ canvas thành đúng cỡ QR, nên không vẽ thẳng vào một ảnh ghép lớn hơn
   (Noel tree đặt QR ở vị trí `x0, y0` trên ảnh 1080×1350). Hiện vẽ lên canvas phụ rồi `drawImage`, tắt làm mịn; cách
   này chạy tốt. Nếu nhiều dev cần thì có thể thêm tuỳ chọn vị trí sau.
3. **Chưa sửa, ghi lại:** `findBank` của `@tingqr/core/banks` kéo theo cả bảng ngân hàng và app (khoảng 28 KB thô trong
   bundle) chỉ để tra một BIN. Noel tree chỉ có một tài khoản nhận, nên phần lớn số byte tăng thêm là bảng này. Có thể
   tách bảng ngân hàng khỏi bảng app, hoặc ghi rõ trong tài liệu để dev đã biết BIN thì khỏi gọi `findBank`.
4. **Chưa sửa, ghi lại:** `TreeQr` (QR của trang cây để bạn bè quét) vẫn dùng `qrcode-generator`, nên Noel tree chưa
   bỏ được gói đó. QR này là link, không phải QR thanh toán, và nằm ngoài phạm vi thử. `toSvg` / `toPng` của tingqr vẽ
   được chuỗi bất kỳ.

## Cần chủ dự án

Chưa thử trên điện thoại thật, nên **chưa ghi vào `conformance/scans.md`**. Bảng đó chỉ người quét điền.

1. Mở màn thanh toán của nhánh thử trong Zalo và Messenger (Android, iPhone), nhấn giữ ảnh QR. Ghi lại có lưu được ảnh
   không.
2. Mở ảnh đã lưu bằng app ngân hàng (MB Bank, MyVIB), và ghi lại app có đọc đúng tài khoản, số tiền, nội dung không.
3. Ảnh SVG dự phòng (route Hono, chỉ hiện khi không tìm ra BIN) trong app chat: lưu được không.

Muốn thử trên máy thật thì cần deploy nhánh thử lên một môi trường thử của Noel tree. Việc đó do chủ dự án quyết,
theo quy trình bên Noel tree.

## Dọn dẹp

- Worktree `../noel-tree-try-tingqr` và nhánh `try/tingqr` (chỉ ở máy, chưa push) đã xoá ngày 2026-11-21 theo yêu cầu chủ
  dự án. Code thử không còn; thay đổi được mô tả ở mục "Đã đổi trong Noel tree".
