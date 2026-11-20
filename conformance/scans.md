# Kết quả quét thử bằng app thật

Bảng này ghi lại việc quét QR do tingqr tạo bằng app ngân hàng / ví thật (spec chung mục 5.7). Chỉ người quét điền;
Claude không tự điền. Đây là nguồn bằng chứng mạnh nhất của dự án: README chỉ được ghi một loại QR "đã quét bằng app"
khi bảng có dòng tương ứng.

- **Cách làm:** chạy `pnpm -C ts/packages/render scan-sheet`, mở `ts/packages/render/scan-sheet/index.html`, quét từng
  mã trên màn hình hoặc in trang ra giấy rồi quét. Xem `conformance/README.md`, mục "Trang quét thử".
- **An toàn:** dừng ở màn hình xác nhận chuyển khoản. Nếu chuyển thì chỉ chuyển cho chính mình, số tiền nhỏ. Mã có nhãn
  "tài khoản mẫu, không phải của bạn" chỉ dùng để kiểm app đọc được mã, không bao giờ chuyển tiền. Phần lớn là tài
  khoản bịa; mẫu lấy từ README của `vietnam-qr-pay` có thể là tài khoản thật của người khác.
- **Chỉ ghi `id`**, không ghi số tài khoản hay tên chủ tài khoản.
- **Kết quả:**
  - `đúng`: app hiện đúng ngân hàng, số tài khoản và người nhận, số tiền, nội dung như trên trang;
  - `đọc được, tra tài khoản thất bại`: app nhận mã và hiện đúng ngân hàng/số tài khoản, nhưng báo không tìm thấy người
    nhận. Đây là kết quả bình thường với tài khoản mẫu;
  - `sai`: app hiện khác trang (ghi rõ trường nào);
  - `không đọc được`: app báo lỗi hoặc không nhận mã.
- Thông tin trên trang được kiểm khớp với đầu vào gốc (không chỉ với việc tingqr tự đọc lại mã của mình), nên `đúng`
  nghĩa là app thấy đúng điều bạn yêu cầu.
- Giới hạn logo trong `docs/superpowers/specs/2026-11-19-tingqr-render-design.md` (mục 5.4) là tạm thời cho tới khi
  bảng này có kết quả với mã có logo.

| Ngày | Người quét | App và phiên bản | Thiết bị và hệ điều hành | `id` | Logo | Màn hình / giấy | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---|
