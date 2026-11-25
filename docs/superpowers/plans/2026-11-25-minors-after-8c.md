# Dọn lỗi nhỏ sau Plan 8c — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Sửa các lỗi nhỏ còn để lại từ handoff 2026-11-24 và từ Plan 8c, không đổi hành vi công khai ngoài những chỗ ghi dưới.

**Architecture:** Mỗi task một nhóm lỗi cùng chỗ; hành vi mới có mẫu `conformance/` trước khi có code (quy tắc repo).

**Tech Stack:** TS (pnpm, vitest, Stryker), .NET 10 (xUnit, Stryker.NET), Node script.

**Spec:** không có spec riêng. Nguồn: danh sách "Lỗi nhỏ để sau" trong `docs/superpowers/handoffs/2026-11-24-1400-after-plan-8b.md`
(mục Needs the user) và các minor đã ghi khi review Plan 8c. Chủ dự án yêu cầu làm ngày 2026-11-25 ("làm 1 + 5").

**Nhánh:** `minors-after-8c`. **CI GitHub đang không chạy được** (lỗi thanh toán Actions, 2026-11-25): mọi kiểm tra chạy
cục bộ, ghi rõ trong báo cáo.

## Global Constraints

- Quy tắc `CLAUDE.md`, `ts/CLAUDE.md`, `dotnet/CLAUDE.md`: conformance trước; không bịa chuỗi mẫu; mã lỗi trong
  `conformance/errors.json`; `InvariantCulture`/`Ordinal`; 0 cảnh báo; mutation ngưỡng 90 không hạ.
- Mẫu mới từ oracle chạy bằng `node conformance/tools/oracle/...` (lệnh `node` để chủ dự án được hỏi), ghi nguồn.
- Ngân sách kích thước gói TS (`core` 48 000 byte, `render` 36 000 byte) không vượt.
- Không đổi tên API công khai.

## Không làm (ghi lý do)

- PromptPay đọc tag 64: chưa có nguồn đặc tả (đặc tả Ngân hàng Thái Lan chưa đọc được).
- Bộ đọc thứ hai cho `check-promptpay`: cần chọn oracle mới, việc riêng.
- Deprecate 0.0.1: chỉ sau khi phát hành 0.1.0.
- So sánh theo giá trị cho các kiểu `*Data` .NET có danh sách: đã ghi README; đổi `Equals` của record là thiết kế riêng.

---

### Task 1: Tài liệu và công cụ nhỏ

**Files:** `README.md:78`, `README.vi.md:76`, `ts/packages/core/README.md:24`, `ts/packages/nestjs/README.md:56`;
`conformance/tools/render/svg-cases.mjs` (BOM), `conformance/tools/render/gen-svg.mjs` (chú thích đầu, phép kiểm commit).

- [ ] Câu "banking apps reject accents"/"app ngân hàng từ chối chữ có dấu" → nói đó là luật của tingqr (chỉ ASCII in
  được, `conformance/schemes/vietqr.md`), chưa có lần quét app nào ghi nhận app từ chối. Giữ README core dưới ngân sách
  (`pnpm -C ts --filter @tingqr/core run size` hoặc lệnh kiểm kích thước có sẵn).
- [ ] Bỏ ký tự BOM đầu `svg-cases.mjs`.
- [ ] `gen-svg.mjs`: chú thích đầu nói commit ghi trong mẫu là commit "lúc sinh"; phép kiểm `--check` (commit ghi trong mẫu
  phải có trong lịch sử) ghi rõ giả định gộp bằng merge commit, và thông báo lỗi khi không tìm thấy commit gợi ý nguyên
  nhân (squash/rebase) và cách sửa (sinh lại mẫu). Không đổi định dạng mẫu.
- [ ] `node conformance/tools/render/gen-svg.mjs --check` exit 0; test TS của core, nestjs (README không có test) đạt.
- [ ] Commit `docs: accents rule is tingqr's; gen-svg notes; drop BOM`.

### Task 2: .NET — làm cứng API

**Files:** `dotnet/src/TingQR.Rendering/SvgOptions.cs` (`SvgSize`), các chỗ trả `IReadOnlyList` trong Core/Rendering,
`dotnet/src/TingQR.Core/Text/VietnameseText.cs`, `dotnet/tests/TingQR.Core.Tests/Conformance/JsonInput.cs` (+ csproj test).

- [ ] `SvgSize : IEquatable<SvgSize>`, `Equals(object)`, `GetHashCode`, `==`/`!=` (theo mẫu `QrAmount`). Hai giá trị bằng
  nhau khi cùng dạng và cùng giá trị (`Pixels` so bằng `==` của double; `Length` so ordinal). Test.
- [ ] Mọi `IReadOnlyList<T>`/`IReadOnlyCollection` công khai trả về (kết quả đọc QR, `Warnings`, `Fields`, `TlvNode`
  con, danh sách ngân hàng/app, `QrMatrix.Modules` nếu là mảng/list…) không ép kiểu ngược để sửa được: bọc
  `ReadOnlyCollection`/mảng sao chép. Test: `Assert.Throws<NotSupportedException>` khi ép sang `IList<T>` rồi `Add`/gán,
  với mỗi loại kết quả. Liệt kê trong báo cáo các chỗ đã sửa.
- [ ] `VietnameseText.RemoveAccents`: chuỗi có surrogate lẻ không được ném lỗi; kết quả phải giống `removeVietnameseAccents`
  của TS (JS `normalize` để nguyên surrogate lẻ). `null` → giữ `ArgumentNullException` (TS ném `TypeError`; cả hai là lỗi
  lập trình) và ghi ở `conformance/README.md`. Mẫu thử cho hàm này làm ở Task 4.
- [ ] `JsonInput.Double`: số ngoài phạm vi double (`1e400`) → lỗi đọc mẫu rõ ràng, không thành `Infinity`. Test.
- [ ] `JsonInput.cs` dùng chung: chuyển sang `dotnet/tests/Shared/` (hoặc tên tương tự) và `Compile Include … Link` từ cả
  các project test cần nó; bỏ chỗ link chéo sang thư mục của Core.Tests. Cũng gộp `NodeFact` (Core.Tests và
  BankLogos.Tests đang có hai bản) vào cùng chỗ, giữ phần tự test `SkipReason`/`EnsureAvailable`.
- [ ] `dotnet test dotnet/TingQR.slnx` đạt; Stryker Core và Rendering vẫn ≥ 90, không đột biến sống sót mới. Commit.

### Task 3: Render — tuỳ chọn null ở canvas, PNG mã hoá một lần, văn bản quá dài

**Files:** `ts/packages/render/src/canvas.ts`, `ts/packages/render/src/*` (chỗ kiểm độ dài), `dotnet/src/TingQR.Rendering/*`,
mẫu `conformance/vectors/render/`.

- [ ] Canvas (`drawQr`, `toPngBlob`, `toPngDataUrl`, `toPng`): `options` là `null` → như mặc định (giống `toSvg`, đã quyết
  ở Plan 8b); trường lẻ `null` → như `toSvg` hiện xử lý. Test.
- [ ] `toPng` (và chuỗi gọi `drawQr`/`toPngBlob`): payload chỉ mã hoá thành ma trận **một lần** mỗi lần gọi. Test bằng
  spy/đếm số lần gọi hàm mã hoá.
- [ ] Văn bản quá dài: từ chối **trước** khi cấp phát lớn ở cả hai bản. Ngưỡng: số byte UTF-8 (hoặc số đơn vị theo chế độ
  mã hoá) vượt dung lượng tối đa của `maxVersion` ở mức `ecc` yêu cầu → cùng lỗi và mã như hiện nay
  (`render-invalid-too-long.json` vẫn đạt). Thêm một mẫu lỗi văn bản rất dài (ví dụ 1 000 000 ký tự ASCII, sinh trong
  mẫu bằng cách lặp, ghi cách sinh; nếu định dạng mẫu không cho lặp thì test riêng mỗi bản thay cho mẫu). Đo: không cấp
  phát mảng theo độ dài văn bản trước khi kiểm (test: thời gian/bộ nhớ hợp lý, hoặc kiểm thứ tự gọi).
- [ ] Ngân sách kích thước `render` không vượt; test TS + .NET đạt; Stryker render (TS) và Rendering (.NET) ≥ 90. Commit.

### Task 4: Mẫu thử còn thiếu

**Files:** `conformance/tools/oracle/gen-render.mjs`, `conformance/vectors/render/`, loại mẫu mới trong
`conformance/README.md` + schema nếu có, bộ chạy mẫu TS (`ts/packages/core/test/…`, `ts/packages/render/test/…`) và .NET
(`dotnet/tests/*/Conformance/…`).

- [ ] Mẫu ma trận Nayuki mới (sinh bằng `node conformance/tools/oracle/gen-render.mjs`, oracle là file Nayuki gốc): ít
  nhất một mẫu mỗi nhóm phiên bản 27–40 cần thiết (tối thiểu 27, 32 — kiểm căn chỉnh, 40), và chế độ số ở phiên bản ≥ 10.
  Văn bản đầu vào chọn sao cho ra đúng phiên bản (ép bằng `minVersion`/`maxVersion`). Cả hai bản chạy đạt.
- [ ] Loại mẫu mới (định dạng ghi ở `conformance/README.md`, nguồn ghi trong từng mẫu, không bịa):
  - `isKhqrExpired`: dựa trên mẫu KHQR đã có (`createdAt`/`expiresAt` trong mẫu) và thời điểm `nowMs` cho trước:
    trước, đúng biên, sau hạn, không có hạn.
  - `removeVietnameseAccents`: chuỗi vào và ra theo Unicode NFD (đủ nguyên âm có dấu, `đ`/`Đ`, chữ không phải tiếng Việt
    giữ nguyên, surrogate lẻ giữ nguyên, emoji).
  - Tag của cảnh báo: mẫu `lenient` đã có thêm `tag` cho từng cảnh báo nếu định dạng đang bỏ qua.
  - `fields` của `UNKNOWN_SCHEME`: mẫu `detect` lỗi ghi `fields` mong đợi.
  Mỗi loại có bộ chạy ở cả TS và .NET; giá trị mong đợi lấy từ quy tắc đặc tả/Unicode và đối chiếu bằng tay, không lấy
  từ chính đầu ra của tingqr.
- [ ] `pnpm test:all` đạt. Commit.

### Task 5: Tài liệu trạng thái

- [ ] `CLAUDE.md` (dòng trạng thái mới, ngắn), `CHANGELOG.md` (TS và .NET "Unreleased"), `conformance/README.md`,
  `dotnet/CLAUDE.md` nếu đổi lệnh. Ghi CI GitHub chưa chạy (lỗi thanh toán).
- [ ] `evidence-review` + `parity-review` trên cả nhánh.
