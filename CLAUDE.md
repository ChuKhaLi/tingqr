# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này. Trả lời chủ dự án bằng tiếng Việt.

**tingqr** là SDK mã nguồn mở về QR thanh toán, lấy Việt Nam làm đầu tàu rồi mở rộng sang QR xuyên biên giới. Có bản
TypeScript và bản .NET, kèm tích hợp sẵn cho Angular, NestJS và ASP.NET Core. Lấy cảm hứng từ `vietqr/vietqr-node` (MIT).

## Trạng thái

- **Bản thiết kế đã duyệt (2026-11-18):** `docs/superpowers/specs/2026-11-18-tingqr-design.md`. Đó là nguồn chính cho mọi
  quyết định. Mục ghi **[chủ dự án]** thì không tự đổi; mục **[Claude]** có thể đề xuất sửa.
  - Nghiên cứu nền: `docs/huong-di/2026-11-18-nghien-cuu-va-huong-di.md`.
  - Chưa có code. Bước tiếp: kế hoạch ở `docs/superpowers/plans/`.
- **Chủ dự án đã quyết:**
  - Mục đích chính là một thư viện mã nguồn mở có tiếng; dùng phụ trong Noel tree (`../noel-tree`, Angular 21 SSR trên
    Cloudflare Workers).
  - Hướng B: đa quốc gia Đông Nam Á, Việt Nam trước, muốn đi trước ở QR xuyên biên giới.
  - Không bắt buộc lõi phải thuần JS. Có thể tách bản server và bản client.
  - Tên `tingqr` (chốt 2026-11-18). README phải nói rõ ngay đầu: thư viện **không** xác nhận thanh toán hay nhận webhook
    ("ting ting" dễ làm dev Việt tưởng vậy).

## Quy ước

- Tài liệu viết bằng tiếng Việt. Code, tên gói và API dùng tiếng Anh.
- Mỗi định dạng QR phải có mẫu thử lấy từ QR thật hoặc từ đặc tả, có ghi nguồn. Không tự bịa chuỗi mẫu.
- Không thêm các tag EMV tuỳ ý vào VietQR: app ngân hàng có thể từ chối.
