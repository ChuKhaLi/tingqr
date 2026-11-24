# CLAUDE.md (dotnet)

Hướng dẫn cho phần .NET của tingqr. Quy tắc chung: `../CLAUDE.md`. Thiết kế: `docs/superpowers/specs/2026-11-22-tingqr-dotnet-core-design.md` (Core), `2026-11-23-tingqr-dotnet-rendering-design.md` (Rendering), `2026-11-24-tingqr-dotnet-aspnetcore-release-design.md` (AspNetCore, BankLogos, NuGet).

## Lệnh

- Từ gốc repo: `dotnet build dotnet/TingQR.slnx`, `dotnet test dotnet/TingQR.slnx` (SDK 10). `pnpm test:all` chạy cả TS và .NET.
- Test chạy trên `net10.0`, và thêm `net481` trên Windows để bản `netstandard2.0` thật sự được chạy (Core, Rendering,
  BankLogos; AspNetCore chỉ `net10.0`).
- Test script Node của .NET: `node --test dotnet/scripts/test/*.test.mjs` (`set-version`, `check-release`, cách xét
  của diễn tập). Dạng thư mục `node --test dotnet/scripts/test/` không tìm thấy test trên Node cục bộ.
- Số phiên bản: `node dotnet/scripts/set-version.mjs x.y.z` (đặt `Directory.Build.props` và `TingQrVersion.Value`);
  `node dotnet/scripts/check-release.mjs [--tag dotnet-vX.Y.Z]`. Bốn gói chung một số, riêng với npm. Repo giữ `0.0.0`.
- Diễn tập NuGet: skill `release-drill-dotnet` (`node .claude/skills/release-drill-dotnet/scripts/drill.mjs`, gọi mạng
  tới nuget.org). Dùng trước khi phát hành và khi sửa `.csproj`/`Directory.Build.props`. Phát hành: `docs/RELEASING.md`
  phần NuGet.

## Khung đích

- `TingQR.Core`, `TingQR.Rendering`, `TingQR.BankLogos`: `net10.0;netstandard2.0`. `TingQR.AspNetCore`: chỉ `net10.0`
  (`FrameworkReference Microsoft.AspNetCore.App`).
- `TingQR.Core`: không `PackageReference` lúc chạy; polyfill viết trong mã nguồn, `internal` (`Polyfills.cs`). Nếu `netstandard2.0` buộc phải thêm gói lúc chạy thì bỏ nó và ghi `Ruling:`.
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
  Workflow `mutation-dotnet.yml` chạy Core và Rendering thành hai job (matrix), job nào dưới ngưỡng thì fail. Job
  `mutation (rendering)` đã xanh trên Ubuntu (run 45330277776, `main` `b684bca`, 2026-11-24). Các quy tắc
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

## TingQR.BankLogos

- `src/TingQR.BankLogos` (tests `tests/TingQR.BankLogos.Tests`): ảnh trong `conformance/banks/logos/` nhúng làm
  embedded resource lúc build (glob MSBuild, không chép file). Không dependency, không tham chiếu Core. Lớp `BankLogos`
  nằm trong namespace `TingQR`.
- `LOGOS-NOTICE.md` của gói là file sinh bằng `ts/packages/bank-logos/scripts/gen.mjs` (cùng manifest với bản npm), được
  commit; `NoticeSyncTests` và `node ts/packages/bank-logos/scripts/gen.mjs --check-notice` (trong `ci-ts`, trước bước
  build) kiểm nó khớp. Không sửa tay.
- Cache data URI chỉ giữ ảnh có trong gói (khoá lạ không làm cache lớn lên).

## TingQR.AspNetCore

- `src/TingQR.AspNetCore` (tests `tests/TingQR.AspNetCore.Tests`, `TestServer`): `AddTingQr`, `TingQrService`,
  `WithTingQrSvg`, `TingQrHttpResults.Svg`, `[TingQrSvg]`. Hợp đồng HTTP: `conformance/http/svg-response.json`; chỗ
  .NET khác NestJS ghi ở `conformance/README.md` (mục "`TingQR.AspNetCore` và hợp đồng HTTP") và README của gói.
- `TingQrSvgAttribute` cũng là `IControllerModelConvention`/`IActionModelConvention`: cách duy nhất để
  `[TingQrSvg("x")]` thiếu `AddTingQr` dừng app (ném ở `MapControllers`). Có `AddTingQr` thì `TingQrStartupCheck` kiểm
  tên profile qua `FilterDescriptors`.

## TingQR.AspNetCore và TingQR.BankLogos: mutation test

- Cấu hình riêng `stryker-config.aspnetcore.json` và `stryker-config.banklogos.json` (ngưỡng chặn 90, `net10.0`,
  `perTest`, không loại file nào: hai gói không có `Polyfills.cs`). Chạy từ thư mục test của từng gói, như Core:
  `dotnet tool run dotnet-stryker --config-file ../../stryker-config.aspnetcore.json` trong
  `dotnet/tests/TingQR.AspNetCore.Tests/` (~1,5 phút), `../../stryker-config.banklogos.json` trong
  `dotnet/tests/TingQR.BankLogos.Tests/` (~1 phút). `mutation-dotnet.yml` có thêm hai job matrix
  (đạt trên Ubuntu lần đầu ở PR #11, run 45423456206, 2026-11-24).
  Các quy tắc `disable once` ở trên áp dụng y nguyên.
- Lần chạy cục bộ trên Windows 2026-11-24:
  - AspNetCore (sau khi thêm kiểm `CacheControl` và test "luôn 200"): 100% = 227 bị giết, 0 quá giờ, 0 sống sót; 77 bị
    bỏ qua (22 theo comment `disable`, 55 do bộ lọc "block already covered"), 29 lỗi biên dịch (không tính).
  - BankLogos: 100% = 66 bị giết, 0 quá giờ, 0 sống sót; 15 bị bỏ qua (4 theo comment `disable`, 11 do bộ lọc), 7 lỗi
    biên dịch.
- Số comment `disable` trong mã nguồn: AspNetCore 13 (11 `String : error message`, 1 `all` cho biến chỉ dùng trong
  thông báo, 1 tương đương bên dưới), BankLogos 2 (1 `String`, 1 `all`).
- Ngoài thông báo lỗi, chỉ một chỗ `disable` vì tương đương: `ArgumentNullException.ThrowIfNull(services)` đầu
  `AddTingQr` (`AddOptions` ngay sau ném đúng lỗi đó). Mã đã viết lại để bỏ đột biến tương đương: so `Service` trong
  cấu hình bằng `IsWord` (bit 0x20) thay cho đổi chữ thường, `TingQrMvcMarker` lưu chính khoá (chỉ đọc sự có mặt),
  `BankLogos` đọc tài nguyên bằng `using`.
