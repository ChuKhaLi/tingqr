# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này. Trả lời chủ dự án bằng tiếng Việt.

**tingqr** là SDK mã nguồn mở về QR thanh toán, lấy Việt Nam làm đầu tàu rồi mở rộng sang QR xuyên biên giới. Có bản
TypeScript và bản .NET, kèm tích hợp sẵn cho Angular, NestJS và ASP.NET Core. Lấy cảm hứng từ `vietqr/vietqr-node` (MIT).

## Trạng thái

- **Bản thiết kế đã duyệt (2026-11-18):** `docs/superpowers/specs/2026-11-18-tingqr-design.md`. Đó là nguồn chính cho mọi
  quyết định. Mục ghi **[chủ dự án]** thì không tự đổi; mục **[Claude]** có thể đề xuất sửa.
  - Nghiên cứu nền: `docs/huong-di/2026-11-18-nghien-cuu-va-huong-di.md`.
  - **Plan 1 xong, đã gộp `main`** (2026-11-18): `docs/superpowers/plans/2026-11-18-plan-1-nen-mong-va-vietqr.md`. Lộ
    trình Plan 1–8 nằm ở đầu file đó. `@tingqr/core`: tầng EMV, tạo và đọc VietQR.
  - **Plan 2** (2026-11-18, nhánh `plan-2`): `docs/superpowers/plans/2026-11-18-plan-2-vnpay-vi-qr-that.md`.
    - Xong: đọc VNPAY-QR (`decodeVnpayQr`), `extraFields`, công cụ công thức `conformance/tools/recipe/`.
    - **Mọi hàm đọc mặc định chế độ chấp nhận lệch chuẩn**, chặt phải truyền `{ mode: 'strict' }` (chủ dự án chọn).
    - **Hoãn (chủ dự án):** Task 5 chụp QR thật và phần code Task 6 nhận diện ví. Chưa có `provider`; xem
      `conformance/schemes/vietqr-wallets.md`.
  - Repo GitHub riêng tư `ChuKhaLi/tingqr`; CI (`ci-ts.yml`) và mutation (`mutation-ts.yml`, ngưỡng 90%) chạy trên PR.
  - **Chưa quét thử bằng app thật** cho VietQR lẫn VNPAY.
  - Tiếp theo: Plan 3 (PromptPay, KHQR, `detect()`), hoặc làm nốt Task 5–6 khi có QR thật.
- **Chủ dự án đã quyết:**
  - Mục đích chính là một thư viện mã nguồn mở có tiếng; dùng phụ trong Noel tree (`../noel-tree`, Angular 21 SSR trên
    Cloudflare Workers).
  - Hướng B: đa quốc gia Đông Nam Á, Việt Nam trước, muốn đi trước ở QR xuyên biên giới.
  - Chỉ riêng `@tingqr/core` không có dependency. Bộ mã hoá QR port từ Nayuki (MIT) vào `@tingqr/render`, không bọc
    thư viện QR khác. Thư viện native chỉ ở gói vẽ ảnh cho máy chủ (sau v0.1).
  - Tên `tingqr` (chốt 2026-11-18). README phải nói rõ ngay đầu: thư viện **không** xác nhận thanh toán hay nhận webhook
    ("ting ting" dễ làm dev Việt tưởng vậy).

## Lệnh

- Ở gốc repo: `pnpm test:all`, `pnpm build:all`, `pnpm typecheck:all` (hiện chỉ có phần TypeScript; Plan 8 thêm .NET).
- Chi tiết phần TypeScript: `ts/CLAUDE.md`.

## Conformance trước, code sau

- `conformance/` là nguồn sự thật chung cho mọi ngôn ngữ: mẫu thử, mã lỗi (`errors.json`), mô tả loại QR.
- Hành vi mới phải có mẫu thử trước rồi mới có code. Thêm loại QR: dùng skill `add-scheme`.
- `conformance/private/` chứa QR thật, không bao giờ commit và Claude không đọc (bị chặn trong `.claude/settings.json`).
- Trước khi merge: agent `evidence-review` (khẳng định có quá bằng chứng không) và `parity-review` (hai ngôn ngữ có khớp
  không).

## Làm song song

- Việc TypeScript và .NET chạy song song phải ở hai git worktree riêng; thư mục khác nhau vẫn dùng chung git index.

## LSP

- Bật plugin LSP TypeScript. Từ Plan 8 bật thêm LSP C#.

## Quy ước

- Tài liệu viết bằng tiếng Việt. Code, tên gói và API dùng tiếng Anh.
- Mỗi định dạng QR phải có mẫu thử lấy từ QR thật hoặc từ đặc tả, có ghi nguồn. Không tự bịa chuỗi mẫu.
- Không thêm các tag EMV tuỳ ý vào VietQR: app ngân hàng có thể từ chối.
