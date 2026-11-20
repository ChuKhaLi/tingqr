# Handoff: tingqr — Plan 5 đang brainstorm (2026-11-20 19:59)
Session: e42cfa54-b63e-43ec-b7f2-8bf7b798b3b7 · Supersedes: docs/superpowers/handoffs/2026-11-19-0633-plan-3-native.md
Read first:
- `CLAUDE.md`, `ts/CLAUDE.md`, `conformance/README.md`
- Spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md`: **mục 5.4** (danh sách ngân hàng, logo), **5.5** (link mở
  app), dòng ~341 (`update-banks`)
- Thiết kế Plan 4 `docs/superpowers/specs/2026-11-19-tingqr-render-design.md` (logo giữa QR, giới hạn tạm thời)
- Noel tree, người dùng thật đầu tiên: `../noel-tree/src/app/tree/bank-apps.ts`, `../noel-tree/public/banks/README.md`

## State (checked 2026-11-20 19:59)
- Repo `F:\Projects\MyProjects\tingqr`, nhánh `main` tại `c864818 Merge branch 'fix/plan-4-minors'`, **khớp `origin/main`**
  (đã push). Thư mục sạch, không worktree phụ, không stash.
- GitHub (`ChuKhaLi/tingqr`, riêng tư): CI và mutation của `c864818` đều **success** (mutation 16 phút 38 giây, giới hạn 30).
  Không có PR mở.
- Test chạy lần cuối 2026-11-20 sáng trên bản build sạch (`rm -rf ts/packages/*/dist` rồi chạy):
  - `pnpm typecheck:all` sạch;
  - `pnpm test:all`: core 590, render 205 pass;
  - `pnpm -C ts check:core` (29 852 byte / 40 000) và `check:render` (28 700 / 30 000): ok;
  - `pnpm test:recipe`: 33 pass.
  - Mutation `render` 94,93% (ở máy). Chưa chạy lại sau đó.

## Done and verified
- **Plan 3** (PromptPay, KHQR, `detect()`), gộp và push 2026-11-19. Sau đó:
  - PR #4: CJS subpath là file một dòng, gói core giảm khoảng 5 KB;
  - PR #5: `encodeKhqr` nhận cả mã số `116`/`840`.
- **Plan 4** (`@tingqr/render`): `toMatrix`, `toSvg`, logo giữa QR, bộ mã hoá port từ Nayuki v1.8.0, mẫu ma trận từ file
  Nayuki gốc, trang quét thử VietQR, `conformance/scans.md`. Đã qua code review + evidence-review, lượt sửa, và các điểm
  nhỏ. Gộp và push.
- `conformance/scans.md` là **bảng quét duy nhất** (thay `docs/conformance-matrix.md` trong spec 5.7, skill `add-scheme`,
  agent `evidence-review`).

## Done but NOT verified
- **Chưa quét QR nào bằng app thật** (VietQR, VNPAY, PromptPay, KHQR), kể cả bản có logo. `conformance/scans.md` còn trống.
  - Mọi VietQR có logo nằm ở phiên bản 7–12 khi dùng mức H, nên logo luôn xoá pattern căn chỉnh ở giữa. Giới hạn logo
    (`size` ≤ 0.25, xoá ≤ 10%) là **tạm thời**.
  - **Không in bảng treo có logo trước khi quét thử** bản có logo bằng ít nhất 2 app, cả trên màn hình lẫn giấy.
  - Cách làm: chủ dự án ghi tài khoản vào `conformance/private/scan-inputs.json` (mẫu ở
    `conformance/scan-inputs.example.json`), chạy `pnpm -C ts/packages/render scan-sheet`, quét, ghi vào `scans.md`.
- **Chưa xem tận mắt trang quét thử:** Playwright chặn URL `file:`. SVG chỉ được chứng minh bằng test dịch ngược đường vẽ.

## In progress
- **Plan 5, đang brainstorm** (skill `superpowers:brainstorming`).
  - **Chưa viết bản thiết kế, chưa có plan, chưa có code.**
  - Các quyết định đã chốt nằm ở mục Decisions dưới đây.

## Next actions
1. Tiếp brainstorm Plan 5 từ bước **viết bản thiết kế**.
   - Ghi vào `docs/superpowers/specs/2026-11-20-tingqr-banks-design.md` theo khung của
     `2026-11-19-tingqr-render-design.md`.
   - Ghi mọi quyết định ở mục Decisions, chia ba phần: dữ liệu và API trong core; `@tingqr/bank-logos`; bảo trì tự động.
2. Gửi một agent mới đọc thử bản thiết kế (`builder-check-prompt.md` của skill brainstorming). Gom câu hỏi "của chủ dự án"
   hỏi một lần, rồi đưa bản thiết kế để duyệt.
3. Duyệt xong thì commit bản thiết kế. Viết plan bằng `superpowers:writing-plans`, theo khung
   `docs/superpowers/plans/2026-11-19-plan-4-render.md`. Hỏi chủ dự án chọn Native hay Subagent-driven (Plan 3 và 4 đã
   chọn Native).
4. Việc cần tải mạng (vietqr.io, Google Play, Wikimedia) là việc của script `update.mjs` và Action. Khi chạy thử ở máy,
   nói rõ trước là sẽ gọi mạng.

## Needs the user
- **Quét VietQR bằng app thật** (xem "Done but NOT verified"). Không chặn Plan 5. Nên làm trước phần icon-giữa-QR của
  Plan 5, và bắt buộc trước v0.1 (spec 5.7: ít nhất 2 app, một QR tĩnh và một QR có số tiền).
- **Dọn dẹp, chưa hỏi xong** (xem Loose ends): xoá 3 nhánh remote cũ? Xoá file tạm trong scratchpad?
- Các điểm nhỏ còn tồn **từ Plan 3**, chưa sửa, gom một PR khi tiện:
  - truyền `undefined` vào bộ tạo mã thì ném `TypeError` thay vì `TingQrError`;
  - mã ngôn ngữ tag 64 của KHQR nhận ký tự bất kỳ;
  - USD nguyên của KHQR chưa có mẫu sinh bằng SDK;
  - thông báo khi thiếu tag 01 hiện ra `"undefined"`;
  - PromptPay chưa đọc tag 64;
  - `check-promptpay` chưa có bộ đọc thứ hai.
- Plan 2 Task 5–6 (chụp QR MoMo/ZaloPay thật, nhận diện ví) vẫn hoãn. Không chặn gì.

## Loose ends
- **3 nhánh cũ trên remote**, chắc đã gộp từ thời Plan 2: `chore/pnpm-minors-mutation`, `chore/tighten-claude-permissions`,
  `fix/plan-2-minors`. Chưa xoá; chờ chủ dự án.
- **File tạm trong scratchpad của session này** (`C:\Users\chung\AppData\Local\Temp\claude\b27eeda5edbad922\e42cfa54-b63e-43ec-b7f2-8bf7b798b3b7\scratchpad\`):
  - bản `qrcodegen.ts` tải về;
  - file test của các oracle PromptPay (`src/`);
  - script Python sinh mẫu (`scripts/`);
  - log test và mutation;
  - file thử của các reviewer (`nc/`, `both.mjs`, `probe.mjs`, `surv.cjs`).

  Không có bí mật hay dữ liệu thật: các số 9–10 chữ số trong log là tài khoản giả của test. Chưa xoá.
- Không có tiến trình nền, dev server hay tunnel nào chạy.
- Trình duyệt Playwright có thể đã mở một lần (lệnh mở URL `file:` bị chặn). Không đăng nhập gì.
- `gh` CLI đăng nhập tài khoản `ChuKhaLi` từ trước, không đổi.

## Decisions (don't relitigate)
**Plan 5 (chủ dự án, 2026-11-20):**
- **Làm Plan 5 trước Plan 6.**
- **Logo cần cả hai loại:**
  - **Logo ngang**, theo ngân hàng, đặt tên theo BIN, để hiện cạnh tên ngân hàng. Nguồn như spec 5.4: SVG Wikimedia
    PD-textlogo/PD-simple, còn lại PNG `cdn.vietqr.io/img/`.
  - **Icon vuông**, theo app, đặt tên theo `id` của app trong `bank-apps.json`, để đặt giữa QR và làm nút mở app. Nguồn
    `cdn.vietqr.io/bank-app-icon/<id>-ios.webp`, như Noel tree.
  - Icon giữa QR ghi rõ là tạm thời cho tới khi có kết quả quét bản có logo.
- **`bankAppLink` chỉ mở app, không điền sẵn số tiền/nội dung** (giữ spec 5.5). Noel tree tự giữ phần điền sẵn qua
  `dl.vietqr.io`. Có thể thêm tuỳ chọn sau mà không phá API.
- **`@tingqr/bank-logos` phát hành theo cách A:** mỗi logo là một module nhỏ trả data URI (ví dụ
  `@tingqr/bank-logos/icon/mb`), kèm file ảnh gốc trong gói. Chạy được trên SSR/Workers, bundler chỉ lấy logo được import.

**Plan 5, Claude chốt và đã nói với chủ dự án** (chủ dự án không phản đối; ghi vào thiết kế là `[Claude]`):
- Nguồn sự thật là `conformance/banks/{banks,bank-apps}.json`. Một script chép sang file TypeScript trong `src/` của core,
  có test bắt lệch. Phát hành ở subpath `@tingqr/core/banks`. Không import JSON ngoài gói, vì Stryker sandbox làm gãy
  đường dẫn.
- Script `conformance/tools/banks/update.mjs` làm ba việc: tải `api.vietqr.io`, kiểm gói trên Google Play, kiểm link logo.
  GitHub Action hằng tháng mở PR, không tự gộp. Skill `update-banks` hướng dẫn chạy.

**Trước đó (vẫn đúng):**
- Mọi hàm đọc mặc định chấp nhận lệch chuẩn.
- `currency` là mã số ở mọi loại QR; KHQR có thêm `currencyAlpha`.
- KHQR cần tag 58 là `KH` hoặc không có.
- Giới hạn tham chiếu PromptPay 20 ký tự giữ nguyên, ghi là chưa có nguồn.
- Chỉ quét VietQR bằng app Việt Nam; đầu vào thật ở `conformance/private/`, chỉ chủ dự án chạy với dữ liệu thật.
- Chạy oracle bên thứ ba chỉ qua `node conformance/tools/oracle/...` để chủ dự án được hỏi.

## Gotchas
- **Python ghi file có `\uXXXX`:** Python biến `\uD800` thành surrogate thật, ghi lỗi giữa chừng và **làm trống file**
  (đã xảy ra hai lần, khôi phục bằng `git checkout`). Chỗ nào có `\u` thì dùng công cụ Edit.
- **Heredoc trong Bash có thể rút `\\` thành `\`** khi viết test có dấu `\`. Kiểm lại file sau khi ghi, hoặc dùng Edit.
- **Lệnh Bash chứa chuỗi `conformance/private` bị chặn**, kể cả khi chỉ sửa file khác. Dùng Edit.
- **Edit tool báo "File has not been read yet"** với file trong worktree mới, dù đã đọc bản ở `main`: phải Read đúng đường
  dẫn worktree. Hai lần commit thiếu file vì lỗi này; kiểm `git status` trước commit.
- **`git worktree remove` hay để sót thư mục** ("Directory not empty"). So bằng `diff -rq --strip-trailing-cr`
  (loại `node_modules`, `dist`, `.git`, `reports`, `.stryker-tmp`, `scan-sheet`) trước khi `rm -rf`.
- **`render` đọc `@tingqr/core` qua `dist`:** `pnpm test`/`typecheck` ở `ts/` tự build trước. Gọi `vitest` thẳng trong một
  gói thì phải build trước.
- **esbuild bỏ comment thường:** header giấy phép phải mở bằng `/*!`, nếu không sẽ mất trong `dist`.
- **Gói `render` 28 700 / 30 000 byte:** còn rất ít chỗ.
- **Mutation trên CI mất 13–17 phút**, giới hạn 30 phút.
- **Playwright không mở được `file:`.** Muốn xem trang HTML cục bộ thì phải chạy một server tĩnh.
