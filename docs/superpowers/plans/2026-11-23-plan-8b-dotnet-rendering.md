# Plan 8b: TingQR.Rendering (.NET) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TingQR.Rendering` (C#) vẽ QR giống hệt `@tingqr/render`: cùng ma trận và cùng chuỗi SVG với cùng đầu vào.

**Architecture:** Port từng dòng `ts/packages/render/src/qrcodegen.ts` (Nayuki v1.8.0 trong repo) thành mã C# `internal`, rồi port `matrix.ts`, `color.ts`, `logo.ts`, `layout.ts`, `svg.ts` lên trên. Mẫu ma trận có sẵn (oracle Nayuki gốc) bảo đảm bộ mã hoá; mẫu SVG mới (đầu ra của bản TS, ghi rõ là mẫu vàng) bảo đảm phần trình bày. Lỗi dùng `TingQrException` của `TingQR.Core`.

**Tech Stack:** C#, .NET SDK 10, `net10.0` + `netstandard2.0`, xUnit, System.Text.Json (test), Stryker.NET, Node (script sinh mẫu SVG), TypeScript/vitest (bộ chạy mẫu bên TS).

**Spec:** `docs/superpowers/specs/2026-11-23-tingqr-dotnet-rendering-design.md`

## Global Constraints

- Nhánh `plan-8b`. Lệnh chạy từ gốc repo `F:\Projects\MyProjects\tingqr`.
- `TingQR.Rendering`: `<TargetFrameworks>net10.0;netstandard2.0</TargetFrameworks>`, `ProjectReference` tới `TingQR.Core`, **không** `PackageReference` lúc chạy. Test: `net10.0`, thêm `net481` trên Windows (như `TingQR.Core.Tests`).
- Không bọc thư viện QR khác. File port Nayuki giữ nguyên header giấy phép MIT và danh sách thay đổi của tingqr; ghi công trong `dotnet/src/TingQR.Rendering/NOTICE`.
- Ma trận và chuỗi SVG phải giống hệt bản TS với cùng đầu vào. Mọi số viết theo `CultureInfo.InvariantCulture`; số thực (`size`) viết đúng như JS `String(n)`; tính tương phản bằng `double`, cùng công thức và thứ tự phép tính như `color.ts`.
- Lỗi: `TingQrException` mã `INVALID_VALUE`. `text` là `null`: `INVALID_VALUE`. Tuỳ chọn `null`: mặc định.
- Không sửa mẫu có sẵn trong `conformance/vectors/render/`. Mẫu SVG mới chỉ sinh bằng script, không viết tay.
- File port Nayuki không chạy mutation; phần còn lại Stryker.NET ngưỡng 90%, luật `disable` như `dotnet/CLAUDE.md`.
- Quy ước C#/build như `dotnet/CLAUDE.md` (InvariantCulture, không ImplicitUsings ở `netstandard2.0`/`net481`, TreatWarningsAsErrors, XML doc cho mọi thành viên public, phiên bản gói ghim ở `dotnet/Directory.Packages.props`).
- Sửa file có dấu `\` bằng Edit/Write, không bằng `sed`/heredoc/`node -e`/Python heredoc.
- Tài liệu tiếng Việt; code, API, thông báo lỗi tiếng Anh.

## Review Focus

1. **Văn bản dài sát giới hạn phiên bản** (ví dụ 2 953 byte ở ECC L): ra đúng phiên bản 40 hoặc `INVALID_VALUE` "too long", không ném `ArgumentException`/`IndexOutOfRange` từ bộ mã hoá. Task 2 test cả sát dưới và vượt.
2. **Máy có văn hoá `de-DE`/`tr-TR`**: SVG giống hệt InvariantCulture (dấu thập phân của `size`, chữ thường/hoa hex màu). Task 4 test.
3. **Màu viết hoa/thường và dạng ngắn** (`#FFF`, `#ffffff`, `#Ffffff`): cùng chấp nhận/từ chối và cùng chuỗi `fill` như TS. Task 3 test.
4. **Ma trận không bị sửa từ ngoài**: `QrMatrix.Modules` không ghi được qua ép kiểu. Task 2 test.
5. **Gọi đồng thời từ nhiều luồng** (`ToSvg` trên máy chủ): không có trạng thái tĩnh ghi được; một test chạy song song 8 luồng cho kết quả giống chạy tuần tự. Task 4 test.

---

### Task 1: Khung `TingQR.Rendering`

**Files:**
- Create: `dotnet/src/TingQR.Rendering/TingQR.Rendering.csproj`, `dotnet/src/TingQR.Rendering/NOTICE`, `dotnet/tests/TingQR.Rendering.Tests/TingQR.Rendering.Tests.csproj`, `dotnet/tests/TingQR.Rendering.Tests/SmokeTests.cs`, `dotnet/tests/TingQR.Rendering.Tests/ConformanceRoot.cs`
- Modify: `dotnet/TingQR.slnx`, `dotnet/CLAUDE.md`, `docs/superpowers/specs/2026-11-18-tingqr-design.md` (5.6: dòng "port từ `manuelbl/QrCodeGenerator`" → port từ `qrcodegen.ts` trong repo, chủ dự án chọn 2026-11-23)

**Interfaces:**
- Produces: assembly `TingQR.Rendering`, `RootNamespace=TingQR.Rendering`, `PackageId=TingQR.Rendering`, `Version=0.0.0`, `InternalsVisibleTo TingQR.Rendering.Tests`; test project tham chiếu cả Core và Rendering; `ConformanceRoot.Path` như bản của Core (chép, không tham chiếu project test khác).
- [ ] **Step 1: Test** `SmokeTests.RenderingReferencesCore` (một kiểu public của Rendering, ví dụ hằng `TingQrRender.Version`… nếu chưa có thì `typeof(TingQR.Rendering.TingQrRender)` ở Task 2; ở task này test `ConformanceRootFindsRenderVectors`: thư mục `vectors/render` có ≥ 27 file `.json`).
- [ ] **Step 2:** `dotnet test dotnet/TingQR.slnx` → FAIL (chưa có project). **Step 3:** tạo hai project, thêm vào `.slnx`. **Step 4:** PASS trên `net10.0` và `net481`.
- [ ] **Step 5:** `dotnet/CLAUDE.md`: thêm mục `TingQR.Rendering` (đường dẫn, phụ thuộc Core, file port không mutation). Sửa spec chung 5.6.
- [ ] **Step 6: Commit** `build(dotnet): TingQR.Rendering skeleton`

### Task 2: Port bộ mã hoá Nayuki, `ToMatrix`, bộ chạy mẫu ma trận

**Files:**
- Create: `dotnet/src/TingQR.Rendering/QrCodeGen.cs` (port của `qrcodegen.ts`), `dotnet/src/TingQR.Rendering/Ecc.cs`, `MatrixOptions.cs`, `QrMatrix.cs`, `TingQrRender.cs`
- Create: `dotnet/tests/TingQR.Rendering.Tests/MatrixConformanceTests.cs`, `MatrixTests.cs`

**Interfaces:**
- Produces:
  - `public enum Ecc { L, M, Q, H }`
  - `public sealed record MatrixOptions { public Ecc? Ecc { get; init; } public bool? BoostEcc { get; init; } public int? MinVersion { get; init; } public int? MaxVersion { get; init; } public int? Mask { get; init; } }` (record có thể kế thừa ở Task 4; nếu `sealed` cản kế thừa thì bỏ `sealed`)
  - `public sealed class QrMatrix { public int Size { get; } public int Version { get; } public Ecc Ecc { get; } public int Mask { get; } public bool IsDark(int x, int y); public IReadOnlyList<IReadOnlyList<bool>> Modules { get; } }` — bất biến.
  - `public static partial class TingQrRender { public static QrMatrix ToMatrix(string? text, MatrixOptions? options = null); }` — mặc định và luật như `matrix.ts`: ecc `M`, boostEcc `true`, minVersion 1, maxVersion 40, mask -1 (tự chọn); số nguyên trong khoảng; min > max lỗi; surrogate lẻ lỗi; quá dài lỗi "too long".
  - `QrCodeGen.cs`: `internal` toàn bộ; dịch từng hàm của `qrcodegen.ts` giữ tên (PascalCase) và thứ tự; giữ header MIT, thêm đầu file danh sách thay đổi của bản C# (dịch sang C#, `internal`, các thay đổi tingqr 1–6 của bản TS giữ nguyên ý). Chế độ byte mã hoá UTF-8 (JS dùng `encodeURI`; C# dùng `UTF8Encoding` với surrogate lẻ đã bị chặn trước).
- [ ] **Step 1: Test** `MatrixConformanceTests`: `[Theory]` trên mọi file trong `conformance/vectors/render/` có `kind` `matrix` hoặc (`encode-invalid` **và không có** trường `"render": "svg"`); luật như `ts/packages/render/test/matrix-conformance.spec.ts` (so `size, version, ecc, mask` và `rows` chuỗi `1/0`; lỗi: `TingQrException` đúng `error`). `RunnerSeesEveryMatrixVector`: số mẫu chạy = số file matrix + render-invalid, ≥ 27. `MatrixTests`: `NullTextIsInvalidValue`; `LongestByteTextAtEccLFitsVersion40` (2 953 byte ASCII không thuộc chế độ chữ-số, ví dụ chữ thường) → version 40; một byte nữa → `INVALID_VALUE`; `ModulesAreReadOnly` (ép `Modules` sang `bool[][]`/`IList<…>` rồi gán → không được hoặc ném).
- [ ] **Step 2:** FAIL. **Step 3:** port + `ToMatrix`. **Step 4:** 27 mẫu đạt trên cả hai khung đích.
- [ ] **Step 5: Commit** `feat(dotnet): port the Nayuki encoder; ToMatrix passes the matrix vectors`

### Task 3: Màu, logo, bố cục

**Files:**
- Create: `dotnet/src/TingQR.Rendering/Color.cs`, `LogoOptions.cs`, `Logo.cs`, `Layout.cs`
- Test: `dotnet/tests/TingQR.Rendering.Tests/ColorTests.cs`, `LogoTests.cs`, `LayoutTests.cs`

**Interfaces:**
- Consumes: Task 2.
- Produces: `public sealed record LogoOptions { public required string Href { get; init; } public double? Size { get; init; } public int? Padding { get; init; } public string? Background { get; init; } }`; `internal` `Color.ParseHex`, `Color.Luminance`, `Color.ContrastRatio`, `Logo.Box`, `Logo.CheckBox`, `Logo.CheckHref`, `Layout.Compute`/`CheckOptions` — luật, hằng (`MAX_CLEARED_SHARE = 0.1`, `MIN_CLEAR_START = 9`, `MIN_CONTRAST = 4.5`, logo size `(0, 0.25]` mặc định 0.2, padding 0–4 mặc định 1, margin 0–16 mặc định 4) và thông báo đúng như `color.ts`, `logo.ts`, `layout.ts`.
- [ ] **Step 1: Test:** port các ca của `ts/packages/render/test/color.spec.ts`, `logo.spec.ts`, `layout.spec.ts` cùng giá trị. Thêm `HexCaseAndShortForm` (Review Focus 3): `#FFF`, `#fff`, `#ffffff`, `#FfFfFf` cùng kết quả như TS (đọc `color.ts` để biết TS nhận dạng ngắn hay không; test theo đúng TS). Thêm `ContrastAtThreshold`: một cặp màu cho tỉ lệ ngay trên 4.5 và một cặp ngay dưới (tính bằng TS: chạy `node` với `dist` của `@tingqr/render` để lấy tỉ lệ thật; ghi giá trị vào comment) → đạt/không đạt như TS.
- [ ] **Step 2:** FAIL. **Step 3:** port. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(dotnet): colours, logo box and layout checks`

### Task 4: Mẫu SVG (bên TS trước)

**Files:**
- Create: `conformance/tools/render/gen-svg.mjs`, `conformance/tools/render/svg-cases.mjs` (danh sách ca), `conformance/vectors/render/render-svg-*.json` (sinh)
- Modify: `conformance/vectors.schema.json`, `conformance/README.md` (mục mới "Mẫu SVG"), `ts/packages/render/test/matrix-conformance.spec.ts` (hoặc file mới `svg-conformance.spec.ts`), `ts/packages/core/test/conformance.spec.ts` chỉ nếu bộ lọc `scheme !== 'render'` cần đổi (không nên)

**Interfaces:**
- Produces (định dạng mẫu, cả hai bộ chạy dùng):
  - Mẫu SVG đạt: `{ "id": "render-svg-…", "scheme": "render", "kind": "svg", "input": { "text": …, <các tuỳ chọn SvgOptions trải phẳng như mẫu ma trận: margin, foreground, background, size, ecc, boostEcc, minVersion, maxVersion, mask, logo: { href, size, padding, background }> }, "expected": { "svg": "<svg …>" }, "source": "…", "note": "…" }`.
  - Mẫu lỗi tuỳ chọn SVG: `{ "kind": "encode-invalid", "scheme": "render", "render": "svg", "input": {…}, "error": "INVALID_VALUE" }` — bộ chạy gọi `toSvg`; mẫu `encode-invalid` không có `"render": "svg"` vẫn gọi `toMatrix`.
  - `source` của mọi mẫu sinh: `"@tingqr/render toSvg (TypeScript) at <commit>; golden output so the two implementations agree, not an independent oracle (the matrix is pinned by the Nayuki matrix vectors)"`.
- [ ] **Step 1:** Viết `svg-cases.mjs` phủ: mặc định; margin 0 và 16; foreground/background tuỳ chọn (hex 6 chữ hoa và thường); `background: "transparent"`; `size` số nguyên, số không nguyên (`100.5`, `0.1`) và chuỗi (`"40mm"`, `"100%"`); logo (`size` 0.2 và 0.25, `padding` 0 và 4, `background` riêng và `transparent`); ecc L/M/Q/H; văn bản Khmer và emoji; tương phản sát ngưỡng (đạt); và lỗi: margin -1/17/1.5, foreground sáng hơn nền, tương phản dưới ngưỡng, `size` 0/âm/`"10furlongs"`, logo size 0/0.3, padding 5, logo href không phải data URI nếu `toSvg` chặn (xem `logo.ts`), logo với ecc L.
- [ ] **Step 2:** `gen-svg.mjs`: build `@tingqr/render` (hoặc đọc `ts/packages/render/dist`), ghi mỗi ca một file; `--check` thoát 1 nếu file lệch (như `sync-dotnet.mjs`). Test Node `conformance/tools/render/test/gen-svg.test.mjs`: sinh từ hai ca giả ra đúng JSON; `--check` thoát 1 trên bản sửa.
- [ ] **Step 3:** Schema: thêm kind `svg` (bắt buộc `input`, `expected.svg`, không `payload`), trường `render` (`"svg"`). README mục "Mẫu SVG" (định dạng, luật chọn hàm, nguồn là mẫu vàng).
- [ ] **Step 4: Test (TS):** bộ chạy render chạy mẫu `svg` (`toSvg(text, options)` bằng đúng `expected.svg`) và mẫu lỗi SVG; chạy `pnpm -C ts/packages/render test` → PASS (mẫu vừa sinh từ chính TS). Bộ chạy core vẫn bỏ qua `render`.
- [ ] **Step 5: Commit** `test(conformance): SVG golden vectors from @tingqr/render`

### Task 5: `ToSvg`, `CheckSvgOptions`

**Files:**
- Create: `dotnet/src/TingQR.Rendering/SvgOptions.cs`, `Svg.cs`, `JsNumber.cs`
- Test: `dotnet/tests/TingQR.Rendering.Tests/SvgConformanceTests.cs`, `SvgTests.cs`, `JsNumberTests.cs`

**Interfaces:**
- Consumes: Task 2–4.
- Produces:
  - `public sealed record SvgOptions { …mọi trường của MatrixOptions… public int? Margin { get; init; } public string? Foreground { get; init; } public string? Background { get; init; } public SvgSize? Size { get; init; } public LogoOptions? Logo { get; init; } }` (chép trường hay kế thừa `MatrixOptions` — builder chọn, ghi lý do).
  - `public readonly struct SvgSize` tạo từ `double` hoặc `string` (implicit), như `size?: number | string` của TS.
  - `TingQrRender.ToSvg(string? text, SvgOptions? options = null) → string`, `TingQrRender.CheckSvgOptions(SvgOptions? options) → void` — đúng như `svg.ts` (thứ tự kiểm: margin, màu, size, rồi bố cục; `CheckSvgOptions` không cần văn bản).
  - `internal static class JsNumber { public static string ToString(double value); }` — đúng `String(n)` của JS cho mọi `double` hữu hạn (dạng ngắn nhất khứ hồi; mũ khi `|n| ≥ 1e21` hoặc `< 1e-6` theo đúng quy tắc ECMAScript Number::toString, chữ `e` thường, dấu `+`), không dùng `double.ToString("R")`.
- [ ] **Step 1: Test:** `SvgConformanceTests` chạy mọi mẫu `kind: "svg"` (so chuỗi) và mẫu lỗi có `"render": "svg"`; đếm khớp số file. `JsNumberTests`: `0`, `-0` → `"0"`, `100.5`, `0.1`, `1/3`, `1e21`, `1e-7`, `123456789012345680000` (so với giá trị in bởi `node -e` — ghi lệnh trong comment). `SvgTests`: `SameUnderGermanAndTurkishCulture` (Review Focus 2); `NullTextIsInvalidValue`; `NullOptionsIsDefault`; `ParallelCallsAgree` (Review Focus 5: 8 luồng × 50 lần `ToSvg` với logo bằng kết quả tuần tự); port các ca của `ts/packages/render/test/svg.spec.ts` không có trong mẫu.
- [ ] **Step 2:** FAIL. **Step 3:** port `svg.ts` + `JsNumber`. **Step 4:** mọi mẫu SVG đạt trên `net10.0` và `net481`.
- [ ] **Step 5: Commit** `feat(dotnet): ToSvg and CheckSvgOptions match @tingqr/render byte for byte`

### Task 6: Mutation cho `TingQR.Rendering`

**Files:**
- Create: `dotnet/stryker-config.rendering.json` (hoặc mở rộng `dotnet/stryker-config.json` nếu Stryker.NET 5.1 chạy được nhiều project trong một cấu hình)
- Modify: `.github/workflows/mutation-dotnet.yml`, `dotnet/CLAUDE.md`

**Interfaces:**
- Produces: Stryker.NET trên `TingQR.Rendering`, `thresholds.break = 90`, loại `QrCodeGen.cs`. Workflow chạy cả Core và Rendering (hai bước hay hai job), fail nếu một trong hai dưới ngưỡng.
- [ ] **Step 1:** chạy Stryker trên Rendering; ghi điểm.
- [ ] **Step 2:** đột biến sống sót: viết test giết; chỉ `disable once <Kind> : <lý do>` cho đột biến tương đương duy nhất trên dòng (tách dòng nếu cần, như `dotnet/CLAUDE.md`); chuỗi thông báo lỗi: `disable once String : error message`.
- [ ] **Step 3:** cập nhật workflow và `dotnet/CLAUDE.md`. Chạy lại cả Core để chắc không đổi.
- [ ] **Step 4: Commit** `test(dotnet): Stryker.NET for TingQR.Rendering at 90%`

### Task 7: Tài liệu, kiểm toàn bộ

**Files:**
- Create: `dotnet/src/TingQR.Rendering/README.md`
- Modify: `CLAUDE.md`, `CHANGELOG.md`, `dotnet/src/TingQR.Core/README.md` (dòng "rendering comes later")

- [ ] **Step 1:** README của gói: cách dùng (đoạn mã biên dịch được — kiểm bằng một project nháp ngoài repo), bảng TS ↔ .NET đúng tên thật, giới hạn (không PNG; C# 9+ để tạo tuỳ chọn trên .NET Framework; chỉ bảo đảm khớp TS trên mẫu), ghi công Nayuki.
- [ ] **Step 2:** `CLAUDE.md` dòng Plan 8b (nhánh, plan, spec, đã làm, chưa kiểm). `CHANGELOG.md` mục .NET. README Core sửa dòng "rendering comes later".
- [ ] **Step 3:** `pnpm test:all && pnpm build:all && pnpm typecheck:all` → PASS, ghi số test từng phần; `node conformance/tools/render/gen-svg.mjs --check` → 0; `node --test conformance/tools/render/test/gen-svg.test.mjs` → PASS.
- [ ] **Step 4: Commit** `docs: Plan 8b status`
