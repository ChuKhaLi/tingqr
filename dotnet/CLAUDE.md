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
- **Mutation test (Stryker.NET 5.1.0, tool cục bộ trong `.config/dotnet-tools.json`):** `dotnet tool restore` rồi `dotnet tool run dotnet-stryker` trong `dotnet/` (~5 phút). Cấu hình `stryker-config.json`: chạy test `net10.0`, ngưỡng chặn 90 (đo 90,99% ngày 2026-11-22), loại `Banks/BankData.g.cs` và `Polyfills.cs`. CI: `.github/workflows/mutation-dotnet.yml`. Báo cáo HTML ở `dotnet/StrykerOutput/` (không commit).
  - `ignore-methods` bỏ qua đột biến bên trong lời gọi `Invalid`, `Fail`, `NotAbsolute`, `Quote`, constructor `*Exception` và `TingQrWarning`: đó là chuỗi thông báo lỗi (không có tính quy phạm), tương đương như ở `ts/CLAUDE.md`. Hệ quả: tên tag truyền vào các hàm này cũng không bị đột biến; `TingQrException.Tag` vẫn được test kiểm.
  - Còn sống sót mà coi là tương đương/chấp nhận: biên của các hàm kiểm ký tự ASCII (`IsAsciiLetter` ...), nhánh `Quote` chỉ dùng cho thông báo, nhãn tag/tên trường truyền vào `Text(...)` của KHQR/PromptPay (chỉ vào thông báo), đột biến trong `FallbackUrl` (bộ kiểm URL nhiều biên). Đột biến khác sống sót là lỗ hổng test: viết test giết nó, đừng hạ ngưỡng.
