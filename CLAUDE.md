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
  - **Plan 3** (2026-11-19, nhánh `plan-3`): `docs/superpowers/plans/2026-11-18-plan-3-promptpay-khqr-detect.md`.
    - Xong: tạo và đọc PromptPay (`encodePromptPayQr`, `decodePromptPayQr`), KHQR (`encodeKhqr`, `decodeKhqr`,
      `isKhqrExpired`), `detect()`, `TingQrError.fields`. Gói npm bỏ source map.
    - Oracle mới trong `conformance/tools/oracle/`: `promptpay-qr`, `promptparse`, `thai-qr-payment` (MIT),
      `bakong-khqr` (ISC chỉ khai báo trong `package.json`). Chạy oracle phải qua `node conformance/tools/oracle/...`
      để chủ dự án được hỏi.
    - **Đặc tả Thai QR của Ngân hàng Thái Lan chưa đọc được.** Quy tắc PromptPay dựa vào ba thư viện MIT; OTA, xuyên
      biên giới, sub-tag `04`/`05` chỉ từ `thai-qr-payment`; giới hạn tham chiếu 20 ký tự chưa có nguồn
      (`conformance/schemes/promptpay.md`).
  - **Plan 4** (2026-11-19, nhánh `plan-4`): `docs/superpowers/plans/2026-11-19-plan-4-render.md`, thiết kế
    `docs/superpowers/specs/2026-11-19-tingqr-render-design.md`.
    - Xong: gói `@tingqr/render` (`toMatrix`, `toSvg`, logo ở giữa), bộ mã hoá port từ Nayuki v1.8.0, mẫu ma trận
      `conformance/vectors/render/` sinh từ file Nayuki gốc, trang quét thử VietQR, bảng `conformance/scans.md`.
    - **Trang quét thử có rồi, chưa có kết quả quét.** Giới hạn logo (10% diện tích, `size` ≤ 0.25) là tạm thời cho
      tới khi có kết quả quét.
    - Đầu vào quét thật của chủ dự án ở `conformance/private/scan-inputs.json`; chỉ chủ dự án chạy `scan-sheet` với dữ
      liệu thật.
  - **Plan 5** (2026-11-20, nhánh `plan-5`): `docs/superpowers/plans/2026-11-20-plan-5-banks.md`, thiết kế
    `docs/superpowers/specs/2026-11-20-tingqr-banks-design.md`, hướng dẫn `docs/huong-dan/ngan-hang-va-mo-app.md`.
    - Xong:
      - dữ liệu `conformance/banks/` (76 ngân hàng, 44 app, kiểm Google Play, bản chụp nguồn);
      - `@tingqr/core/banks` (`findBank`, `findBankApp`, `appsForBank`, `bankAppLink`), mẫu `kind: "link"`;
      - gói `@tingqr/bank-logos` (mỗi ảnh một module, tree-shake được);
      - công cụ `conformance/tools/banks/`, Action hằng tháng mở issue, skill `update-banks`.
    - **Nguồn:** `qrviet` và Noel tree chép từ vietqr.io, nên không tính là nguồn độc lập. Nguồn độc lập duy nhất ngoài
      vietqr.io là `vietnam-qr-pay` 1.5.1, đã cũ.
    - **Chưa đưa vào:** VietABank, Vietbank, BVBank (các nguồn ghi khác nhau), phần Android của MoMo và ZaloPay.
    - `multi-source` (18/44 app): hai nguồn độc lập ghi **đúng** scheme, gói và host mà tingqr tạo ra (`agrees`).
    - **Chưa kiểm:**
      - **mở thử trên máy thật:** chỉ có MyVIB mở đúng chuỗi của tingqr. MB mở qua `dl.vietqr.io`, nên mới xác nhận
        scheme và gói;
      - Action chưa chạy thật trên GitHub;
      - icon giữa QR chưa quét thử.
    - Chủ dự án duyệt (2026-11-20/21):
      - ngân sách core 45 KB;
      - logo PNG thu về WebP lossless cao 128 px;
      - gói `bank-logos` khoảng 1,8 MB.
  - Repo GitHub riêng tư `ChuKhaLi/tingqr`; CI (`ci-ts.yml`) và mutation (`mutation-ts.yml`, ngưỡng 90%) chạy trên PR.
  - **Chưa quét thử bằng app thật** cho VietQR, VNPAY, PromptPay lẫn KHQR.
  - Tiếp theo: chủ dự án quét thử VietQR (kể cả bản có icon ngân hàng) và điền `conformance/scans.md`; Plan 6 (Angular,
    NestJS); hoặc làm nốt Plan 2 Task 5–6 khi có QR thật.
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
