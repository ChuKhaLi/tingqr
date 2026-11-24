# Rà tên API công khai .NET trước khi khoá (Plan 8c, Task 1)

**Kết quả duyệt:** chủ dự án duyệt **toàn bộ** ngày 2026-11-24 (cả 8 dòng đổi tên, gồm `VietqrAutofill` và hai tên
kiểu mới), không dòng nào bị bỏ hay sửa. `DetectResult.Data` **giữ kiểu `object`** (không thêm `IQrData` trong 8c).

- Phạm vi: mọi kiểu và thành viên `public` của `TingQR.Core` và `TingQR.Rendering` (nhánh `plan-8c`, 2026-11-24), cộng
  tên kiểu mới dự kiến ở Task 4–7 (mục cuối).
- **Chỉ đổi .NET trong 8c** (chủ dự án chọn, thiết kế `2026-11-24-tingqr-dotnet-aspnetcore-release-design.md`). Tên nào
  cũng có ở TS thì TS giữ tên cũ tới việc riêng sau 8c; trong lúc chờ, khác biệt ghi ở `conformance/README.md`. Vì vậy
  chỉ đề xuất đổi khi có vấn đề cụ thể cho người dùng .NET: trùng kiểu BCL, lệch tên giữa các kiểu anh em, tên gây hiểu
  nhầm, hoặc trái Framework Design Guidelines (FDG).
- Không đổi tên trường JSON hay giá trị trong `conformance/`. Lưu ý: bộ chạy mẫu .NET đổi thuộc tính C# sang JSON bằng
  `JsonNamingPolicy.CamelCase` (`dotnet/tests/TingQR.Core.Tests/Conformance/ResultJson.cs`), nên đổi tên thuộc tính của
  các kiểu `*Data` sẽ làm lệch mẫu. Vì thế bảng không đổi thuộc tính nào của `*Data`.

## Cách liệt kê

- `grep -rnE "^\s*public " --include=*.cs dotnet/src` (bỏ `bin/`, `obj/`), rồi
  `grep -rnE "^\s*(public|internal) ... (class|record|struct|enum|interface)"` để biết mức truy cập của từng kiểu (thành
  viên `public` của kiểu `internal` không lộ ra ngoài).
- Kiểu `internal` (không cần duyệt): `BankAppLink`, `BankData`, `FallbackUrl`, `Fields`, `CodePoints`, cả bộ
  `Polyfills.cs` của hai assembly, và trong Rendering: `Rgb`, `Color`, `JsNumber`, `LayoutOptions`, `LogoLayout`,
  `LayoutResult`, `Layout`, `LogoBox`, `Logo`, `Svg`, `QrCode`, `QrCodeGen`, `RangeError`, `QrSegment`. Hai assembly
  có `InternalsVisibleTo` chỉ cho project test của chính nó.
- Cột "Có ở TS không": tên tương ứng trong `ts/packages/core/src/index.ts`, `banks.ts`, `ts/packages/render/src/index.ts`.

## Đề xuất đổi tên

| Tên hiện tại | Đề xuất | Lý do | Có ở TS không |
|---|---|---|---|
| `VietQr.Guid` (const `"A000000727"`) | `VietQr.Aid` | Trùng tên `System.Guid`: trong thân `VietQr` thì `Guid` là hằng chuỗi (muốn dùng kiểu BCL phải viết `System.Guid`), người dùng `using static TingQR.VietQr;` gặp nhập nhằng; IntelliSense hiện `Guid` kiểu `string` dễ hiểu nhầm. Giá trị là AID (RID A000000727 của NAPAS), và `PromptPayQr.Aid` đã dùng chữ `Aid` cho cùng loại giá trị. | Có: `VIETQR_GUID` (TS giữ, ghi vào việc TS sau 8c) |
| `VnpayQr.Guid` (const `"A000000775"`) | `VnpayQr.Aid` | Như dòng trên. | Có: `VNPAY_GUID` |
| `EmvPayloads.Parse(string?)`, `EmvPayloads.Build(fields)`, `EmvPayloads.GetField(p, tag)`; bỏ lớp `EmvPayloads` | `EmvPayload.Parse(string?)`, `EmvPayload.Build(fields)` (static), `payload.GetField(tag)` (phương thức của đối tượng) | Cặp `EmvPayload`/`EmvPayloads` khác nhau một chữ `s`, khó nhớ hàm nằm ở đâu. Kiểu .NET quen là hàm tạo/đọc đặt ngay trên kiểu (`Guid.Parse`, `Uri.TryCreate`), còn `GetField` là thao tác trên một payload. Bớt một kiểu công khai. | Không có kiểu tương ứng: TS là hàm rời `parsePayload`, `buildPayload`, `getField` (không lệch tên kiểu) |
| `WireNames.Of(TingQrErrorCode)`, `WireNames.Of(TingQrWarningCode)` | Phương thức mở rộng `code.ToWireName()` trong `public static class TingQrCodeExtensions` | `WireNames.Of` khó tìm: người dùng có `result.Error.Code` trong tay, gõ `.` không thấy gì. Mở rộng trên enum hiện ngay trong IntelliSense; `TingQR.AspNetCore` cũng cần chuỗi này cho thân `{"error":{"code":…}}`. | Không: ở TS mã lỗi đã là chuỗi |
| `VietQrService` (enum `Account`/`Card`) | `VietQrServiceCode` | Ở .NET, hậu tố `Service` gần như luôn là lớp đăng ký DI. Task 5 thêm `TingQrService` (lớp DI thật) và `TingQrOptions.Service` kiểu enum này, nên `VietQrService` cạnh `TingQrService` dễ bị tưởng là service. Đặc tả gọi tag 38.02 là "service code". Thuộc tính `Service` của `VietQrInput`/`VietQrData` giữ nguyên (khớp JSON). | Có: kiểu `VietQrService` (chỉ là kiểu TS, ít khi người dùng viết ra) |
| `QrAmount.HasValue` | `QrAmount.HasAmount` (giữ nghĩa, không đảo) | Đầu vào dùng `QrAmount?`, nên `input.Amount.HasValue` là `Nullable<T>.HasValue` (có khác `null`), còn `input.Amount.Value.HasValue` là "có số tiền": hai `HasValue` khác nghĩa trên cùng biểu thức. Chính code thư viện phải viết `amount == null \|\| !amount.Value.HasValue` (`Khqr.cs:72`, `PromptPayQr.cs:73`). | Không (TS nhận `number \| string`) |
| `BankApp.VietqrAutofill` | `BankApp.VietQrAutofill` | Lệch cách viết hoa với mọi tên khác (`VietQr`, `VietQrData`, `QrScheme.VietQr`). Đổi kèm `conformance/tools/banks/sync-dotnet.mjs` và test của nó (sinh `BankData.g.cs`). Ưu tiên thấp, rẻ; chủ dự án có thể bỏ. | Có: `vietqrAutofill` (trường JSON, không đổi) |

## Giữ nguyên (mỗi dòng một lý do)

Các mục bản brief bắt buộc xét đứng đầu.

| Tên hiện tại | Đề xuất | Lý do | Có ở TS không |
|---|---|---|---|
| `VnpayQrData` (so với `PromptPayData`, `KhqrData`, `VietQrData`) | Giữ | Quy tắc thật là "tên lớp tĩnh + `Data`": `VietQr`→`VietQrData`, `Khqr`→`KhqrData`, `VnpayQr`→`VnpayQrData`; lệch là `PromptPayData`, không phải VNPAY. Đổi thành `VnpayData` dễ lẫn với dữ liệu cổng thanh toán VNPAY (dev .NET Việt hay có lớp `VnPay…` cho cổng này); đổi `PromptPayData`/`PromptPayInput` thành `PromptPayQr…` kéo theo cả họ `PromptPay*` mà lợi ít. Cả bốn tên khớp TS. | Có, cùng tên |
| `DetectResult.Data` (kiểu `object`) | Giữ tên và kiểu | Người dùng .NET đọc bằng pattern matching (`switch (r.Data) { case VietQrData v: … }`), đi cùng `Scheme`. Phương án B để chủ dự án cân nhắc (không phải đổi tên): thêm interface đánh dấu rỗng `IQrData` cho bốn kiểu `*Data` và đổi kiểu `Data` sang nó; phải quyết trước khi phát hành vì đổi kiểu thuộc tính sau này là phá vỡ tương thích. Thêm interface mà giữ `object` thì không phá gì, làm sau được. | Có: `DetectResult` (TS là union có `scheme`/`data`) |
| `TingQrDetector.Detect` | Giữ | Danh từ, tiền tố `TingQr` như các kiểu toàn thư viện (`TingQrException`, `TingQrResult<T>`, `TingQrRender`); không trùng BCL. `QrDetector` trơn dễ trùng thư viện quét QR khác. | TS là hàm `detect` |
| `EmvPayload` (lớp; `Fields`, `Crc`, `Raw`) | Giữ (nhận thêm hàm ở dòng `EmvPayloads` trên) | Khớp TS. | Có: `EmvPayload` |
| `TingQrResult<T>` (`Ok`, `Value`, `Warnings`, `Error`, `Success`, `Failure`) | Giữ | Đã là generic và chỉ đọc (constructor private, thuộc tính get-only). `Ok` khớp `ok` của TS và mẫu conformance. `Success`/`Failure` để public có ích: người dùng tự tạo kết quả giả khi viết test cho code của họ. Ghi chú không thuộc đổi tên: có thể thêm `[MemberNotNullWhen]` (polyfill internal cho netstandard2.0) để bỏ `!` ở `r.Value!`/`r.Error!`; thêm sau không phá gì. | Có: `Result<T>` |
| `Polyfills.cs` (`IsExternalInit`, `RequiredMemberAttribute`, `CompilerFeatureRequiredAttribute`, `SetsRequiredMembersAttribute`) | Không áp dụng | Cả hai assembly khai báo `internal`, không lộ ra API. | Không |
| `TingQrException` (`Code`, `Tag`, `Fields`) | Giữ | Hậu tố `Exception` đúng FDG; thuộc tính khớp TS `TingQrError`. | Có: `TingQrError` (khác hậu tố theo quy ước mỗi ngôn ngữ, đã ghi ở README Core) |
| `TingQrErrorCode`, `TingQrWarningCode`, `TingQrWarning` | Giữ | Enum số ít, PascalCase; giá trị JSON qua `ToWireName()` (dòng trên). | Có: `ErrorCode`, `WarningCode`, `Warning` |
| `TingQrVersion.Value` | Giữ | Rõ nghĩa; Task 3 và `check-release` đọc hằng này. | Có: `VERSION` |
| `ParseMode` (`Lenient`/`Strict`) | Giữ | Khớp TS và quyết định Plan 2. | Có |
| `QrScheme`, `QrInitiation` | Giữ | Tên enum mô tả tập giá trị, không trùng BCL. | Có (union chuỗi) |
| `VietQr`, `VnpayQr`, `PromptPayQr`, `Khqr` (+ `Encode`/`Decode`/`IsExpired`) | Giữ | Lớp tĩnh theo tên loại QR, động từ ngắn; `Khqr` không thêm `Qr` vì tên đã có. | TS là hàm `encodeVietQr`… |
| `VietQrInput`, `VietQrData`, `PromptPayInput`, `PromptPayData`, `PromptPayTarget` (+ `Mobile`, `NationalId`, `EWallet`, `Bill`), `PromptPayKind`, `PromptPayProxyType`, `KhqrInput`, `KhqrData`, `KhqrAccountType`, `KhqrAlternateLanguage`, `KhqrAlternateLanguageData` | Giữ | Khớp TS; thuộc tính khớp JSON. | Có (trừ `PromptPayKind`, `KhqrAccountType`, `KhqrAlternateLanguage*` là union/object lồng ở TS) |
| `VnpayQrData.Store`/`Terminal` so với `KhqrData.StoreLabel`/`TerminalLabel` (cùng tag 62.03/62.07) | Giữ | Lệch giữa hai kiểu anh em, nhưng là tên trường JSON trong `conformance/` và TS cũng lệch y vậy; sửa phải sửa mẫu, ngoài phạm vi 8c. Ghi vào việc TS sau 8c để hai bản cùng sửa. | Có, cùng tên |
| `PromptPayQr.Aid` (lớp lồng: `CreditTransfer`, `Ota`, `BillPayment`, `BillPaymentCrossBorder`) | Giữ | Đúng nghĩa (AID), là mẫu cho `VietQr.Aid`/`VnpayQr.Aid`. Khác hình dạng (lớp lồng, vì PromptPay có bốn AID; VietQR/VNPAY có một) là chấp nhận được. | Có: `PROMPTPAY_AID` |
| `Khqr.IsExpired(KhqrData data, long nowMs)` | Giữ | Khớp `isKhqrExpired` và `CreatedAt`/`ExpiresAt` (mili giây, `long?`). Ghi chú: có thể thêm overload `DateTimeOffset` sau, không phá gì. | Có |
| `QrAmount` (constructor `long`/`decimal`/`string`, chuyển kiểu ngầm, `IsNumber`) | Giữ (trừ `HasValue`, xem trên) | Kiểu giá trị riêng của .NET, tên rõ. | Không |
| `Banks` (`All`, `Find`), `BankApps` (`All`, `Find`, `ForBank`, `Link`), `Bank`, `BankApp`, `BankAppIos`, `BankAppAndroid`, `BankAppConfidence` | Giữ | Đã chốt ở 8a (thiết kế 8a, mục "Tên thật đã dùng"); đọc tự nhiên (`Banks.Find("MB")`). | Có: `findBank`, `BANK_APPS`… |
| `AppPlatform` | Giữ | Lệch nhẹ với họ `BankApp*`, nhưng chỉ dùng làm tham số `BankApps.Link`, khớp TS, không trùng BCL; đổi lợi ít. | Có |
| `VietnameseText.RemoveAccents` | Giữ | Rõ nghĩa. | Có: `removeVietnameseAccents` |
| `Crc16.Compute`, `Tlv` (`Field`, `EncodeFields`, `Parse`, `ParseTemplate`), `TlvField`, `TlvNode` (namespace `TingQR.Emv`) | Giữ | Tầng thấp, tên theo thuật ngữ EMV; nằm trong namespace riêng. | Có: `crc16`, `field`… |
| `TingQrRender` (`ToMatrix`, `ToSvg`, `CheckSvgOptions`) | Giữ | FDG chuộng danh từ (`TingQrRenderer`), nhưng tên khớp gói `@tingqr/render`, đã dùng trong README, mẫu conformance và plan 8c; lợi không đủ. | Có: `toMatrix`, `toSvg`, `checkSvgOptions` |
| `QrMatrix` (`Size`, `Version`, `Ecc`, `Mask`, `Modules`, `IsDark`), `MatrixOptions`, `SvgOptions`, `SvgSize`, `LogoOptions` | Giữ | Khớp TS; `SvgSize` là kiểu .NET riêng cho `number \| string`. | Có (trừ `SvgSize`) |
| `Ecc` (enum `L`/`M`/`Q`/`H`) | Giữ | FDG tránh viết tắt (`ErrorCorrectionLevel`), nhưng `ECC` là thuật ngữ QR quen thuộc, khớp TS và `BoostEcc`. Thuộc tính `Ecc` cùng tên kiểu là mẫu C# bình thường. | Có |

## Tên kiểu mới của Task 4–7 (duyệt cùng lúc)

| Tên dự kiến | Đề xuất | Lý do | Có ở TS không |
|---|---|---|---|
| Lớp `BankLogos` trong namespace `TingQR.BankLogos` | Giữ tên lớp `BankLogos`, **đổi namespace thành `TingQR`** (assembly và gói vẫn `TingQR.BankLogos`) | FDG: không đặt kiểu trùng tên namespace chứa nó. Code nằm trong namespace `TingQR.*` (chính `TingQR.AspNetCore`, project test, hoặc app đặt namespace con) viết `BankLogos.Icon(...)` sẽ gặp lỗi CS0118 ("là namespace nhưng dùng như kiểu"). Đặt ở `TingQR` thì `using TingQR;` có luôn `Banks`, `BankApps`, `BankLogos`, như cách Core đặt `Banks`. | Gói `@tingqr/bank-logos` (mỗi ảnh một module, không có lớp) |
| `BankLogoFile` (`Content`, `ContentType`, `FileName`), `BankLogos.Logo/Icon/OpenLogo/OpenIcon/LogoBins/IconIds` | Giữ (namespace theo dòng trên) | Rõ nghĩa; `Open*` trả `IDisposable` như quy ước `File.Open`. | Không |
| `TingQrOptions` (`Bank`, `AccountNumber`, `Service`, `Svg`, `Profiles`, `CacheControl`) | Giữ | Mẫu Options pattern chuẩn. Ghi chú: `TingQrOptions.Bank` là `string` (BIN hoặc mã) còn `TingQrService.Bank` là `Bank?`; giữ vì khớp `bank` của NestJS, tài liệu XML phải nói rõ. `Service` có kiểu `VietQrServiceCode` nếu dòng đổi tên trên được duyệt. | Có: tuỳ chọn `forRoot` NestJS |
| `TingQrServiceCollectionExtensions.AddTingQr` | Giữ | Đúng quy ước `Add*` trên `IServiceCollection`. | NestJS: `TingQrModule.forRoot` |
| `TingQrService` (`Bin`, `Bank`, `PaymentQr`) | Giữ | Khớp `TingQrService.paymentQr` của NestJS; là lớp DI thật, lý do chính để đổi `VietQrService` ở trên. | Có (NestJS) |
| `TingQrResults.Svg(...)` | `TingQrHttpResults.Svg(...)` | `TingQrResults` chỉ khác `TingQrResult<T>` (kết quả đọc QR của Core) một chữ `s`, mà hai kiểu hay xuất hiện cùng file (`using TingQR; using TingQR.AspNetCore;`). Chữ `Http` nói rõ đây là `IResult` HTTP, hợp với `Results`/`HttpResults` của ASP.NET Core. | Không |
| `TingQrEndpointExtensions.WithTingQrSvg` | Giữ | Đúng quy ước `With*` cho `IEndpointConventionBuilder`. | NestJS/Hono: `TingQrSvg()`/`tingQrSvg` |
| `TingQrSvgAttribute` (`[TingQrSvg]`, `Profile`, `CacheControl`) | Giữ | Khớp decorator `@TingQrSvg()` của NestJS; hậu tố `Attribute` đúng FDG. | Có (NestJS) |

## Việc TS sau 8c (nếu các dòng trên được duyệt)

- `VIETQR_GUID`/`VNPAY_GUID` → tên `AID` tương ứng; `VietQrService` → `VietQrServiceCode`.
- `VnpayQrData.store`/`terminal` so với `KhqrData.storeLabel`/`terminalLabel`: sửa cùng lúc ở hai bản và mẫu, nếu muốn.
- Task 2 ghi các khác biệt tên còn lại vào `conformance/README.md`.
