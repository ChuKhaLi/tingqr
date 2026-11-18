---
name: add-scheme
description: Dùng khi thêm một loại QR thanh toán mới vào tingqr (ví dụ PromptPay, KHQR, DuitNow, QRIS, LAO QR) hoặc một biến thể của loại đã có.
---

# Thêm một loại QR

Làm đúng thứ tự. Mỗi bước có bằng chứng thì mới sang bước sau (spec `docs/superpowers/specs/2026-11-18-tingqr-design.md`).

1. **Tìm mẫu thật kèm nguồn và giấy phép** (spec 5.2, 5.2a).
   - Được: đặc tả công khai; repo MIT, Apache, BSD (ghi giấy phép); QR thật chụp ở máy chủ dự án.
   - Không được: repo GPL hoặc không ghi giấy phép, kể cả chỉ lấy chuỗi.
   - QR thật để ở `conformance/private/` (không commit); chỉ commit "công thức" `derived: true`.
2. **Viết `conformance/schemes/<id>.md`**: tag, GUID, tag bắt buộc, cách nhận diện, cách đếm độ dài, nguồn.
3. **Thêm mẫu thử** vào `conformance/vectors/<id>/`, chạy `pnpm test:all` để kiểm định dạng. Không bịa chuỗi.
   Mẫu `invalid` phải là mẫu `valid` bị sửa, ghi `derivedFrom` và `note`.
4. **Code TypeScript** trong `ts/packages/core/src/schemes/<id>/`, thêm dòng vào bảng `SCHEMES` của
   `ts/packages/core/test/conformance.spec.ts`, chạy tới khi xanh. Mã lỗi mới phải thêm vào
   `conformance/errors.json` trước.
5. **Code .NET** (từ v0.2) chạy đạt cùng bộ mẫu.
6. **Tài liệu**: README, ghi rõ loại này đã hay chưa được quét thử bằng app thật.
7. **Bảng thử trên app thật** (`docs/conformance-matrix.md`): chỉ thêm dòng khi đã có người quét thật.

Trước khi merge: chạy agent `evidence-review` và `parity-review`.
