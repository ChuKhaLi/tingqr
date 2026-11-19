# Kết quả quét thử bằng app thật

Bảng này ghi lại việc quét QR do tingqr tạo bằng app ngân hàng / ví thật. Chỉ người quét điền; Claude không tự điền.

- **Cách làm:** chạy `pnpm -C ts/packages/render scan-sheet`, mở `ts/packages/render/scan-sheet/index.html`, quét từng
  mã trên màn hình hoặc in trang ra giấy rồi quét. Xem `conformance/README.md`, mục "Trang quét thử".
- **An toàn:** dừng ở màn hình xác nhận chuyển khoản. Nếu chuyển thì chỉ chuyển cho chính mình, số tiền nhỏ. Mã có nhãn
  "tài khoản giả" chỉ dùng để kiểm app đọc được mã, không bao giờ chuyển tiền.
- **Chỉ ghi `id`**, không ghi số tài khoản hay tên chủ tài khoản.
- **Kết quả:** `đúng` (app hiện đúng ngân hàng, số tài khoản/người nhận, số tiền, nội dung), `sai` (ghi rõ sai gì),
  `không đọc được` (app báo lỗi hoặc không nhận mã).
- Giới hạn logo trong `docs/superpowers/specs/2026-11-19-tingqr-render-design.md` (mục 5.4) là tạm thời cho tới khi
  bảng này có kết quả với mã có logo.

| Ngày | Người quét | App và phiên bản | Thiết bị | `id` | Logo | Màn hình / giấy | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---|
