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
- **Mutation test (Stryker.NET 5.1.0, tool cục bộ trong `.config/dotnet-tools.json`):** `dotnet tool restore` rồi `dotnet tool run dotnet-stryker --config-file ../../stryker-config.json` trong `dotnet/tests/TingQR.Core.Tests/` (~5 phút). Chạy từ thư mục đó để Stryker chỉ dùng `TingQR.Core.Tests`; chạy trong `dotnet/` thì nó dùng cả `TingQR.Rendering.Tests` (project này tham chiếu Core), chậm gấp đôi và vượt giới hạn 30 phút của CI (2026-11-24). Cấu hình `stryker-config.json` (TingQR.Core; Rendering xem mục dưới): chạy test `net10.0`, ngưỡng chặn ≥ 90 (`thresholds.break`), loại `Banks/BankData.g.cs` và `Polyfills.cs`. CI: `.github/workflows/mutation-dotnet.yml`. Báo cáo HTML ở `StrykerOutput/` trong thư mục chạy (không commit).
  - Không dùng `ignore-methods`: mã lỗi và tag là quy phạm nên vẫn bị đột biến. Chỉ chuỗi thông báo lỗi (và tên trường chỉ xuất hiện trong thông báo) được loại, từng chỗ một bằng `// Stryker disable once String : error message` đặt ngay trước literal.
  - Đột biến tương đương thật sự cũng loại từng chỗ bằng `// Stryker disable once <Loại> : <lý do>` ngay trên dòng đó (ví dụ `dot < 0` so với `dot <= 0`, dung lượng `StringBuilder`, `>>` so với `>>>` với số không âm, tổ hợp mã băm). Lý do phải nằm trong comment, không để ở đây. Phạm vi thật của `disable once` (đo bằng báo cáo JSON, Stryker.NET 5.1.0): mọi đột biến cùng loại trong cả câu lệnh/dòng đó, không riêng một đột biến. Vì vậy chỉ dùng khi mọi đột biến loại đó trên dòng đều tương đương; nếu lẫn đột biến giết được thì viết lại mã cho đột biến tương đương biến mất (ví dụ `IndexOf(x) != -1` thay cho `>= 0`, `dot == -1` thay cho `dot < 0`) hoặc tách ra dòng riêng.
  - Biến hay hàm phụ chỉ dùng để dựng thông báo lỗi (`shown`, `Quote`, chỗ chọn giữa hai thông báo) được loại bằng
    `// Stryker disable once all : <lý do>` ngay trên dòng đó, vì mọi đột biến trên dòng chỉ đổi thông báo. Kiểm lại
    rằng dòng đó không chứa gì ngoài phần dựng thông báo.
  - Ngoại lệ duy nhất không phải thông báo hay tương đương: `Banks/FallbackUrl.cs`, kiểm `ForbiddenInAuthority` ở đầu
    `HostAndPort` (`disable once Statement`). Đó là kiểm tra phòng thủ không thể chạm tới: `Host` và `Port` đã từ chối
    đúng các ký tự đó với cùng lỗi, nên bỏ câu lệnh không đổi kết quả nào.
  - Đột biến sống sót khác là lỗ hổng test: viết test giết nó, không hạ ngưỡng và không thêm ngoại lệ theo cả file hay cả lớp.

## TingQR.Rendering

- `src/TingQR.Rendering` (tests `tests/TingQR.Rendering.Tests`): port của `ts/packages/render/src/` (trừ `canvas.ts`). Phụ thuộc `TingQR.Core`. Mẫu thử: `conformance/vectors/render/`.
- Bộ mã hoá QR là port từng dòng từ `ts/packages/render/src/qrcodegen.ts` (Nayuki v1.8.0, MIT; ghi công trong `NOTICE`). File port đó không chạy mutation test.
- **Mutation test:** cấu hình riêng `stryker-config.rendering.json` (cùng ngưỡng chặn 90, loại `QrCodeGen.cs` và
  `Polyfills.cs`): `dotnet tool run dotnet-stryker --config-file stryker-config.rendering.json` trong `dotnet/` (~5 phút).
  Workflow `mutation-dotnet.yml` chạy Core và Rendering thành hai job (matrix), job nào dưới ngưỡng thì fail (job Rendering chưa chạy trên CI; Ubuntu chưa chạy). Các quy tắc
  `disable once` ở trên áp dụng y nguyên.
  - Trong Rendering, mã đã được viết lại để bỏ đột biến tương đương (không đổi hành vi; lý do ghi ngay tại dòng):
    `JsNumber` (`Math.Sign`, so sánh đặt tại biên đạt được, chia thay cho dịch bit, `biased != 1`, điểm bắt đầu
    `Log10` + 1 thay cho hai vòng chỉnh), `Color.Lin` (`channel <= 10`), `Svg.IsPositiveLength` (một biểu thức, không
    còn nhánh chỉ net481 chạy tới), `Svg.AppendModulePath` (đọc hàng trực tiếp, vượt biên thì ném lỗi).
  - Lần chạy cục bộ trên Windows 2026-11-24: 99,41% = 475 bị giết + 28 quá giờ trên 506 được tính, 3 sống sót (dưới),
    87 bị bỏ qua (34 theo comment `disable`, 53 do bộ lọc "block already covered"), `QrCodeGen.cs` bị loại (876). Core
    (2026-11-23): 1506 bị giết, 12 quá giờ, 0 sống sót, 291 bị bỏ qua.
  - Ba đột biến sống sót được chấp nhận: tương đương, nhưng nằm chung dòng với đột biến cùng loại giết được nên không
    `disable` được, và viết lại thì không còn giống bản TS. `Layout.CheckColours`: `Luminance(fg) >= Luminance(bg)` thành
    `>` (độ sáng bằng nhau thì tỉ lệ là 1, vẫn bị từ chối) và `ContrastRatio < MinContrast` thành `<=` (không cặp màu
    24 bit nào cho đúng 4,5; gần nhất lệch 7,9e-14, đo bằng công thức `color.ts` trên Node 22, 2026-11-23;
    kiểm một lần, script không có trong repo).
    `Logo.CheckBox`: `share > MaxClearedShare` thành `>=` (cạnh mã lẻ nên ClearSide²/size² không bao giờ bằng 0,1;
    cách xa ít nhất 1/(10·177²)).
