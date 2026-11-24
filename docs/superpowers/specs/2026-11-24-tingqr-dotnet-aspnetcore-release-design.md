# Thiết kế Plan 8c: TingQR.AspNetCore, TingQR.BankLogos, đóng gói NuGet (2026-11-24)

Thuộc Plan 8 (bản .NET). 8a (`TingQR.Core`) và 8b (`TingQR.Rendering`) đã gộp `main`. Spec chung:
`docs/superpowers/specs/2026-11-18-tingqr-design.md` (5.4 logo, 5.6 tích hợp, 5.8 phát hành). Hợp đồng HTTP:
`conformance/http/svg-response.json`. Bản TS tương ứng: `@tingqr/nestjs` (spec `2026-11-21-tingqr-nestjs-design.md`),
`@tingqr/hono`, `@tingqr/bank-logos`, phát hành npm (spec `2026-11-21-tingqr-release-design.md`).

## Mục đích

Đưa bản .NET tới mức **sẵn sàng phát hành và đã diễn tập**, ngang bản npm sau Plan 7: dev ASP.NET Core dùng được tingqr
như dev NestJS/Hono (cấu hình tài khoản nhận một lần, trả QR SVG từ route của mình), có logo ngân hàng, bốn gói NuGet đủ
metadata, workflow phát hành chỉ chờ chủ dự án bật.

## Mục tiêu

- `TingQR.AspNetCore`: `AddTingQr`, `TingQrService.PaymentQr`, trả SVG qua **Minimal API và MVC** theo
  `svg-response.json`.
- `TingQR.BankLogos`: cùng ảnh với `@tingqr/bank-logos`, dạng data URI dùng thẳng cho `LogoOptions.Href`.
- Bốn gói NuGet (`TingQR.Core`, `TingQR.Rendering`, `TingQR.AspNetCore`, `TingQR.BankLogos`) đóng gói đúng, cài được
  vào project sạch, dùng được như người dùng thật.
- `release-dotnet.yml` (tag `dotnet-v*`), diễn tập, `docs/RELEASING.md` phần NuGet.
- Rà tên kiểu công khai trước khi khoá API.

## Không làm

- **Không phát hành thật** (v0.1 hoãn; repo còn riêng tư). Job publish của `release-dotnet.yml` chưa chạy.
- Không vẽ PNG (gói vẽ ảnh máy chủ sau v0.1). Không static web assets cho logo (cách C, thêm sau nếu có người cần).
- Không route mở dựng QR từ tham số URL (chủ dự án đã quyết; lý do lừa đảo).
- Không Razor tag helper / Blazor component (chưa ai cần; ghi để sau).

## Không được xảy ra (anti-goals)

- Thân 500 lộ thông báo lỗi (có thể chứa cấu hình app).
- Lỗi cấu hình tuỳ chọn chỉ lộ ra ở request đầu thay vì chặn app khởi động.
- Ảnh logo .NET lệch byte với ảnh npm.
- Gói chạy trong repo nhưng hỏng khi cài từ `.nupkg` (thiếu NOTICE, thiếu README, sai dependency, sai khung đích).

## Ràng buộc

- Hợp đồng `conformance/http/svg-response.json`, gồm `configuration` (kiểm lúc cấu hình) và `logo` (`data:image/`).
- SVG trả về phải đúng `TingQrRender.ToSvg(payload, options)` (khớp TS từng byte, đã có mẫu vàng).
- Quy ước `dotnet/CLAUDE.md`: `InvariantCulture`/`Ordinal`, không dependency lúc chạy ngoài gói tingqr và shared
  framework; mutation ngưỡng chặn 90, không hạ, `Stryker disable` chỉ cho đúng đột biến tương đương.
- Ảnh logo lấy từ `conformance/banks/logos/` (`manifest.json` + `logo/`, `icon/`), cùng nguồn với `scripts/gen.mjs` của
  `@tingqr/bank-logos`. Logo không thuộc MIT.
- Không gọi `dotnet nuget push` cục bộ; mọi lệnh phát hành thật chỉ trong CI, sau khi chủ dự án duyệt.

## Các cách đã xét

**Kiểu gắn vào route** (chủ dự án chọn **B**):
- A. Chỉ Minimal API: ít code, hợp .NET 10, nhưng bỏ ngoài các app dùng controller.
- **B. Minimal API + MVC** (`[TingQrSvg]`): phủ cả app cũ dùng controller; phải test hợp đồng ở hai đường.
- C. Chỉ kiểu kết quả `IResult`/`IActionResult`: đơn giản nhất nhưng không kiểm tuỳ chọn lúc khởi động được.

**Số phiên bản** (chủ dự án chọn **riêng**):
- Chung một số npm/NuGet: nhìn số biết khớp, nhưng sinh bản phát hành rỗng ở một bên (npm không rút lại được).
- **Riêng từng bên**, cùng bắt đầu `0.1.0`: khớp nhau được chứng minh bằng `conformance/`, không bằng số.

**Cách lưu logo** (chủ dự án chọn **A**):
- **A. Embedded resource, đọc khi cần**, trả data URI: DLL ~1,2 MB, RAM chỉ cho ảnh đã dùng, một nguồn file cho hai ngôn
  ngữ, không phải bịa tên.
- B. Sinh hằng chuỗi base64 mỗi ảnh: có gợi ý code và trim được, nhưng DLL ~3 MB (UTF-16), phải bịa tên C# cho BIN, sinh
  lại mã mỗi lần cập nhật ngân hàng.
- C. Static web assets: không đủ một mình vì hợp đồng bắt logo giữa QR là `data:image/`.

## Thiết kế

### TingQR.AspNetCore

- **Khung đích `net10.0` duy nhất** [Claude]: ASP.NET Core không chạy trên `netstandard2.0`; .NET 8 hết hỗ trợ
  2026-11-10, .NET 9 (STS) hết trong tháng 11/2026. `FrameworkReference Microsoft.AspNetCore.App`; phụ thuộc
  `TingQR.Core`, `TingQR.Rendering`.
- **Đăng ký:** `services.AddTingQr(o => { o.Bank = "MB"; o.AccountNumber = "..."; o.Service = ...; o.Svg = new SvgOptions { ... }; })`,
  và overload nhận `IConfiguration` section (`builder.Configuration.GetSection("TingQr")`) [Claude], tương đương
  `forRoot`/`forRootAsync` của NestJS.
  - Kiểm **khi app khởi động** (Options validation + `ValidateOnStart`): ngân hàng lạ (`Banks.FindBank`), số tài khoản
    sai, logo không bắt đầu `data:image/`, `Svg` không vẽ được mã tĩnh của tài khoản (luật `configuration.appWide`).
    Lỗi là `TingQrException` `INVALID_VALUE`, app không chạy.
  - Gọi `AddTingQr()` không có tài khoản (chỉ `Svg` chung) được phép: dùng để trả PromptPay/KHQR; khi đó
    `TingQrService.PaymentQr` báo lỗi rõ ràng [Claude; cách báo để builder chọn, ghi trong README].
- **`TingQrService`**: `PaymentQr(amount?, purpose?)` trả chuỗi VietQR của tài khoản đã cấu hình (không `amount` = mã
  tĩnh; nội dung có dấu → `NON_ASCII`), `Bin`, `Bank`. Giống `TingQrService` của NestJS.
- **Minimal API:** `app.MapGet("/orders/{id}/qr.svg", handler).WithTingQrSvg(options?)` (endpoint filter); handler trả
  `string?`/`Task<string?>`. Thêm `TingQrResults.Svg(payload, options?)` (`IResult`) cho ai tự quyết trong handler.
  `TingQrResults.Svg` chạy theo request nên **không ném lỗi** khi tuỳ chọn sai: nó trả `IResult` viết 500 theo hợp
  đồng và ghi log, như hai đường kia. Nếu app có `AddTingQr`, nó gộp `Svg` chung (lấy qua `HttpContext.RequestServices`)
  bên dưới `options` theo luật `merged` [Claude].
- **MVC:** `[TingQrSvg]` hoặc `[TingQrSvg("order")]` trên action hoặc controller (chủ dự án chọn **bộ tuỳ chọn đặt
  tên**). Tham số attribute C# chỉ được là hằng số, nên tuỳ chọn riêng (kể cả logo data URI lấy lúc chạy) khai báo trong
  `AddTingQr`: `o.Profiles["order"] = new SvgOptions { … }`; attribute chỉ ghi tên bộ và (tuỳ chọn) `CacheControl`.
  - ~~Thứ tự gộp, từng khoá một: bộ của action đè bộ của controller đè `Svg` chung.~~ **Đã đổi khi làm (Plan 8c Task 7,
    plan được chủ dự án duyệt):** attribute gần nhất (action hơn controller hơn bộ lọc toàn cục) thắng **cả khối**, rồi
    bộ của nó gộp từng khoá lên `Svg` chung. Lý do: giống `getAllAndOverride` của `@TingQrSvg()` NestJS, và một bộ tên
    riêng là một ý định trọn vẹn (gộp `a` của controller với `b` của action ra một tổ hợp không ai khai báo). Mỗi request
    vẽ đúng một lần.
  - Mỗi bộ được kiểm khi app khởi động như tuỳ chọn route (`CheckSvgOptions`, logo `data:image/`); tên bộ mà attribute
    trỏ tới nhưng không khai báo → app không chạy.
- **Hợp đồng (cả hai đường, cả `TingQrResults.Svg`):**
  - chuỗi không rỗng vẽ được → 200 với mọi method (cả `POST`), bốn header ảnh, `Cache-Control` đổi được qua tuỳ chọn
    `CacheControl`; status app tự đặt rõ trên route được giữ nếu ASP.NET có cơ chế tương đương `@HttpCode` (builder kiểm
    và ghi);
  - `null`/`""` → 404 (thân để framework quyết);
  - handler ném `TingQrException`, hoặc payload/tuỳ chọn không vẽ được → 500, thân đúng `{"error":{"code":"…"}}`, mã
    và thông báo ghi qua `ILogger` (category để builder chọn, ghi README);
  - lỗi khác → để nguyên cho pipeline lỗi của app.
- **Kiểm tuỳ chọn khi cấu hình:**
  - `WithTingQrSvg(options)` và `TingQrResults`… kiểm ngay khi gọi (`CheckSvgOptions`, luật `logo.mustStartWith`).
  - `[TingQrSvg]`: lúc app khởi động **quét mọi action có `[TingQrSvg]`**, kiểm tên bộ tồn tại và `CacheControl`; bộ
    tuỳ chọn tự được kiểm qua Options validation [Claude]. Cách quét (ví dụ hosted service đọc
    `IActionDescriptorCollectionProvider`) để builder chọn.
  - Luật `merged`: `Foreground` của route mà không có `Background` của route chỉ kiểm như một màu lúc cấu hình; xung đột
    giữa tuỳ chọn chung và route phát hiện theo request (500).
- **Test:** chạy hợp đồng HTTP qua `WebApplicationFactory`/`TestServer` cho Minimal API, MVC và `TingQrResults`, đối
  chiếu với `svg-response.json` (thân SVG so với `ToSvg`). `Microsoft.AspNetCore.Mvc.Testing` chỉ là dependency của
  project test.

### TingQR.BankLogos

- Khung đích `net10.0;netstandard2.0`, không dependency (cả `TingQR.Core` cũng không, như `@tingqr/bank-logos` không phụ
  thuộc core) [Claude].
- Ảnh trong `conformance/banks/logos/{logo,icon}/` nhúng làm embedded resource **tại build** (MSBuild glob, không chép
  file vào `dotnet/`).
- API [Claude, tên cuối cùng chốt ở bước rà tên]:
  - `BankLogos.Logo(string bin)` và `BankLogos.Icon(string appId)` → `string?` data URI (`data:image/svg+xml;base64,…`
    hoặc `data:image/webp;base64,…`), `null` nếu không có ảnh; đối số `null` → `ArgumentNullException` (gói không phụ
    thuộc Core nên không có `TingQrException`) [Claude].
  - `BankLogos.OpenLogo`/`OpenIcon` → stream + kiểu nội dung, cho ai tự phục vụ file.
  - `BankLogos.LogoBins`, `BankLogos.IconIds` (danh sách chỉ đọc), giống `LOGO_BINS`/`ICON_IDS`.
  - Data URI cache sau lần gọi đầu, an toàn đa luồng.
- Kiểu nội dung lấy theo **nội dung file** đối chiếu phần mở rộng, như `mimeOf` của `gen.mjs`.
- `LOGOS-NOTICE.md` bản .NET: bản npm ghi "chỉ file `.js`, `.cjs`, `.d.ts` là MIT", sai trong gói chứa DLL. `gen.mjs`
  sinh thêm bản .NET (chỉ khác câu đó) vào `dotnet/src/TingQR.BankLogos/LOGOS-NOTICE.md`, được commit; CI kiểm bản
  commit khớp lần sinh mới (bản .NET không cần Node khi build) [Claude]. Bản này đóng vào gói; giấy phép gói ghi như bản npm (code MIT, ảnh xem notice):
  `PackageLicenseFile` hoặc biểu thức tương đương mà nuget.org chấp nhận — builder kiểm.
- Test: mọi ảnh trong `manifest.json` có mặt; data URI giải ra **đúng từng byte** file trong `conformance/`; danh sách
  khớp `manifest.json`; kiểu nội dung đúng.
- **Khác bản npm (ghi cho parity-review):** npm không có hàm tra cứu (dùng `import` theo đường dẫn); .NET có hàm tra cứu
  vì không có tree-shaking. Ghi trong README của hai gói và `conformance/README.md`.

### Đóng gói NuGet

- **Số phiên bản riêng với npm**; bốn gói NuGet chung một số với nhau. Một nơi đặt số (`dotnet/Directory.Build.props`)
  cộng `TingQrVersion.Value`. Script `set-version` cho .NET (Node, giống `ts/scripts/set-version.mjs`) đặt cả hai và
  từ chối số không phải `x.y.z`. Test kiểm `TingQrVersion.Value` bằng `Version` của assembly/gói.
- Gói tham chiếu nhau bằng đúng số đang đóng gói (ProjectReference → PackageReference khi `pack`).
- Metadata chung trong `Directory.Build.props` (Authors, RepositoryUrl, PackageProjectUrl, tags, SourceLink,
  `.snupkg`, `Deterministic`, `ContinuousIntegrationBuild` trên CI) [Claude]; riêng từng gói: Description,
  `PackageReadmeFile` (README.md mỗi gói, tiếng Anh), giấy phép.
- `TingQR.Rendering`: `NOTICE` (Nayuki) phải nằm trong gói.
- Icon gói: để builder quyết có hay không (chưa có icon dự án); không dùng logo ngân hàng.
- README gốc và `README.vi.md`: thêm mục .NET, trạng thái "Not released yet", như các gói npm.

### Rà tên trước khi khoá API

- Một task trong plan: lập danh sách đổi tên đề xuất cho API công khai của bốn gói (đã biết: `VietQr.Guid` và
  `VnpayQr.Guid` che `System.Guid`; `VnpayQrData` lệch kiểu đặt tên với `PromptPayData`/`KhqrData`; `DetectResult.Data`
  là `object`), ghi lý do từng dòng, **chủ dự án duyệt danh sách trước khi đổi**.
- **Là bước đầu của plan, chặn các bước sau:** AspNetCore và BankLogos xây trên API đã đổi tên.
- **Chỉ đổi .NET trong 8c** (chủ dự án chọn). Tên nào cũng có ở TS thì ghi vào danh sách việc riêng cho TS sau 8c;
  tên khác nhau giữa hai bản trong lúc chờ được ghi ở `conformance/README.md` (parity-review dựa vào đó).
- Không đổi tên trường JSON / giá trị trong `conformance/` (dùng chung với TS).

### Phát hành và diễn tập

- `release-dotnet.yml`: chỉ tag `dotnet-v*` nằm trên `main` mới phát hành, từng tag một (`concurrency`), qua environment
  `nuget-release`, OIDC bằng `NuGet/login`, không lưu API key; chạy tay và PR chỉ dry-run (build, test, pack, kiểm gói).
  Kiểm tag khớp số trong `Directory.Build.props`. Giống `release-ts.yml` ở mọi chỗ tương đương.
- Diễn tập: `pack` bốn gói vào thư mục tạm, tạo project console và web **ngoài repo**, cài từ thư mục `.nupkg` đó
  (nguồn NuGet cục bộ, không nuget.org cho gói tingqr), dùng như người dùng thật: tạo/đọc VietQR, vẽ SVG có logo từ
  `TingQR.BankLogos`, gọi một route `[TingQrSvg("…")]` có logo BankLogos và một route `WithTingQrSvg`; kiểm `.nupkg` chứa README, NOTICE,
  LOGOS-NOTICE, XML doc, đúng khung đích, đúng dependency. Làm thành skill riêng hoặc mở rộng `release-drill`
  [builder chọn; ghi lý do].
- `docs/RELEASING.md` thêm phần NuGet: tài khoản nuget.org, giữ tiền tố `TingQR` (prefix reservation), trusted
  publishing policy (owner `ChuKhaLi`, repo `tingqr`, workflow `release-dotnet.yml`, environment `nuget-release`).
  **Phải đọc lại** https://learn.microsoft.com/nuget/nuget-org/trusted-publishing trước khi viết: tài liệu bên thứ ba
  (Fern) nói policy cho repo riêng tư chỉ hiệu lực 7 ngày tới lần đăng nhập đầu, và policy theo tài khoản (không cần bản
  giữ chỗ như npm) — chưa kiểm ở nguồn gốc.
- `CHANGELOG.md`: mục .NET riêng; mỗi bản ghi bản đạt bộ mẫu `conformance/` ở commit nào.

### CI và mutation

- `ci-dotnet` build/test thêm hai project mới (Ubuntu + Windows; BankLogos test cả `net481` trên Windows).
- Mutation (Stryker.NET, ngưỡng 90) cho `TingQR.AspNetCore` và `TingQR.BankLogos`, mỗi gói một cấu hình, chạy từ thư mục
  test của chính nó (bài học Core); thêm vào matrix của `mutation-dotnet.yml`.
- Cập nhật: spec chung 5.6 (bỏ "v0.2", trỏ về tài liệu này), 5.8 (số phiên bản riêng), `CLAUDE.md`, `dotnet/CLAUDE.md`.

## Đã đổi hay chốt khi làm (Plan 8c, 2026-11-24)

Ghi lại để spec không nói khác code. Chi tiết cho người dùng ở `dotnet/src/TingQR.AspNetCore/README.md`, cho hợp đồng ở
`conformance/README.md` (mục "`TingQR.AspNetCore` và hợp đồng HTTP").

- **Tên:** `TingQrResults` thành `TingQrHttpResults`; lớp `BankLogos` nằm trong namespace `TingQR` (gói vẫn là
  `TingQR.BankLogos`); các tên khác theo bảng đã duyệt `2026-11-24-dotnet-api-names.md`.
- **`[TingQrSvg]` gần nhất thắng cả khối** (xem mục MVC ở trên).
- **`TingQrHttpResults.Svg` không bao giờ ném**, kể cả khi tuỳ chọn sai: kiểm (`CheckSvgOptions`, logo `data:image/`)
  chạy lúc thực thi, lỗi thành 500 theo hợp đồng. Dòng "`TingQrResults`… kiểm ngay khi gọi" ở mục "Kiểm tuỳ chọn khi
  cấu hình" chỉ đúng với `WithTingQrSvg`.
- **SVG luôn `200`:** ASP.NET Core không có cơ chế tương đương `@HttpCode`, nên không có status nào để giữ.
- **`CacheControl` `null`, rỗng hay chỉ khoảng trắng** (tham số, attribute, `TingQrOptions`) → dùng mức tiếp theo, cuối
  cùng là `private, max-age=300`; không kiểm lúc khởi động vì không có giá trị nào sai.
- **Chỉ giá trị action trả về là chuỗi QR:** `BadRequest("…")`, `Ok("…")`, `StatusCode(409, "…")`, `NotFound()`,
  `NoContent()`, `EmptyResult`… từ action `[TingQrSvg]` → `InvalidOperationException`. Ngoại lệ mà bộ lọc khác đã xử lý,
  và kết quả bộ lọc khác đặt trước khi action chạy, đi qua nguyên vẹn.
- **`TingQrSvgAttribute` là `Attribute, IFilterFactory, IControllerModelConvention, IActionModelConvention`** (hai giao
  diện convention MVC công khai). Lý do: không có `AddTingQr` thì không có hosted service nào quét được lúc khởi động;
  convention là cách duy nhất để `[TingQrSvg("x")]` thiếu `AddTingQr` làm app dừng, và nó ném ngay ở
  `app.MapControllers()` (đo trong test), trước `StartAsync`. Có `AddTingQr` thì hosted service kiểm tên profile qua
  `FilterDescriptors` của mọi action (gồm cả bộ lọc toàn cục). Bộ lọc toàn cục `TingQrSvgAttribute("x")` không có
  `AddTingQr` thì không thấy được lúc khởi động: mỗi request của nó là 500.

## Để builder quyết

- Tên chính xác của kiểu/phương thức (qua bước rà tên), category log, cách quét `[TingQrSvg]` lúc khởi động, cách
  `PaymentQr` báo khi chưa cấu hình tài khoản, icon gói, skill diễn tập riêng hay chung, cấu trúc thư mục test.

## Cần chủ dự án (ngoài plan)

- Duyệt danh sách đổi tên.
- Tạo tài khoản nuget.org, giữ tiền tố `TingQR`, tạo trusted publishing policy và environment `nuget-release` khi quyết
  phát hành.
