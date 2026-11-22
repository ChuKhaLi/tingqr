# CLAUDE.md (dotnet)

Hướng dẫn cho phần .NET của tingqr. Quy tắc chung: `../CLAUDE.md`. Thiết kế: `docs/superpowers/specs/2026-11-22-tingqr-dotnet-core-design.md`.

## Lệnh

- Từ gốc repo: `dotnet build dotnet/TingQR.slnx`, `dotnet test dotnet/TingQR.slnx` (SDK 10). `pnpm test:all` chạy cả TS và .NET.
- Test chạy trên `net10.0`, và thêm `net481` trên Windows để bản `netstandard2.0` thật sự được chạy.

## Khung đích

- `TingQR.Core`: `net10.0;netstandard2.0`. Không `PackageReference` lúc chạy; polyfill viết trong mã nguồn, `internal` (`Polyfills.cs`). Nếu `netstandard2.0` buộc phải thêm gói lúc chạy thì bỏ nó và ghi `Ruling:`.
- Không thêm `net8.0`. Kiểm ngày 2026-11-22 tại https://dotnet.microsoft.com/platform/support/policy/dotnet-core: .NET 8 hết hỗ trợ ngày 2026-11-10 (đã hết), .NET 10 (LTS) hỗ trợ tới 2028-11-14. Chỉ đọc qua công cụ tải trang, chưa đối chiếu bằng mắt.

## Quy ước

- Mọi so sánh, đổi hoa/thường, định dạng số dùng `CultureInfo.InvariantCulture` / `StringComparison.Ordinal`.
- Độ dài chữ đếm theo code point (cặp surrogate tính 1); CRC tính trên byte UTF-8.
- Không dependency lúc chạy.
- `src/TingQR.Core/Banks/BankData.g.cs` là file sinh (từ `conformance/banks/`); không sửa tay.
- Mẫu thử đọc tại chỗ qua `ConformanceRoot` (tests), không chép `conformance/`.
- **Mutation test (Stryker.NET 5.1.0, tool cục bộ trong `.config/dotnet-tools.json`):** `dotnet tool restore` rồi `dotnet tool run dotnet-stryker` trong `dotnet/` (~5 phút). Cấu hình `stryker-config.json`: chạy test `net10.0`, ngưỡng chặn ≥ 90 (`thresholds.break`), loại `Banks/BankData.g.cs` và `Polyfills.cs`. CI: `.github/workflows/mutation-dotnet.yml`. Báo cáo HTML ở `dotnet/StrykerOutput/` (không commit).
  - Không dùng `ignore-methods`: mã lỗi và tag là quy phạm nên vẫn bị đột biến. Chỉ chuỗi thông báo lỗi (và tên trường chỉ xuất hiện trong thông báo) được loại, từng chỗ một bằng `// Stryker disable once String : error message` đặt ngay trước literal.
  - Đột biến tương đương thật sự cũng loại từng chỗ bằng `// Stryker disable once <Loại> : <lý do>` ngay trên dòng đó (ví dụ `dot < 0` so với `dot <= 0`, dung lượng `StringBuilder`, `>>` so với `>>>` với số không âm, tổ hợp mã băm). Lý do phải nằm trong comment, không để ở đây. Phạm vi thật của `disable once` (đo bằng báo cáo JSON, Stryker.NET 5.1.0): mọi đột biến cùng loại trong cả câu lệnh/dòng đó, không riêng một đột biến. Vì vậy chỉ dùng khi mọi đột biến loại đó trên dòng đều tương đương; nếu lẫn đột biến giết được thì viết lại mã cho đột biến tương đương biến mất (ví dụ `IndexOf(x) != -1` thay cho `>= 0`, `dot == -1` thay cho `dot < 0`) hoặc tách ra dòng riêng.
  - Đột biến sống sót khác là lỗ hổng test: viết test giết nó, không hạ ngưỡng và không thêm ngoại lệ theo cả file hay cả lớp.
