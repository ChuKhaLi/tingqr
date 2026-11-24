# Plan 8c: TingQR.AspNetCore, TingQR.BankLogos, đóng gói NuGet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bản .NET sẵn sàng phát hành và đã diễn tập: tích hợp ASP.NET Core (Minimal API + MVC) theo hợp đồng HTTP
chung, gói logo ngân hàng, bốn gói NuGet đủ metadata, workflow `release-dotnet.yml` dry-run được.

**Architecture:** Hai project mới trong `dotnet/src` (`TingQR.AspNetCore` net10.0; `TingQR.BankLogos`
net10.0+netstandard2.0, ảnh nhúng từ `conformance/banks/logos/`), mỗi project một project test. Metadata gói và số
phiên bản tập trung ở `dotnet/Directory.Build.props`. Diễn tập là script Node pack bốn gói rồi cài vào project ngoài repo.

**Tech Stack:** .NET 10 SDK, ASP.NET Core 10 (shared framework), xUnit 2.9, `Microsoft.AspNetCore.Mvc.Testing` (chỉ test),
Stryker.NET 5.1.0, Node 22 (script), GitHub Actions, `NuGet/login` (OIDC).

**Spec:** `docs/superpowers/specs/2026-11-24-tingqr-dotnet-aspnetcore-release-design.md` (đã duyệt 2026-11-24). Đọc kèm
`conformance/http/svg-response.json`, `ts/packages/nestjs/src/{options,service,svg}.ts` (bản tham chiếu hành vi),
`dotnet/CLAUDE.md`.

**Nhánh:** `plan-8c` (worktree riêng nếu có việc TS chạy song song).

## Global Constraints

- `TingQR.AspNetCore`: `net10.0` duy nhất, `FrameworkReference Microsoft.AspNetCore.App`, phụ thuộc `TingQR.Core`,
  `TingQR.Rendering`; không `PackageReference` lúc chạy nào khác.
- `TingQR.BankLogos`: `net10.0;netstandard2.0`, **không dependency nào** (cả `TingQR.Core`).
- `InvariantCulture` / `StringComparison.Ordinal` mọi nơi; `TreatWarningsAsErrors` giữ nguyên; XML doc cho mọi API công
  khai (`GenerateDocumentationFile`).
- SVG trả về đúng bằng `TingQrRender.ToSvg(payload, mergedOptions)`.
- Header ảnh, đúng chữ: `Content-Type: image/svg+xml; charset=utf-8`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`,
  `Cache-Control: private, max-age=300` (đổi được).
- Lỗi 500: thân đúng `{"error":{"code":"<WireNames.Of(code)>"}}`, không bao giờ có thông báo; thông báo ghi `ILogger`.
- Logo phục vụ qua HTTP phải bắt đầu `data:image/` → `INVALID_VALUE` lúc cấu hình.
- Không route mở dựng QR từ tham số URL; ví dụ trong README và test không được làm vậy.
- Số phiên bản NuGet riêng với npm; bốn gói NuGet chung một số, đặt ở **một** chỗ (`dotnet/Directory.Build.props`) cộng
  `TingQrVersion.Value`. Repo giữ `0.0.0`.
- Mutation: Stryker.NET ngưỡng chặn 90, không hạ; `Stryker disable` chỉ theo quy tắc `dotnet/CLAUDE.md`.
- Không `dotnet nuget push` ở máy; không phát hành gì. Mọi tài liệu viết tiếng Việt, code/API tiếng Anh.
- `conformance/private/` không đọc.

## Review Focus

1. **Handler async và kiểu trả về khác `string`** (Minimal API trả `Task<string?>`, `ValueTask<string>`, `IResult`; MVC
   action trả `Task<string>`, `ActionResult<string>`): dev mong `Task<string?>` chạy như `string?`; kiểu không hỗ trợ báo
   lỗi lập trình rõ ràng, không im lặng trả text. → test ở Task 6 và Task 7.
2. **`[TingQrSvg]` trên cả controller và action**: chỉ vẽ một lần, bộ của action thắng. → test ở Task 7.
3. **Exception filter / `UseExceptionHandler` của app**: `TingQrException` trong handler vẫn ra 500 theo hợp đồng chứ
   không rơi vào trang lỗi của app; lỗi khác vẫn tới pipeline của app. → test ở Task 6 và Task 7.
4. **Cấu hình từ `appsettings.json`**: `"TingQr": { "Bank": "MB", "AccountNumber": "..." }` khởi động được; thiếu một
   trong hai thì app không chạy với thông báo nói rõ khoá nào. → test ở Task 5.
5. **BIN logo viết khác** (`" 970418"`, chữ hoa trong id app `"MB"`): dev mong tra cứu giống `BankApps.Find`/`LOGO_BINS`
   — so khớp đúng chuỗi, không cắt khoảng trắng; README nói rõ. → test ở Task 4.

---

### Task 1: Rà tên API công khai (cổng chặn)

**Files:**
- Create: `docs/superpowers/specs/2026-11-24-dotnet-api-names.md`

**Interfaces:**
- Produces: danh sách đổi tên **đã được chủ dự án duyệt**; Task 2 áp dụng đúng danh sách đó.

- [ ] **Step 1:** Liệt kê mọi kiểu và thành viên `public` của `TingQR.Core` và `TingQR.Rendering` (ví dụ
  `grep -rhoE "public [^(=;{]*" dotnet/src --include=*.cs`, bỏ `bin/obj`).
- [ ] **Step 2:** Viết file: một bảng `Tên hiện tại | Đề xuất | Lý do | Có ở TS không`. Bắt buộc xét: `VietQr.Guid`,
  `VnpayQr.Guid` (che `System.Guid`), `VnpayQrData` so với `PromptPayData`/`KhqrData`, `DetectResult.Data` (`object`),
  `TingQrDetector`, `EmvPayloads`/`EmvPayload`, `WireNames`, `TingQrResult` (chỉ đọc hay có generic), `Polyfills` nếu
  lộ `public`. Mỗi dòng "giữ nguyên" cũng ghi lý do. Thêm mục cuối: tên kiểu mới của Task 4–7 (`BankLogos`,
  `TingQrOptions`, `TingQrService`, `TingQrResults`, `TingQrSvgAttribute`, `WithTingQrSvg`) để duyệt cùng lúc.
- [ ] **Step 3:** Commit file, rồi **dừng: gửi danh sách cho chủ dự án, chờ duyệt**. Không làm Task 2 trở đi khi chưa
  duyệt. Ghi kết quả duyệt (ngày, dòng bị bỏ/sửa) vào đầu file và commit.

```bash
git add docs/superpowers/specs/2026-11-24-dotnet-api-names.md
git commit -m "docs: proposed .NET public API renames before locking (Plan 8c)"
```

### Task 2: Áp dụng đổi tên đã duyệt

**Files:**
- Modify: các file trong `dotnet/src/TingQR.Core/**`, `dotnet/src/TingQR.Rendering/**`, test tương ứng, README của
  hai gói, `conformance/README.md` (mục khác biệt tên TS/.NET).
- Modify: `docs/superpowers/specs/2026-11-24-dotnet-api-names.md` (thêm mục "Việc TS sau 8c": các tên đã đổi ở .NET mà
  TS còn giữ).

**Interfaces:**
- Consumes: bảng đã duyệt ở Task 1.
- Produces: API .NET mang tên mới; mọi task sau dùng tên mới (các tên trong plan này là tên **cũ** nếu Task 1 đổi —
  người làm thay theo bảng).

- [ ] **Step 1:** Đổi tên đúng theo bảng (dùng rename của IDE/LSP hoặc `dotnet build` để bắt chỗ sót). Không đổi tên
  trường JSON hay giá trị trong `conformance/`.
- [ ] **Step 2:** `dotnet build dotnet/TingQR.slnx -c Release` → 0 lỗi, 0 cảnh báo; `dotnet test dotnet/TingQR.slnx` →
  toàn bộ đạt (số test bằng trước khi đổi: Core 695, Rendering 330 mỗi khung đích).
- [ ] **Step 3:** Chạy lại Stryker Core và Rendering (lệnh trong `dotnet/CLAUDE.md`) → cả hai ≥ 90, không đột biến sống
  sót mới so với 2026-11-24.
- [ ] **Step 4:** Commit `refactor(dotnet): apply approved public API renames (Plan 8c)`.

### Task 3: Số phiên bản và metadata gói NuGet

**Files:**
- Modify: `dotnet/Directory.Build.props` (thêm `Version` duy nhất, metadata chung), `dotnet/src/TingQR.Core/TingQR.Core.csproj`,
  `dotnet/src/TingQR.Rendering/TingQR.Rendering.csproj` (bỏ `<Version>`, thêm Description, `PackageReadmeFile`,
  `PackageLicenseExpression`, gói kèm `README.md`; Rendering gói thêm `NOTICE`)
- Create: `dotnet/scripts/set-version.mjs`, `dotnet/scripts/release-common.mjs`, `dotnet/scripts/test/set-version.test.mjs`
- Test: `dotnet/tests/TingQR.Core.Tests/VersionTests.cs`

**Interfaces:**
- Produces:
  - MSBuild property `Version` trong `dotnet/Directory.Build.props` (`0.0.0`), áp dụng cho mọi project `IsPackable`.
  - `dotnet/scripts/release-common.mjs`: `export const SEMVER` (regex `^\d+\.\d+\.\d+$`), `export function readDotnetVersion(): string`
    (đọc `Directory.Build.props`), `export function readTingQrVersionConst(): string` (đọc `TingQrVersion.cs`),
    `export const PACKAGES = ['TingQR.Core', 'TingQR.Rendering', 'TingQR.AspNetCore', 'TingQR.BankLogos']`.
  - `node dotnet/scripts/set-version.mjs <x.y.z>`: đặt cả hai chỗ; từ chối (`exit 1`, không ghi gì) khi không phải `x.y.z`.

- [ ] **Step 1: Test hỏng trước**

```csharp
// VersionTests.cs
[Fact] public void Constant_matches_assembly_informational_version() =>
    Assert.StartsWith(TingQrVersion.Value,
        typeof(TingQrVersion).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!.InformationalVersion);
```

và `dotnet/scripts/test/set-version.test.mjs` (`node --test`): chạy script trên bản sao tạm của hai file (truyền đường
dẫn qua biến môi trường `TINGQR_DOTNET_ROOT`), kiểm `0.1.0` ghi đúng hai chỗ; `v0.1.0`, `0.1`, `0.1.0-rc.1`, rỗng →
exit 1, hai file không đổi.

- [ ] **Step 2:** Chạy `dotnet test dotnet/tests/TingQR.Core.Tests --filter VersionTests` và
  `node --test dotnet/scripts/test/` → hỏng (chưa có script; test C# có thể đạt sẵn — nếu đạt, đổi tạm `Version` sang
  `0.0.1` để thấy nó hỏng rồi trả lại).
- [ ] **Step 3:** Viết `Directory.Build.props` (chung): `Version`, `Authors` (`Chung Nguyen`), `Copyright`,
  `RepositoryUrl` `https://github.com/ChuKhaLi/tingqr`, `RepositoryType` git, `PackageProjectUrl`,
  `PackageTags` (`vietqr;napas;qr;payment;emvco;promptpay;khqr`), `IncludeSymbols` + `SymbolPackageFormat` `snupkg`,
  `PublishRepositoryUrl`, `EmbedUntrackedSources`, `ContinuousIntegrationBuild` khi `$(GITHUB_ACTIONS) == 'true'`
  (SourceLink có sẵn trong SDK 10, không thêm gói). Mỗi csproj: `Description` (tiếng Anh, một câu như `package.json`
  npm tương ứng), `PackageReadmeFile` README.md, `PackageLicenseExpression` MIT. Rendering: `<None Include="NOTICE" Pack="true" PackagePath="" />`.
- [ ] **Step 4:** Viết hai script theo Interfaces.
- [ ] **Step 5:** Chạy lại hai lệnh ở Step 2 → đạt. `dotnet pack dotnet/TingQR.slnx -c Release -o <tmp>` → có
  `TingQR.Core.0.0.0.nupkg`, `.snupkg`, tương tự Rendering; mở `.nupkg` (zip) thấy `README.md`, Rendering có `NOTICE`,
  `.nuspec` có dependency `TingQR.Core` đúng `0.0.0`.
- [ ] **Step 6:** Commit `build(dotnet): one NuGet version and package metadata (Plan 8c)`.

### Task 4: TingQR.BankLogos

**Files:**
- Create: `dotnet/src/TingQR.BankLogos/TingQR.BankLogos.csproj`, `BankLogos.cs`, `README.md`,
  `LOGOS-NOTICE.md` (sinh, commit)
- Create: `dotnet/tests/TingQR.BankLogos.Tests/` (`TingQR.BankLogos.Tests.csproj`, `ConformanceRoot.cs` chép mẫu của
  Rendering, `BankLogosTests.cs`, `NoticeSyncTests.cs`)
- Modify: `ts/packages/bank-logos/scripts/gen.mjs` (`renderNotice(manifest, target)`, ghi thêm bản .NET; `--check`),
  `dotnet/TingQR.slnx`
- Modify: `conformance/README.md` (BankLogos .NET có hàm tra cứu, npm dùng import)

**Interfaces:**
- Produces (namespace `TingQR.BankLogos`):
  - `public static class BankLogos`
    - `public static IReadOnlyList<string> LogoBins { get; }`, `public static IReadOnlyList<string> IconIds { get; }` —
      cùng thứ tự, cùng phần tử với `manifest.json` (kind `logo`/`icon`, trường `key`), sắp xếp ordinal.
    - `public static string? Logo(string bin)`, `public static string? Icon(string appId)` — data URI hoặc `null`;
      đối số `null` → `ArgumentNullException`. So khớp đúng chuỗi (ordinal, không trim).
    - `public static BankLogoFile? OpenLogo(string bin)`, `public static BankLogoFile? OpenIcon(string appId)`.
  - `public sealed class BankLogoFile : IDisposable { public Stream Content { get; } public string ContentType { get; } public string FileName { get; } }`
  - Embedded resource: tên logical `TingQR.BankLogos/{logo|icon}/{file}` (bằng `LogicalName`), MSBuild glob
    `$(MSBuildThisFileDirectory)../../../conformance/banks/logos/{logo,icon}/*`.

- [ ] **Step 1: Test hỏng trước** (`BankLogosTests.cs`), đọc `conformance/banks/logos/manifest.json`:
  - `Lists_match_manifest`: `LogoBins`/`IconIds` bằng các `key` theo kind, ordinal.
  - `Every_data_uri_decodes_to_the_conformance_file_byte_for_byte` (Theory trên manifest): tiền tố đúng
    `data:image/svg+xml;base64,` cho `.svg`, `data:image/webp;base64,` cho `.webp`; base64 giải ra đúng byte file và
    đúng `sha256` trong manifest.
  - `Open_returns_stream_with_same_bytes_and_content_type`.
  - `Unknown_returns_null` (`"000000"`, `"nope"`), `Lookup_is_exact` (`" 970418"`, `"970418 "` → null; `"MB"` → null nếu
    manifest chỉ có `mb`), `Null_throws_ArgumentNullException`.
  - `Data_uri_is_cached` (`ReferenceEquals` hai lần gọi).
  - `Logo_works_as_svg_logo`: `TingQrRender.ToSvg(<payload VietQR từ mẫu conformance>, new SvgOptions { Logo = new LogoOptions { Href = BankLogos.Icon("mb")! } })` không ném (project test tham chiếu Rendering; gói thì không).
- [ ] **Step 2:** `dotnet test dotnet/tests/TingQR.BankLogos.Tests` → hỏng (chưa có kiểu).
- [ ] **Step 3:** Tạo csproj (khung đích, `IsPackable`, `PackageLicenseFile` `LOGOS-NOTICE.md` hoặc biểu thức nuget.org
  chấp nhận — kiểm bằng `dotnet pack` không cảnh báo; gói kèm README và LOGOS-NOTICE) và `BankLogos.cs`. Kiểu nội dung:
  kiểm byte đầu (RIFF…WEBP → webp; có `<svg` trong 4096 byte đầu → svg) khớp phần mở rộng, lệch thì ném
  `InvalidOperationException` lúc nạp (như `mimeOf`). Cache bằng `ConcurrentDictionary`/`Lazy` an toàn đa luồng.
- [ ] **Step 4:** `gen.mjs`: `renderNotice(manifest, target = 'npm' | 'dotnet')`; bản `dotnet` thay câu
  "Chỉ code (các file `.js`, `.cjs`, `.d.ts`) là MIT, xem `LICENSE`." bằng
  "Chỉ code (file `.dll` và tài liệu `.xml`) là MIT, xem https://github.com/ChuKhaLi/tingqr/blob/main/LICENSE." Build ghi
  thêm `dotnet/src/TingQR.BankLogos/LOGOS-NOTICE.md`. Thêm `node ts/packages/bank-logos/scripts/gen.mjs --check-notice`
  (thoát 1 nếu bản .NET đã commit khác bản sinh mới). Test TS hiện có của bank-logos vẫn đạt.
- [ ] **Step 5:** `NoticeSyncTests.cs`: chạy `node ts/packages/bank-logos/scripts/gen.mjs --check-notice` (bỏ qua có
  ghi lý do khi không có `node`, như `BankDataSyncTests`).
- [ ] **Step 6:** `dotnet test dotnet/TingQR.slnx` (cả `net481` trên Windows) và `pnpm -C ts --filter @tingqr/bank-logos test`
  → đạt.
- [ ] **Step 7:** README gói (tiếng Anh): ảnh không thuộc MIT, ví dụ `BankLogos.Icon("mb")` làm logo QR, so khớp đúng
  chuỗi, "Not released yet". Commit `feat(dotnet): TingQR.BankLogos (Plan 8c)`.

### Task 5: TingQR.AspNetCore — đăng ký, cấu hình, `TingQrService`

**Files:**
- Create: `dotnet/src/TingQR.AspNetCore/TingQR.AspNetCore.csproj`, `TingQrOptions.cs`, `TingQrServiceCollectionExtensions.cs`,
  `TingQrService.cs`, `TingQrConfiguration.cs` (internal: kiểm), `TingQrStartupCheck.cs` (internal `IHostedService`)
- Create: `dotnet/tests/TingQR.AspNetCore.Tests/` (`TingQR.AspNetCore.Tests.csproj` net10.0, tham chiếu
  `Microsoft.AspNetCore.Mvc.Testing`, `ConformanceRoot.cs`, `ConfigurationTests.cs`, `ServiceTests.cs`)
- Modify: `dotnet/Directory.Packages.props` (`Microsoft.AspNetCore.Mvc.Testing` 10.0.x), `dotnet/TingQR.slnx`

**Interfaces:**
- Produces (namespace `TingQR.AspNetCore`):
  - `public sealed class TingQrOptions`
    - `string? Bank { get; set; }`, `string? AccountNumber { get; set; }`, `VietQrService Service { get; set; } = Account`
    - `SvgOptions? Svg { get; set; }` — tuỳ chọn SVG chung
    - `IDictionary<string, SvgOptions> Profiles { get; } = new Dictionary<string, SvgOptions>(StringComparer.Ordinal)`
    - `string CacheControl { get; set; } = "private, max-age=300"`
  - `public static class TingQrServiceCollectionExtensions`
    - `IServiceCollection AddTingQr(this IServiceCollection services, Action<TingQrOptions>? configure = null)`
    - `IServiceCollection AddTingQr(this IServiceCollection services, IConfiguration section, Action<TingQrOptions>? configure = null)`
      — chỉ đọc `Bank`, `AccountNumber`, `Service` (`account`/`card`, không phân biệt hoa thường), `CacheControl` từ
      section; `Svg`/`Profiles` chỉ đặt bằng code (logo là data URI lấy lúc chạy).
  - `public sealed class TingQrService` (singleton)
    - `string? Bin { get; }`, `Bank? Bank { get; }` — `null` khi không cấu hình tài khoản
    - `string PaymentQr(QrAmount? amount = null, string? purpose = null)` — như `paymentQr` NestJS; không có tài khoản →
      `TingQrException(InvalidValue, "No receiving account: call AddTingQr with Bank and AccountNumber.")`
  - internal `static class TingQrConfiguration`
    - `ResolvedTingQr Resolve(TingQrOptions o)` — kiểm toàn bộ, ném `TingQrException`
    - `void CheckRouteOptions(SvgOptions? options)` — logo `data:image/` + `CheckSvgOptions`, với luật "chỉ foreground
      ở route thì kiểm với `Background = "transparent"`" (như `TingQrSvg()` NestJS)
    - `SvgOptions? Merge(SvgOptions? appWide, SvgOptions? route)` — từng thuộc tính (cả của `MatrixOptions`): giá trị
      route khác `null` thắng; `Logo` thay nguyên khối.
  - `TingQrStartupCheck` chạy `Resolve` trong `StartAsync` để `TingQrException` làm app không khởi động (không bọc
    trong `OptionsValidationException`). Task 7 mở rộng nó.

Luật `Resolve` (theo `resolveOptions` NestJS và `configuration.appWide`):
1. `Bank` và `AccountNumber` đều `null`/rỗng → không có tài khoản (được phép). Chỉ một trong hai → `INVALID_VALUE`
   nêu tên khoá thiếu.
2. Có tài khoản: `Banks.Find(Bank)` null → `INVALID_VALUE` (thông báo như NestJS, ví dụ `'MB', 'VCB', '970422'`);
   mã tĩnh `VietQr.Encode(...)` (lỗi tài khoản ném lỗi của Core).
3. Logo `Svg` không `data:image/` → `INVALID_VALUE`. `Svg` có: có tài khoản → `ToSvg(maTinh, Svg)`; không → `CheckSvgOptions(Svg)`.
4. Mỗi `Profiles[name]`: `CheckRouteOptions`. Tên rỗng → `INVALID_VALUE`.

- [ ] **Step 1: Test hỏng trước** (`ConfigurationTests.cs`, dựng app bằng `WebApplication.CreateBuilder()` +
  `UseTestServer()`, `await app.StartAsync()`):
  - `Unknown_bank_stops_startup` → `TingQrException`, `Code == InvalidValue`.
  - `Account_without_bank_stops_startup`, `Bank_without_account_stops_startup` (thông báo chứa tên khoá thiếu).
  - `Invalid_account_stops_startup` (lỗi của `VietQr.Encode`).
  - `Logo_not_data_uri_stops_startup` (`Href = "/logo.png"`), cho `Svg` và cho một profile.
  - `Svg_that_cannot_render_static_code_stops_startup` (logo `Size = 0.25` + `MaxVersion = 1`, hoặc tương phản kém).
  - `No_account_is_allowed` (chỉ `Svg`).
  - `Binds_from_configuration`: `AddInMemoryCollection` `TingQr:Bank=MB`, `TingQr:AccountNumber=<số từ mẫu conformance VietQR>`,
    `TingQr:Service=card` → `TingQrService.Bin == "970422"`.
  - `Profile_foreground_alone_is_checked_as_colour_only` (`Foreground = "#ffffff"` không background → khởi động được);
    `Profile_bad_colour_stops_startup` (`Foreground = "red"`).
  - `ServiceTests.cs`: `PaymentQr()` bằng `VietQr.Encode` cùng đầu vào; có `amount`, `purpose`; `purpose` có dấu → `NonAscii`;
    không tài khoản → `InvalidValue`; `Bank`/`Bin` null khi không tài khoản.
  - `Merge_route_wins_key_by_key` (bảng: `Margin` route + `Foreground` chung → cả hai; `Logo` route thay nguyên khối;
    `Ecc` từ `MatrixOptions`).
- [ ] **Step 2:** `dotnet test dotnet/tests/TingQR.AspNetCore.Tests` → hỏng.
- [ ] **Step 3:** Cài đặt theo Interfaces.
- [ ] **Step 4:** Chạy lại → đạt; `dotnet build dotnet/TingQR.slnx -c Release` 0 cảnh báo.
- [ ] **Step 5:** Commit `feat(dotnet): TingQR.AspNetCore registration and TingQrService (Plan 8c)`.

### Task 6: Trả SVG — `TingQrResults.Svg` và Minimal API `WithTingQrSvg`

**Files:**
- Create: `dotnet/src/TingQR.AspNetCore/SvgResponse.cs` (internal: vẽ + header + 404/500 + log),
  `TingQrResults.cs`, `TingQrEndpointExtensions.cs`, `TingQrSvgEndpointFilter.cs` (internal)
- Create: `dotnet/tests/TingQR.AspNetCore.Tests/Contract.cs` (đọc `svg-response.json`), `MinimalApiContractTests.cs`,
  `ResultsContractTests.cs`

**Interfaces:**
- Consumes: `TingQrConfiguration.CheckRouteOptions`, `Merge`, `TingQrOptions` (Task 5).
- Produces:
  - internal `static class SvgResponse`:
    `IResult For(string? payload, SvgOptions? route, string? cacheControl)` — trả `IResult` thực thi: lấy
    `IOptions<TingQrOptions>` (nếu đã đăng ký) qua `HttpContext.RequestServices`, `Merge(appWide, route)`, rồi:
    payload `null`/`""` → 404 (`Results.NotFound()`); vẽ được → 200 + 4 header (`cacheControl ?? options.CacheControl ?? "private, max-age=300"`);
    `TingQrException` khi vẽ → 500 + JSON `{"error":{"code":…}}` + log.
    `IResult Error(TingQrException e)` — 500 + log.
    Log: `ILogger` category `"TingQR.AspNetCore.TingQrSvg"`, mức Error, `"{Code}: {Message}"`, kèm exception.
  - `public static class TingQrResults { public static IResult Svg(string? payload, SvgOptions? options = null, string? cacheControl = null) }`
    — **không ném** khi tuỳ chọn sai: lỗi tuỳ chọn (kể cả logo không `data:image/`) thành 500 lúc thực thi.
  - `public static class TingQrEndpointExtensions { public static TBuilder WithTingQrSvg<TBuilder>(this TBuilder builder, SvgOptions? options = null, string? cacheControl = null) where TBuilder : IEndpointConventionBuilder }`
    — gọi `CheckRouteOptions(options)` **ngay khi gọi** (ném `TingQrException`), rồi gắn endpoint filter.
  - Filter: `await next(ctx)` trong try; `TingQrException` → `SvgResponse.Error`; kết quả `string`/`null` →
    `SvgResponse.For`; kiểu khác → `InvalidOperationException("A WithTingQrSvg endpoint must return a QR payload string or null; got <type>.")`.
    Status luôn 200 (ASP.NET Core không có tương đương `@HttpCode` trên endpoint; ghi README).

- [ ] **Step 1: Test hỏng trước.** `Contract.cs` đọc `success.status`, `success.headers`, `tingQrError.status` từ JSON
  (không chép tay giá trị). `MinimalApiContractTests` (TestServer, endpoint đặt payload theo id cố định trong code test,
  **không** từ query):
  - `Get_returns_svg_with_contract_headers` — thân bằng `TingQrRender.ToSvg(payload, merged)`.
  - `Post_put_patch_return_200`.
  - `Null_and_empty_return_404` (cả `Task<string?>` trả `null`).
  - `Async_handler_task_and_valuetask_work`.
  - `TingQrException_from_handler_returns_500_code_only` — thân đúng `{"error":{"code":"NON_ASCII"}}`, không chứa
    thông báo; log nhận đúng một dòng Error chứa mã và thông báo (logger provider thu log trong test).
  - `Render_error_returns_500` (payload quá dài với `MaxVersion = 1`; logo quá to với mã nhỏ → `INVALID_VALUE`).
  - `Other_exception_passes_to_app` (`InvalidOperationException` → `UseExceptionHandler` của app nhận).
  - `TingQrException_bypasses_app_exception_handler` (app có `UseExceptionHandler` → vẫn 500 thân hợp đồng).
  - `WithTingQrSvg_bad_option_throws_at_mapping` (logo `/x.png`, `Margin = 99`).
  - `Route_options_merge_over_app_wide`; `Cache_control_override` (tham số và `TingQrOptions.CacheControl`).
  - `Works_without_AddTingQr` (PromptPay payload từ mẫu conformance).
  - `Non_string_result_is_programming_error`.
  - `ResultsContractTests`: cùng 200/404/500 cho `TingQrResults.Svg`, và `Bad_options_give_500_not_throw`.
- [ ] **Step 2:** Chạy → hỏng.
- [ ] **Step 3:** Cài đặt theo Interfaces.
- [ ] **Step 4:** Chạy → đạt.
- [ ] **Step 5:** Commit `feat(dotnet): serve SVG from Minimal API and TingQrResults (Plan 8c)`.

### Task 7: MVC `[TingQrSvg]`, bộ tuỳ chọn đặt tên, quét lúc khởi động

**Files:**
- Create: `dotnet/src/TingQR.AspNetCore/TingQrSvgAttribute.cs`, `TingQrSvgMvcFilter.cs` (internal)
- Modify: `TingQrStartupCheck.cs`
- Create: `dotnet/tests/TingQR.AspNetCore.Tests/MvcContractTests.cs`, `MvcStartupTests.cs`

**Interfaces:**
- Consumes: `SvgResponse` (Task 6), `TingQrOptions.Profiles`, `Merge`.
- Produces:
  - `[AttributeUsage(Class | Method, AllowMultiple = false, Inherited = true)] public sealed class TingQrSvgAttribute : Attribute, IFilterFactory`
    - `TingQrSvgAttribute()`, `TingQrSvgAttribute(string profile)`; `string? Profile { get; }`;
      `string? CacheControl { get; set; }`.
  - Chọn bộ: attribute **gần nhất** thắng nguyên khối (action thắng controller, như `getAllAndOverride` NestJS); bộ đó
    gộp từng khoá lên `TingQrOptions.Svg` bằng `Merge`. Mỗi request chỉ một filter vẽ (filter của attribute không gần
    nhất không làm gì).
  - Filter (`IAsyncActionFilter`): sau `next()`: `Exception` là `TingQrException` → `SvgResponse.Error`,
    `ExceptionHandled = true`; `Result` là `ObjectResult` với `string`/`null` (gồm `Task<string>`, `ActionResult<string>`)
    hoặc `EmptyResult`/`NoContent` của action `string` trả null → `SvgResponse.For`; kết quả khác → `InvalidOperationException`.
  - `TingQrStartupCheck`: nếu có `IActionDescriptorCollectionProvider`, duyệt mọi action có `TingQrSvgAttribute`
    (trong `EndpointMetadata`); `Profile` không có trong `Profiles` → `TingQrException(InvalidValue, "…[TingQrSvg(\"x\")] on Controller.Action: no profile \"x\" in AddTingQr Profiles.")`.
    `[TingQrSvg]` dùng mà không gọi `AddTingQr` → được, trừ khi có `Profile`.

- [ ] **Step 1: Test hỏng trước** (controller test trong project test, `AddControllers().AddApplicationPart(...)`):
  - `MvcContractTests`: cùng bộ hợp đồng như Task 6 (200 mọi method kể cả POST, 4 header, 404, 500 chỉ mã + log, lỗi
    khác tới app, `TingQrException` thắng exception filter toàn cục của app, `Task<string>`/`ActionResult<string>`).
  - `Profile_with_bank_logo_renders` — profile `Logo = new LogoOptions { Href = BankLogos.Icon("mb")! }` (project test
    tham chiếu BankLogos), thân bằng `ToSvg(payload, merged)`.
  - `Action_attribute_overrides_controller_and_renders_once` (controller `[TingQrSvg("a")]`, action `[TingQrSvg("b")]`
    → thân theo bộ `b` gộp lên chung; thân là SVG một lớp, không vẽ lại SVG như payload).
  - `Cache_control_on_attribute`.
  - `Profile_clash_with_app_wide_is_500_per_request` (chung có `Logo`, profile `Ecc = L`).
  - `MvcStartupTests`: `Unknown_profile_stops_startup` (thông báo nêu controller/action và tên bộ);
    `Attribute_without_AddTingQr_works`; `Profile_attribute_without_AddTingQr_stops_startup`.
- [ ] **Step 2:** Chạy → hỏng.
- [ ] **Step 3:** Cài đặt theo Interfaces.
- [ ] **Step 4:** Chạy toàn bộ `dotnet test dotnet/TingQR.slnx` → đạt.
- [ ] **Step 5:** README gói `TingQR.AspNetCore` (tiếng Anh, bố cục theo README `@tingqr/nestjs`: cấu hình, appsettings,
  `PaymentQr`, Minimal API, MVC + profiles, bảng phản hồi, header, vì sao không có route `?acc=&bank=`, status luôn 200,
  "Not released yet"). Commit `feat(dotnet): MVC [TingQrSvg] with named profiles (Plan 8c)`.

### Task 8: Mutation và CI cho hai gói mới

**Files:**
- Create: `dotnet/stryker-config.aspnetcore.json`, `dotnet/stryker-config.banklogos.json`
- Modify: `.github/workflows/mutation-dotnet.yml` (thêm hai dòng matrix, chạy từ thư mục test của từng gói),
  `.github/workflows/ci-dotnet.yml` (không cần đổi nếu `slnx` đã có project mới — kiểm), `.github/workflows/ci-ts.yml`
  (thêm `gen.mjs --check-notice` nếu `ci-ts` chưa chạy `NoticeSyncTests` qua .NET — một trong hai là đủ, ghi lý do)

- [ ] **Step 1:** Hai cấu hình theo mẫu `stryker-config.rendering.json` (ngưỡng 90/90/95, `net10.0`, `perTest`).
- [ ] **Step 2:** Chạy cục bộ từ `dotnet/tests/TingQR.AspNetCore.Tests/` và `dotnet/tests/TingQR.BankLogos.Tests/`
  (`dotnet tool run dotnet-stryker --config-file ../../stryker-config.<x>.json`) → mỗi gói ≥ 90. Đột biến sống sót: viết
  test giết nó; chỉ đột biến tương đương được `disable once` với lý do trên dòng. Ghi số (killed/timeout/survived/ignored)
  vào `dotnet/CLAUDE.md`.
- [ ] **Step 3:** Thêm matrix vào `mutation-dotnet.yml`, cập nhật comment đầu file.
- [ ] **Step 4:** Commit `ci(dotnet): mutation testing for AspNetCore and BankLogos (Plan 8c)`.

### Task 9: Diễn tập NuGet và `release-dotnet.yml`

**Files:**
- Create: `.claude/skills/release-drill-dotnet/SKILL.md`, `.claude/skills/release-drill-dotnet/scripts/drill.mjs`
  (skill riêng: skill npm đã dài và cài từ registry npm; hai đường phát hành độc lập)
- Create: `dotnet/scripts/check-release.mjs`, test trong `dotnet/scripts/test/check-release.test.mjs`
- Create: `.github/workflows/release-dotnet.yml`

**Interfaces:**
- Consumes: `dotnet/scripts/release-common.mjs` (Task 3).
- Produces:
  - `node dotnet/scripts/check-release.mjs [--tag dotnet-vX.Y.Z]`: số trong `Directory.Build.props` bằng
    `TingQrVersion.Value`; với `--tag`: tag đúng `dotnet-v<version>`, `x.y.z`, không `0.0.0`, README bốn gói + mục .NET
    của README gốc không còn "Not released yet". Exit 0/1, in lý do.
  - `node .claude/skills/release-drill-dotnet/scripts/drill.mjs [--out dir]`: exit 0 khi mọi mục đạt; `--out` chép
    `.nupkg` + `.snupkg` đã diễn tập.

- [ ] **Step 1: Test hỏng trước** cho `check-release.mjs` (`node --test`): tag sai tiền tố (`ts-v0.1.0`), lệch số,
  `0.0.0`, README còn "Not released yet", hằng `TingQrVersion` lệch → exit 1; trường hợp đúng → exit 0.
- [ ] **Step 2:** Cài đặt `check-release.mjs` → test đạt.
- [ ] **Step 3:** `drill.mjs` làm, theo thứ tự, mỗi mục in ĐẠT/HỎNG:
  1. `dotnet pack dotnet/TingQR.slnx -c Release -o <tmp>/pkgs`; đúng 4 `.nupkg` + 4 `.snupkg`.
  2. Đọc từng `.nupkg` (zip; tự đọc central directory hoặc công cụ có sẵn trên cả Windows và Ubuntu, không cài gói npm):
     có `README.md`; Rendering có `NOTICE`; BankLogos có `LOGOS-NOTICE.md` và đủ số ảnh embedded bằng số mục trong `manifest.json`;
     `lib/net10.0` (+ `lib/netstandard2.0` trừ AspNetCore) có `.dll` + `.xml`; `.nuspec` có license, repository commit,
     dependency giữa các gói đúng số; AspNetCore có `frameworkReference Microsoft.AspNetCore.App`.
  3. Thư mục tạm **ngoài repo** có `nuget.config` chỉ hai nguồn: `<tmp>/pkgs` cho `TingQR.*` (package source mapping)
     và nuget.org cho phần còn lại; tạo `dotnet new console` và `dotnet new web`, `dotnet add package` bốn gói đúng số.
  4. Console: tạo + đọc VietQR, `ToSvg` có logo `BankLogos.Icon("mb")`, in `TingQrVersion.Value`; chạy và kiểm đầu ra.
  5. Web: `AddTingQr` (tài khoản thử từ mẫu conformance), một endpoint `WithTingQrSvg`, một controller
     `[TingQrSvg("logo")]`; khởi động, gọi hai route bằng `HttpClient`, kiểm 200 + header + thân bắt đầu `<svg`; cấu hình
     sai ngân hàng → tiến trình thoát khác 0.
  6. Thất bại: giữ thư mục tạm, in đường dẫn; `KEEP_DRILL_ARTIFACTS=1` giữ cả khi đạt.
  SKILL.md (tiếng Việt, theo mẫu `release-drill`): vì sao có, cách chạy, gọi mạng tới nuget.org (báo chủ dự án trước
  khi chạy ở máy), kiểm gì.
- [ ] **Step 4:** Chạy `node .claude/skills/release-drill-dotnet/scripts/drill.mjs` → mọi mục ĐẠT. Ghi kết quả (ngày,
  OS) vào SKILL.md.
- [ ] **Step 5:** `release-dotnet.yml`, cùng cấu trúc và comment như `release-ts.yml`:
  - `on`: tag `dotnet-v*`; `workflow_dispatch` và PR chạm workflow/script/skill → dry-run.
  - `concurrency` như `release-ts.yml` (nhóm `release-dotnet-publish`).
  - Job `verify`: checkout `fetch-depth: 0`, setup-dotnet 10, setup-node 22, build, test, `node --test dotnet/scripts/test/`,
    `check-release.mjs` (có/không `--tag`), tag phải trên `main`, drill `--out packages`, upload artifact.
  - Job `publish`: chỉ tag `dotnet-v*`, `environment: nuget-release`, `id-token: write`; từ chối khi repo riêng tư (như
    `release-ts.yml`, trừ khi Step 6 cho thấy NuGet có lý do khác — ghi lại); `NuGet/login@v1` (ghim SHA commit) với
    `user` là tên tài khoản nuget.org (biến `vars.NUGET_USER`, không phải secret); `dotnet nuget push` từng gói theo
    thứ tự Core → Rendering → BankLogos → AspNetCore, `--skip-duplicate` **không** dùng.
- [ ] **Step 6:** Đọc https://learn.microsoft.com/nuget/nuget-org/trusted-publishing (bằng công cụ tải trang); ghi vào
  comment đầu workflow những gì đã kiểm (ngày đọc, policy theo tài khoản hay gói, quy tắc repo riêng tư, tham số
  `NuGet/login`). Điều nào khác plan thì sửa workflow theo trang gốc và ghi lại.
- [ ] **Step 7:** Commit `ci(dotnet): NuGet release drill and release-dotnet workflow (Plan 8c)`.

### Task 10: Tài liệu và trạng thái

**Files:**
- Modify: `README.md`, `README.vi.md` (mục .NET: bốn gói, "Not released yet", số phiên bản riêng với npm),
  `dotnet/src/TingQR.Core/README.md`, `dotnet/src/TingQR.Rendering/README.md` (trạng thái, cài từ NuGet)
- Modify: `docs/RELEASING.md` (phần NuGet: tài khoản, giữ tiền tố `TingQR`, trusted publishing policy owner
  `ChuKhaLi`/repo `tingqr`/workflow `release-dotnet.yml`/environment `nuget-release`, biến `NUGET_USER`, thứ tự phát
  hành, theo những gì Task 9 Step 6 đã kiểm)
- Modify: `CHANGELOG.md` (mục .NET riêng; quy tắc ghi commit bộ mẫu `conformance/` mà bản đạt)
- Modify: `docs/superpowers/specs/2026-11-18-tingqr-design.md` 5.6 (bỏ "v0.2", trỏ spec 8c) và 5.8 (số phiên bản riêng)
- Modify: `CLAUDE.md` (dòng Plan 8c), `dotnet/CLAUDE.md` (hai gói mới, lệnh mutation, drill), `conformance/README.md`

- [ ] **Step 1:** Viết các thay đổi trên; chỉ ghi điều đã kiểm (số test, số mutation, kết quả drill kèm ngày).
- [ ] **Step 2:** `pnpm test:all` → exit 0; `node .claude/skills/release-drill-dotnet/scripts/drill.mjs` → đạt;
  `node ts/packages/bank-logos/scripts/gen.mjs --check-notice` → exit 0.
- [ ] **Step 3:** Commit `docs: Plan 8c status, NuGet release steps (Plan 8c)`.
- [ ] **Step 4:** Chạy agent `evidence-review` và `parity-review` trên cả nhánh; sửa, review lại; rồi
  superpowers:finishing-a-development-branch.
