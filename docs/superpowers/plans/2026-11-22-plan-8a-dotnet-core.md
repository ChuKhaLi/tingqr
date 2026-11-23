# Plan 8a: TingQR.Core (.NET) và bộ chạy mẫu thử — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TingQR.Core` (C#) làm được mọi thứ `@tingqr/core` làm và đạt mọi mẫu thử không thuộc phần vẽ trong `conformance/vectors/`.

**Architecture:** Port tay từng module của `ts/packages/core/src/` sang C#, cùng cấu trúc (EMV → từng loại QR → detect → banks). Một bộ chạy xUnit đọc `conformance/vectors/` và so kết quả qua JSON (tên camelCase, bỏ trường null) với `expected`, nên kiểu C# phải tuần tự hoá ra đúng hình dạng JSON của bản TS. Dữ liệu ngân hàng sinh từ `conformance/banks/` bằng script mới.

**Tech Stack:** C# (LangVersion latest, nullable), .NET SDK 10, `net10.0` + `netstandard2.0`, xUnit, System.Text.Json (chỉ trong test), Stryker.NET, GitHub Actions, Node (script sinh dữ liệu).

**Spec:** `docs/superpowers/specs/2026-11-22-tingqr-dotnet-core-design.md` (và spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md`).

## Global Constraints

- Nhánh `plan-8a`. Lệnh chạy từ gốc repo `F:\Projects\MyProjects\tingqr` trừ khi ghi khác.
- `TingQR.Core`: `<TargetFrameworks>net10.0;netstandard2.0</TargetFrameworks>`, **không** `PackageReference` lúc chạy. Polyfill (ví dụ `IsExternalInit`) viết trong mã nguồn, `internal`. Nếu `netstandard2.0` buộc phải thêm gói lúc chạy thì bỏ `netstandard2.0` và ghi `Ruling:`.
- Mọi phép so sánh, đổi hoa/thường, định dạng số dùng `CultureInfo.InvariantCulture`/`StringComparison.Ordinal`.
- Độ dài chữ đếm theo code point (cặp surrogate tính 1); CRC tính trên byte UTF-8.
- Mã lỗi, mã cảnh báo đúng `conformance/errors.json` (kể cả `LOGO_LOAD_FAILED`, `CANVAS_TAINTED`, `NO_CANVAS`: khai báo, không ném).
- `Encode`/hàm tạo ném `TingQrException`; `Decode`/`Detect` trả `TingQrResult<T>`, không ném với dữ liệu xấu, kể cả `null`.
- Đầu vào `null` của hàm tạo: `TingQrException` `INVALID_VALUE`, không tag; không bao giờ `ArgumentNullException`.
- Thông báo lỗi tiếng Anh, cùng ý bản TS, không bắt buộc giống từng chữ.
- Không sửa nội dung mẫu thử trong `conformance/vectors/` để .NET dễ đạt.
- `dotnet/src/TingQR.Core/Banks/BankData.g.cs` là file sinh; không sửa tay.
- Sửa file có dấu `\` bằng Edit/Write, không bằng `sed`/heredoc/`node -e`.
- Tài liệu tiếng Việt; code, API, thông báo lỗi tiếng Anh.

## Review Focus

1. **Máy có văn hoá khác (`tr-TR`, `de-DE`)**: `Encode` và `Decode` cho kết quả giống hệt văn hoá bất biến (chữ `i`/`I`, dấu thập phân). Task 5 và Task 7 test dưới `tr-TR` và `de-DE`.
2. **Tên KHQR có emoji hoặc chữ Khmer dài đúng 25 ký tự**: nhận; 26 ký tự: `INVALID_VALUE`, dù `string.Length` lớn hơn. Task 8 test cả emoji (cặp surrogate).
3. **`Decode`/`Detect` nhận `null` hoặc `""`**: trả kết quả lỗi, không ném. Task 5, 6, 7, 8, 9 mỗi hàm đọc một test.
4. **Bản `netstandard2.0` thật sự chạy được**: test chạy thêm trên `net481` ở Windows (Task 1), vì `net10.0` không đụng tới bản `netstandard2.0`.
5. **Danh sách ngân hàng không bị sửa từ ngoài**: `Banks.All`, `BankApps.All` là `IReadOnlyList` của kiểu bất biến; ép kiểu sang mảng rồi gán không đổi được dữ liệu dùng chung. Task 10.

---

### Task 1: Khung `dotnet/`, CI, lệnh gốc

**Files:**
- Create: `dotnet/TingQR.slnx` (hoặc `.sln` nếu SDK 10 không tạo `.slnx`), `dotnet/Directory.Build.props`, `dotnet/src/TingQR.Core/TingQR.Core.csproj`, `dotnet/src/TingQR.Core/TingQrVersion.cs`, `dotnet/src/TingQR.Core/Polyfills.cs`, `dotnet/tests/TingQR.Core.Tests/TingQR.Core.Tests.csproj`, `dotnet/tests/TingQR.Core.Tests/SmokeTests.cs`, `dotnet/tests/TingQR.Core.Tests/ConformanceRoot.cs`, `dotnet/CLAUDE.md`, `.github/workflows/ci-dotnet.yml`
- Modify: `package.json` (gốc), `.gitignore`

**Interfaces:**
- Produces: `public static class TingQrVersion { public const string Value = "0.0.0"; }`; `internal static class ConformanceRoot { public static string Path { get; } }` (thư mục `conformance/`, tìm bằng cách đi ngược từ `AppContext.BaseDirectory` tới thư mục có `conformance/errors.json`).

- [ ] **Step 1:** Kiểm ngày hết hỗ trợ của .NET 8 trên trang chính thức (https://dotnet.microsoft.com/platform/support/policy/dotnet-core). Ghi kết quả (ngày, đường dẫn) vào `dotnet/CLAUDE.md`. Nếu .NET 8 còn hỗ trợ thì ghi `Ruling:` và hỏi lại chủ dự án có thêm `net8.0` không; không tự thêm.
- [ ] **Step 2: Test** `SmokeTests`: `VersionMatchesTypeScript` — đọc `ts/packages/core/src/index.ts` qua `ConformanceRoot.Path` + `../ts/...`, lấy chuỗi trong `export const VERSION = '...'`, `Assert.Equal(it, TingQrVersion.Value)`. `ConformanceRootFindsErrorsJson` — `File.Exists(Path.Combine(ConformanceRoot.Path, "errors.json"))`.
- [ ] **Step 3:** `dotnet test dotnet/TingQR.slnx` → FAIL (chưa có project/kiểu).
- [ ] **Step 4:** Tạo solution và hai project.
  - `Directory.Build.props`: `Nullable=enable`, `LangVersion=latest`, `TreatWarningsAsErrors=true`, `ImplicitUsings=enable` (chỉ cho `net10.0`; `netstandard2.0` thì tự `using`), `Deterministic=true`.
  - Core: `TargetFrameworks` như Global Constraints, `RootNamespace=TingQR`, `PackageId=TingQR.Core`, `Version=0.0.0`, `IsPackable=true` (chưa phát hành), `GenerateDocumentationFile=true`.
  - Tests: `TargetFrameworks` = `net10.0`, thêm `net481` khi `'$(OS)' == 'Windows_NT'`; xUnit + `Microsoft.NET.Test.Sdk` + `xunit.runner.visualstudio`; `System.Text.Json` cho `net481`. Chép `conformance/` không cần: đọc tại chỗ qua `ConformanceRoot`.
- [ ] **Step 5:** `dotnet test dotnet/TingQR.slnx` → PASS (2 test × số khung đích).
- [ ] **Step 6:** `package.json` gốc: `test:all` = `pnpm -C ts test && dotnet test dotnet/TingQR.slnx`, `build:all` = `pnpm -C ts build && dotnet build dotnet/TingQR.slnx -c Release`, `typecheck:all` giữ phần TS và thêm `dotnet build dotnet/TingQR.slnx` (C# kiểm kiểu khi build). `.gitignore`: `dotnet/**/bin/`, `dotnet/**/obj/`, `dotnet/**/StrykerOutput/`.
- [ ] **Step 7:** `ci-dotnet.yml`: `on.push`/`pull_request` với `paths: ['dotnet/**', 'conformance/**', '.github/workflows/ci-dotnet.yml']`, ma trận `ubuntu-latest`, `windows-latest`, `actions/setup-dotnet` (`dotnet-version: 10.0.x`), `dotnet build -c Release`, `dotnet test -c Release`. Kiểm `ci-ts.yml` đã có `conformance/**` trong `paths`; chưa có thì thêm.
- [ ] **Step 8:** `dotnet/CLAUDE.md`: lệnh (`dotnet build/test dotnet/TingQR.slnx`), khung đích và lý do, quy ước (InvariantCulture, đếm code point, không dependency), file sinh `BankData.g.cs`, mutation (Task 11). Thêm dòng trỏ tới nó trong `CLAUDE.md` gốc mục "Lệnh".
- [ ] **Step 9:** `pnpm test:all` → PASS cả hai phần.
- [ ] **Step 10: Commit** `build(dotnet): TingQR.Core skeleton, test project, ci-dotnet`

### Task 2: Lỗi, cảnh báo, kết quả

**Files:**
- Create: `dotnet/src/TingQR.Core/TingQrErrorCode.cs`, `TingQrWarningCode.cs`, `TingQrException.cs`, `TingQrWarning.cs`, `TingQrResult.cs`, `WireNames.cs`, `Emv/TlvNode.cs`
- Test: `dotnet/tests/TingQR.Core.Tests/ErrorCodeTests.cs`

**Interfaces:**
- Produces:
  - `public enum TingQrErrorCode { CrcMissing, CrcMismatch, BadTag, BadLength, Truncated, FieldTooLong, NonAscii, DuplicateTag, MissingTag, InvalidValue, UnsupportedScheme, UnknownScheme, LogoLoadFailed, CanvasTainted, NoCanvas }`
  - `public enum TingQrWarningCode { TrimmedWhitespace, MissingOptionalTag, LowercaseCrc }`
  - `public static class WireNames { public static string Of(TingQrErrorCode c); public static string Of(TingQrWarningCode c); }` → `"CRC_MISSING"`… (tên trong `errors.json`).
  - `public sealed class TingQrException : Exception { public TingQrErrorCode Code { get; } public string? Tag { get; } public IReadOnlyList<TlvNode>? Fields { get; } public TingQrException(TingQrErrorCode code, string message, string? tag = null, IReadOnlyList<TlvNode>? fields = null) }`
  - `public sealed record TingQrWarning(TingQrWarningCode Code, string Message, string? Tag = null)`
  - `public sealed class TingQrResult<T> { public bool Ok { get; } public T? Value { get; } public IReadOnlyList<TingQrWarning> Warnings { get; } public TingQrException? Error { get; } public static TingQrResult<T> Success(T value, IReadOnlyList<TingQrWarning> warnings); public static TingQrResult<T> Failure(TingQrException error); }`
  - `namespace TingQR.Emv` (file `Emv/TlvNode.cs`, đặt ở task này vì `TingQrException.Fields` cần): `public record TlvField(string Tag, string Value)`, `public sealed record TlvNode(string Tag, string Value, IReadOnlyList<TlvNode>? Children = null) : TlvField(Tag, Value)` (như `TlvNode` TS: `children?`).

- [ ] **Step 1: Test** `ErrorCodeTests`: `ErrorCodesMatchErrorsJson` — đọc `errors.json`, danh sách `errors[].code` theo thứ tự `==` `Enum.GetValues<TingQrErrorCode>().Select(WireNames.Of)`; `WarningCodesMatchErrorsJson` tương tự cho `warnings`; `ResultSuccessHasNoError`, `ResultFailureHasNoValue`.
- [ ] **Step 2:** `dotnet test` → FAIL. **Step 3:** viết các kiểu. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(dotnet): error and warning codes, TingQrException, TingQrResult`

### Task 3: Tầng EMV và bỏ dấu tiếng Việt

**Files:**
- Create: `dotnet/src/TingQR.Core/Emv/Crc16.cs`, `Emv/Tlv.cs`, `Emv/EmvPayload.cs`, `Emv/ParseMode.cs`, `Emv/Fields.cs`, `Text/CodePoints.cs`, `Text/VietnameseText.cs`
- Test: `dotnet/tests/TingQR.Core.Tests/Emv/CrcTests.cs`, `TlvTests.cs`, `PayloadTests.cs`, `TextTests.cs`

**Interfaces:**
- Consumes: Task 2.
- Produces (ý nghĩa đúng như `ts/packages/core/src/emv/*.ts`, `text.ts`):
  - `public static class Crc16 { public static string Compute(string input); }` (4 chữ hex hoa, trên byte UTF-8)
  - `public static class Tlv { public static string Field(string tag, string value); public static string EncodeFields(IEnumerable<TlvField> fields); public static IReadOnlyList<TlvNode> Parse(string input); public static IReadOnlyList<TlvNode> ParseTemplate(string value, string? path = null); internal static void AssertUniqueTags(IEnumerable<TlvField> nodes, string? path = null); }`
  - `public enum ParseMode { Lenient, Strict }`
  - `public sealed class EmvPayload { public IReadOnlyList<TlvNode> Fields { get; } … }` (đủ trường như `EmvPayload` TS) và `public static class EmvPayloads { public static string Build(IEnumerable<TlvField> fields); public static TlvNode? GetField(EmvPayload p, string tag); public static TingQrResult<EmvPayload> Parse(string? input); }`
  - `internal static class Fields { ReadAdditionalData, ReadExtraFields, ReadSchemeTemplate }` như `emv/fields.ts`
  - `internal static class CodePoints { public static int Count(string s); }`
  - `public static class VietnameseText { public static string RemoveAccents(string s); }`
- [ ] **Step 1: Test:** port các ca của `ts/packages/core/test/crc.spec.ts`, `tlv.spec.ts`, `payload.spec.ts`, `text.spec.ts` (mỗi `test` TS thành một `[Fact]`/`[Theory]` cùng giá trị). Thêm `ParseNullIsInvalidValue`: `EmvPayloads.Parse(null)` → `Ok == false`, `Error.Code == InvalidValue`. Thêm `CodePointsCountsSurrogatePairAsOne`: `CodePoints.Count("a😀") == 2`, `CodePoints.Count("ចន ស្មីន") == 8`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(dotnet): EMV layer (CRC, TLV, payload), code points, Vietnamese accents`

### Task 4: Luật chung mới trong `conformance/` và bản TS

**Files:**
- Modify: `conformance/README.md`, `ts/packages/core/src/schemes/vietqr/decode.ts`, `vnpay/decode.ts`, `promptpay/decode.ts`, `khqr/decode.ts`, `ts/packages/core/src/detect.ts`, `ts/packages/core/src/emv/payload.ts` (nếu kiểm chung đặt ở `parsePayload`)
- Test: `ts/packages/core/test/payload.spec.ts` (hoặc từng `*-decode.spec.ts`), `detect.spec.ts`

**Interfaces:**
- Produces (luật chung, cả hai bản):
  - **Hàm đọc nhận thứ không phải chuỗi** (`null`, `undefined`, số…): kết quả lỗi `INVALID_VALUE`, không tag, không ném.
  - **Mẫu kiểm kiểu:** mẫu có trường mang kiểu JSON khác kiểu mà bản có kiểu tĩnh khai báo. Bản có kiểu tĩnh kiểm rằng giá trị không chuyển được sang kiểu đó; `errorTag` chỉ áp dụng cho bản không có kiểu tĩnh. Danh sách hiện tại: `vietqr-encode-bin-not-string`, `vietqr-encode-purpose-not-string`, `number-query` (bank-lookup), `promptpay-encode-two-targets` (đích có hai khoá `mobile` và `nationalId`: kiểu đích đóng của bản có kiểu tĩnh không biểu diễn được).
  - **Thông báo lỗi** không bắt buộc giống từng chữ giữa các bản (nâng từ luật "không có đầu vào" thành luật chung).
  - **`bank-app-link`**: hai bản chỉ bảo đảm giống nhau trên các mẫu; tên miền Unicode ngoài mẫu có thể khác giữa TS và .NET, và giữa Linux và Windows.
- [ ] **Step 1: Test (TS):** `for (const bad of [null, undefined, 42])` → `decodeVietQr(bad as never)`, `decodeVnpayQr`, `decodePromptPayQr`, `decodeKhqr`, `detect`: `ok === false`, `error.code === 'INVALID_VALUE'`, không ném.
- [ ] **Step 2:** `pnpm -C ts/packages/core test` → FAIL (`TypeError`). **Step 3:** một lần kiểm `typeof input !== 'string'` ở đầu `parsePayload` (mọi hàm đọc và `detect` đi qua đó; nếu không thì thêm ở từng hàm). **Step 4:** PASS; `pnpm -C ts check:core` trong 48 000 byte (sau `pnpm -C ts/packages/core build`).
- [ ] **Step 5:** Viết bốn luật trên vào `conformance/README.md` (gần luật "không có đầu vào"). Sửa kiểu tham số TS nếu cần (`payload: string` giữ nguyên; kiểm lúc chạy).
- [ ] **Step 6: Commit** `fix(core): readers given a non-string return INVALID_VALUE; conformance rules for typed ports`

### Task 5: VietQR

**Files:**
- Create: `dotnet/src/TingQR.Core/VietQr/VietQr.cs`, `VietQrInput.cs`, `VietQrData.cs`, `VietQrService.cs`, `QrInitiation.cs` (dùng chung)
- Create: `dotnet/tests/TingQR.Core.Tests/Conformance/VectorRunner.cs`, `Conformance/ConformanceTests.cs`, `Conformance/ResultJson.cs`, `Conformance/TypeCheckVectors.cs`
- Test: `dotnet/tests/TingQR.Core.Tests/VietQrTests.cs`

**Interfaces:**
- Consumes: Task 2, 3.
- Produces:
  - `public enum QrInitiation { Static, Dynamic }` (JSON `"static"`/`"dynamic"`)
  - `public enum VietQrService { Account, Card }` (JSON `"account"`/`"card"`)
  - `public sealed record VietQrInput { public required string BankBin { get; init; } public required string AccountNumber { get; init; } public VietQrService Service { get; init; } = Account; public QrAmount? Amount { get; init; } public string? Purpose { get; init; } }` — `required` cần polyfill ở `netstandard2.0`; không được thì bỏ `required`, kiểm lúc chạy.
  - `public readonly struct QrAmount` (dùng chung VietQR, PromptPay, KHQR): tạo từ `long`, `decimal` hoặc `string`, giữ nguyên dạng để cùng luật từ chối như TS (số không nguyên, `0`, chuỗi `''` coi như không có). Implicit conversion từ `long`, `decimal`, `string`.
  - `public sealed record VietQrData { … }` đủ trường như `VietQrData` TS, kiểu `string`/`string?`/`IReadOnlyDictionary<string,string>?`, `Service`, `Initiation`.
  - `public static class VietQr { public const string Guid = "A000000727"; public static string Encode(VietQrInput? input); public static TingQrResult<VietQrData> Decode(string? payload, ParseMode mode = ParseMode.Lenient); }`
  - Bộ chạy (test): `VectorRunner.Register(string scheme, Func<JsonNode, object?>? encode, Func<string, ParseMode, object>? decode)`; `ResultJson.ToNode(object value)` tuần tự hoá bằng System.Text.Json: tên camelCase, bỏ `null`, enum bằng tên JSON viết thường/gạch nối (ví dụ `credit-transfer`, `nationalId`, `multi-source`), từ điển giữ nguyên khoá. `ConformanceTests` là `[Theory]` trên mọi file mẫu có `scheme` đã đăng ký (trừ `render`), chạy theo `kind` đúng như `ts/packages/core/test/conformance.spec.ts`; so `expected` bằng `JsonNode.DeepEquals`. Mẫu trong `TypeCheckVectors.Ids` thì kiểm rằng chuyển `input` sang kiểu C# **thất bại**.
- [ ] **Step 1: Test:** đăng ký `vietqr` trong bộ chạy; `VietQrTests`: `EncodeNullIsInvalidValue`, `DecodeNullIsInvalidValue`, `DecodeEmptyIsFailureNotThrow`, `SameResultUnderTurkishAndGermanCulture` (đặt `CultureInfo.CurrentCulture` = `tr-TR` rồi `de-DE`, encode mẫu `vietqr-dynamic-amount-purpose` và decode lại, bằng kết quả dưới InvariantCulture).
- [ ] **Step 2:** `dotnet test --filter "FullyQualifiedName~VietQr|FullyQualifiedName~Conformance"` → FAIL. **Step 3:** port `schemes/vietqr/encode.ts`, `decode.ts`, bộ chạy. **Step 4:** PASS: mọi mẫu `vectors/vietqr/` (29) đạt; `vietqr-encode-bin-not-string`, `vietqr-encode-purpose-not-string` đạt như mẫu kiểm kiểu.
- [ ] **Step 5: Commit** `feat(dotnet): VietQR encode/decode and the conformance runner`

### Task 6: VNPAY-QR

**Files:**
- Create: `dotnet/src/TingQR.Core/Vnpay/VnpayQr.cs`, `VnpayQrData.cs`
- Test: `dotnet/tests/TingQR.Core.Tests/VnpayQrTests.cs`

**Interfaces:**
- Produces: `public sealed record VnpayQrData { … }` đủ trường như TS; `public static class VnpayQr { public const string Guid = "A000000775"; public static TingQrResult<VnpayQrData> Decode(string? payload, ParseMode mode = ParseMode.Lenient); }`
- [ ] **Step 1: Test:** đăng ký `vnpay`; `DecodeNullIsInvalidValue`. **Step 2:** FAIL. **Step 3:** port `schemes/vnpay/decode.ts`. **Step 4:** 7 mẫu `vnpay` đạt.
- [ ] **Step 5: Commit** `feat(dotnet): VNPAY-QR decode`

### Task 7: PromptPay

**Files:**
- Create: `dotnet/src/TingQR.Core/PromptPay/PromptPayQr.cs`, `PromptPayInput.cs`, `PromptPayTarget.cs`, `PromptPayData.cs`
- Test: `dotnet/tests/TingQR.Core.Tests/PromptPayTests.cs`

**Interfaces:**
- Produces:
  - `public abstract record PromptPayTarget` với record lồng `Mobile(string Number)`, `NationalId(string Id)`, `EWallet(string Id)`, `Bill(string BillerId, string? Reference1 = null, string? Reference2 = null)`. Bộ chạy đổi `input.target` JSON (`{ mobile }`, `{ nationalId }`, `{ eWallet }`, `{ billerId, … }`) sang đúng loại; JSON có đúng một khoá đích, khác đi thì chuyển thất bại. `promptpay-encode-two-targets` là mẫu kiểm kiểu (Task 4).
  - `public sealed record PromptPayInput { public required PromptPayTarget Target { get; init; } public QrAmount? Amount { get; init; } }`
  - `public sealed record PromptPayData` một lớp: `Kind` (`PromptPayKind.CreditTransfer`/`BillPayment`, JSON `credit-transfer`/`bill-payment`), các trường chung, và các trường riêng từng loại để `null`/`bool?` khi không thuộc loại đó (bỏ khỏi JSON), `ProxyType` (`mobile`, `nationalId`, `eWallet`, `bankAccount`, `unknown`).
  - `public static class PromptPayQr { public static string Encode(PromptPayInput? input); public static TingQrResult<PromptPayData> Decode(string? payload, ParseMode mode = ParseMode.Lenient); }` và hằng AID như `PROMPTPAY_AID`.
- [ ] **Step 1: Test:** đăng ký `promptpay`; `DecodeNullIsInvalidValue`, `EncodeNullIsInvalidValue`, `AmountSameUnderGermanCulture` (`de-DE`, amount `30.5m` → payload như InvariantCulture). **Step 2:** FAIL. **Step 3:** port. **Step 4:** 32 mẫu `promptpay` đạt.
- [ ] **Step 5: Commit** `feat(dotnet): PromptPay encode/decode`

### Task 8: KHQR

**Files:**
- Create: `dotnet/src/TingQR.Core/Khqr/Khqr.cs`, `KhqrInput.cs`, `KhqrData.cs`
- Test: `dotnet/tests/TingQR.Core.Tests/KhqrTests.cs`

**Interfaces:**
- Produces:
  - `public enum KhqrAccountType { Individual, Merchant }`; `KhqrInput` đủ trường như TS; `Currency` là `string` (`KHR`, `USD`, `116`, `840`), `CreatedAt`/`ExpiresAt` là `long` (mili-giây Unix), `AlternateLanguage` là record `(string Language, string MerchantName, string? MerchantCity)`.
  - `KhqrData` đủ trường như TS (`CreatedAt`/`ExpiresAt` `long?`, `Timestamp` từ điển, `CurrencyAlpha` `string?`).
  - `public static class Khqr { public static string Encode(KhqrInput? input); public static TingQrResult<KhqrData> Decode(string? payload, ParseMode mode = ParseMode.Lenient); public static bool? IsExpired(KhqrData data, long nowMs); }`
- [ ] **Step 1: Test:** đăng ký `khqr`; `DecodeNullIsInvalidValue`; `MerchantNameCountsCodePoints`: tên 25 emoji `😀` (50 đơn vị UTF-16) → tạo được; 26 emoji → `INVALID_VALUE` tag `59`. `AlternateNameKhmer25Ok26Rejected` tương tự cho `64.01`. `IsExpiredLikeTypeScript`: `IsExpired(data, 0) == false`, `IsExpired(data, 2030-01-01 ms) == true`, không có `ExpiresAt` → `null` (như `khqr-decode.spec.ts`).
- [ ] **Step 2:** FAIL. **Step 3:** port `schemes/khqr/*`. **Step 4:** 21 mẫu `khqr` đạt.
- [ ] **Step 5: Commit** `feat(dotnet): KHQR encode/decode and IsExpired`

### Task 9: `Detect`

**Files:**
- Create: `dotnet/src/TingQR.Core/Detect/TingQrDetector.cs`, `DetectResult.cs`, `QrScheme.cs`
- Test: `dotnet/tests/TingQR.Core.Tests/DetectTests.cs`

**Interfaces:**
- Produces: `public enum QrScheme { VietQr, Vnpay, PromptPay, Khqr }` (JSON `vietqr`, `vnpay`, `promptpay`, `khqr`); `public sealed record DetectResult(QrScheme Scheme, object Data, IReadOnlyList<QrScheme> AlsoMatches)` (`Data` là `VietQrData`/`VnpayQrData`/`PromptPayData`/`KhqrData`); `public static class TingQrDetector { public static TingQrResult<DetectResult> Detect(string? payload); }` cùng thứ tự thử và luật `UNKNOWN_SCHEME` (kèm `Fields`) như `detect.ts`.
- [ ] **Step 1: Test:** đăng ký `detect` (bộ chạy chỉ so `scheme` và `alsoMatches`, như TS); `DetectNullIsInvalidValue`; `UnknownSchemeCarriesFields` (một payload EMV hợp lệ không thuộc loại nào → `UnknownScheme`, `Error.Fields` khác rỗng). **Step 2:** FAIL. **Step 3:** port. **Step 4:** 7 mẫu `detect` đạt.
- [ ] **Step 5: Commit** `feat(dotnet): Detect`

### Task 10: Ngân hàng, app, link mở app

**Files:**
- Create: `conformance/tools/banks/sync-dotnet.mjs`, `conformance/tools/banks/test/sync-dotnet.test.mjs`, `dotnet/src/TingQR.Core/Banks/BankData.g.cs` (sinh), `Banks/Bank.cs`, `Banks/BankApp.cs`, `Banks/Banks.cs`, `Banks/BankAppLink.cs`, `Banks/FallbackUrl.cs`
- Modify: `.github/workflows/update-banks.yml`, `.claude/skills/update-banks/SKILL.md`, `conformance/tools/banks/package.json` (nếu test chạy qua đó)
- Test: `dotnet/tests/TingQR.Core.Tests/BanksTests.cs`, `BankDataSyncTests.cs`, `Conformance/ConformanceTests.cs` (thêm `EveryVectorSchemeHasARunner`)

**Interfaces:**
- Produces:
  - `node conformance/tools/banks/sync-dotnet.mjs` ghi `BankData.g.cs`; `--check` thoát 1 khi lệch (giống `sync-ts.mjs`). Chỉ các trường của `Bank`/`BankApp`; dòng đầu `// GENERATED by conformance/tools/banks/sync-dotnet.mjs from conformance/banks/. Do not edit.`
  - `public sealed record Bank(string Bin, string Code, string ShortName, string Name, string? Swift, string LogoUrl)`; `public sealed record BankApp(string Id, string Name, string? Bin, BankAppIos? Ios, BankAppAndroid? Android, BankAppConfidence Confidence, bool VietqrAutofill)`; `BankAppIos(string Scheme)`, `BankAppAndroid(string Package, string Scheme, string Host)`; `enum BankAppConfidence { MultiSource, SingleSource }`; `enum AppPlatform { Android, Ios }`.
  - `public static class Banks { public static IReadOnlyList<Bank> All { get; } public static Bank? Find(string? binOrCode); }`; `public static class BankApps { public static IReadOnlyList<BankApp> All { get; } public static BankApp? Find(string? id); public static IReadOnlyList<BankApp> ForBank(string? bin); public static string Link(string appId, AppPlatform platform, string? fallbackUrl = null); }` — luật như `banks.ts`, `banks/lookup.ts`, `banks/link.ts`.
  - `internal static class FallbackUrl { public static string Normalize(string url); }`: chỉ `http`/`https`, tuyệt đối, ra đúng chuỗi mọi mẫu `bank-app-link` mong đợi; tên miền Unicode đổi bằng `IdnMapping`; surrogate lẻ, scheme khác → `INVALID_VALUE`.
- [ ] **Step 1: Test (Node):** `sync-dotnet.test.mjs`: sinh từ hai ngân hàng và một app giả ra đúng chuỗi C# mong đợi (tên trường, `null` cho `Swift`/`Bin`, thứ tự). Chạy `node --test conformance/tools/banks/test/sync-dotnet.test.mjs` → FAIL.
- [ ] **Step 2:** viết `sync-dotnet.mjs`; test PASS; chạy `node conformance/tools/banks/sync-dotnet.mjs` sinh `BankData.g.cs`.
- [ ] **Step 3: Test (.NET):** đăng ký `bank-lookup`, `bank-apps-for-bank`, `bank-app-link`; `BankDataSyncTests.GeneratedFileIsCurrent` (chạy `node … --check` và đòi mã thoát 0; bỏ qua có ghi lý do nếu máy không có `node` — CI có); `BanksTests.ListsAreReadOnly` (ép `Banks.All` sang `Bank[]` hoặc `IList<Bank>` rồi gán → ném `NotSupportedException`, hoặc kiểu không phải mảng); `FindNullIsNull`; `EveryVectorSchemeHasARunner`: mọi `scheme` trong `conformance/vectors/` trừ `render` đã đăng ký.
- [ ] **Step 4:** FAIL. **Step 5:** viết. **Step 6:** PASS: 11 + 3 + 24 mẫu đạt, `number-query` đạt như mẫu kiểm kiểu, `EveryVectorSchemeHasARunner` xanh.
- [ ] **Step 7:** `update-banks.yml` và skill `update-banks` chạy thêm `node conformance/tools/banks/sync-dotnet.mjs` ngay sau `sync-ts.mjs`, và đưa `dotnet/src/TingQR.Core/Banks/BankData.g.cs` vào commit/PR mà Action tạo.
- [ ] **Step 8: Commit** `feat(dotnet): banks, apps and app links from conformance/banks`

### Task 11: Mutation (Stryker.NET)

**Files:**
- Create: `dotnet/stryker-config.json`, `.github/workflows/mutation-dotnet.yml`, `dotnet/.config/dotnet-tools.json`
- Modify: `dotnet/CLAUDE.md`

**Interfaces:**
- Produces: `dotnet tool run dotnet-stryker` trong `dotnet/` với ngưỡng chặn 90 (`thresholds.break = 90`), loại `Banks/BankData.g.cs` và `Polyfills.cs`. Workflow chạy trên PR khi đổi `dotnet/**` hoặc `conformance/**`.
- [ ] **Step 1:** cài Stryker.NET làm tool cục bộ (`dotnet new tool-manifest`, `dotnet tool install dotnet-stryker`). Chạy → ghi điểm.
- [ ] **Step 2:** đột biến sống sót không thuộc loại tương đương đã biết (chuỗi thông báo lỗi, như `ts/CLAUDE.md`) thì viết test giết nó trong file test của module tương ứng, cho tới khi ≥ 90.
- [ ] **Step 3:** ghi lệnh, ngưỡng, các loại đột biến tương đương vào `dotnet/CLAUDE.md`.
- [ ] **Step 4: Commit** `test(dotnet): Stryker.NET mutation testing at 90%`

### Task 12: Tài liệu, kiểm toàn bộ, review

**Files:**
- Create: `dotnet/src/TingQR.Core/README.md`
- Modify: `CLAUDE.md`, `README.md`, `README.vi.md` (dòng trạng thái .NET, nếu có), `CHANGELOG.md`

- [ ] **Step 1:** `dotnet/src/TingQR.Core/README.md`: cách dùng ngắn, bảng đối chiếu TS ↔ .NET (đúng tên thật đã viết), giới hạn đã biết (`bank-app-link`, mẫu kiểm kiểu), "chưa phát hành".
- [ ] **Step 2:** `CLAUDE.md`: dòng Plan 8a (nhánh, plan, spec, kết quả). `CHANGELOG.md`: mục .NET "Unreleased" (chính sách số phiên bản để 8c). README gốc: không ghi .NET là đã có cho tới khi phát hành; chỉ thêm "đang làm" nếu README có mục lộ trình.
- [ ] **Step 3:** `pnpm test:all && pnpm build:all && pnpm typecheck:all` → PASS, ghi số test từng phần. `node --test conformance/tools/banks/test/sync-dotnet.test.mjs` → PASS. `node conformance/tools/banks/sync-dotnet.mjs --check` → 0.
- [ ] **Step 4:** agent `evidence-review`, `parity-review` (lần đầu có `dotnet/`), rồi review cả nhánh; sửa phát hiện.
- [ ] **Step 5: Commit** `docs: Plan 8a status`
