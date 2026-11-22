# Thiết kế: bản .NET, phần lõi — Plan 8a (2026-11-22)

Thuộc Plan 8 (bản .NET, v0.2). Plan 8 chia ba (Claude đề xuất, chủ dự án để Claude quyết): **8a** `TingQR.Core` và bộ
chạy mẫu thử (tài liệu này), **8b** `TingQR.Rendering`, **8c** `TingQR.AspNetCore`, `TingQR.BankLogos`, phát hành NuGet.
Nguồn chính vẫn là `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 4, 5.2, 5.3, 5.8, 5.9).

## Ý định

tingqr muốn là một thư viện mã nguồn mở có tiếng, có bản TypeScript và .NET cho cùng kết quả (spec chung, mục 3).
Chưa có dự án .NET cụ thể nào chờ dùng; bản .NET là để thư viện đủ hai ngôn ngữ. Lõi làm trước vì mọi gói .NET khác dựa
vào nó, và vì đây là chỗ đo được ngay hai bản có khớp nhau không: cùng bộ mẫu thử `conformance/vectors/`.

- **Mục tiêu:** `TingQR.Core` làm được mọi thứ `@tingqr/core` làm, và đạt **mọi** mẫu thử không thuộc phần vẽ:
  `vietqr`, `vnpay`, `promptpay`, `khqr`, `detect`, `bank-lookup`, `bank-apps-for-bank`, `bank-app-link`
  (134 file ngày 2026-11-22).
- **Không làm ở 8a:** vẽ QR (`render`, mẫu `kind: "matrix"`), ASP.NET Core, logo, phát hành NuGet, nhận diện ví MoMo/ZaloPay
  (bản TS cũng chưa có).
- **Không được:**
  - một mẫu thử chạy đúng ở TS mà sai ở .NET (spec chung, mục 3: "hai bản cho kết quả khác nhau" là thất bại);
  - đổi `conformance/` để .NET dễ đạt. Mẫu thử là chuẩn; sai thì sửa code .NET. Nếu một mẫu thật sự mơ hồ thì sửa
    tài liệu `conformance/` cho rõ, và bản TS phải vẫn đạt;
  - dependency lúc chạy trong `TingQR.Core` (như `@tingqr/core`).

## Cách làm (đã chọn)

| Cách | Đánh giá |
|---|---|
| **1. Port tay từng module, mẫu thử làm chuẩn** (chọn) | Nhiều code nhất, nhưng ra thư viện C# đúng chất, dùng được các kiểm tra chéo đã có (`parity-review`, mẫu thử chung) |
| 2. Sinh C# từ TypeScript bằng công cụ | Code khó đọc, khó sửa, không giống thư viện .NET viết tay |
| 3. Bọc bản TS qua JS engine (Jint…) | Dependency nặng, chậm, trái quyết định "lõi không dependency" |

Chủ dự án chọn cách 1 (2026-11-22).

## Phạm vi của `TingQR.Core`

Tương ứng một-một với `ts/packages/core/src/` (khoảng 1 800 dòng, không kể dữ liệu ngân hàng):

| TypeScript | .NET (đề xuất tên, **[Claude]**) |
|---|---|
| `TingQrError` (`code`, `tag`, `fields`), `ERROR_CODES`, `WARNING_CODES` | `TingQrException : Exception` (`Code`, `Tag`, `Fields`); `TingQrErrorCode`, `TingQrWarningCode` (enum) |
| `Result<T>` (`ok`, `value`, `warnings` / `error`) | `TingQrResult<T>` (`Ok`, `Value`, `Warnings`, `Error`) |
| `ParseMode` `'lenient'`/`'strict'`, mặc định lenient | `ParseMode.Lenient`/`Strict`, mặc định `Lenient` (chủ dự án chọn ở Plan 2) |
| tầng EMV: `crc16`, `field`, `encodeFields`, `parseTlv`, `parseTemplate`, `buildPayload`, `getField`, `parsePayload` | `TingQR.Emv`: `Crc16`, `Tlv`, `EmvPayload` cùng chức năng |
| `encodeVietQr`/`decodeVietQr`, `decodeVnpayQr`, `encodePromptPayQr`/`decodePromptPayQr`, `encodeKhqr`/`decodeKhqr`/`isKhqrExpired`, `detect` | `VietQr.Encode/Decode`, `VnpayQr.Decode`, `PromptPayQr.Encode/Decode`, `Khqr.Encode/Decode/IsExpired`, `TingQrDetector.Detect` (hoặc tên tương đương, theo quy ước .NET) |
| `removeVietnameseAccents` | `VietnameseText.RemoveAccents` |
| `@tingqr/core/banks`: `BANKS`, `BANK_APPS`, `findBank`, `findBankApp`, `appsForBank`, `bankAppLink` | namespace `TingQR.Banks` trong cùng assembly: `Banks.All`, `BankApps.All`, `FindBank`, `FindBankApp`, `AppsForBank`, `BankAppLink` |

- **Quy tắc chung (spec chung, 5.3):** `Encode` ném `TingQrException`; `Decode`/`Detect` trả `TingQrResult<T>`, không ném
  với dữ liệu vào xấu.
- **Mã lỗi và cảnh báo** đúng bảng `conformance/errors.json`, kể cả ba mã canvas (`LOGO_LOAD_FAILED`, `CANVAS_TAINTED`,
  `NO_CANVAS`): khai báo, không bao giờ ném (`conformance/README.md`). Test so enum với file JSON theo tên.
- **Thông báo lỗi** viết tiếng Anh, cùng ý với bản TS; **không bắt buộc giống từng chữ** (đã ghi cho luật "không có đầu
  vào" ở `conformance/README.md`; 8a ghi thành luật chung ở đó). Mẫu thử chỉ so `error` và `errorTag`.
- **Đầu vào không có (null):** `TingQrException` `INVALID_VALUE`, không phải `ArgumentNullException`
  (`conformance/README.md`).
- **Độ dài chữ đếm theo ký tự Unicode (code point), CRC tính trên byte UTF-8** (`conformance/schemes/khqr.md`). Chuỗi C#
  là UTF-16, nên chữ Khmer và emoji phải đếm theo code point, không theo `string.Length`.
- **Dữ liệu ngân hàng sinh từ `conformance/banks/`**, không chép tay: một script mới cạnh `sync-ts.mjs` trong
  `conformance/tools/banks/` sinh file C# (ví dụ `BankData.g.cs`), và một test báo khi file sinh lệch dữ liệu (như
  `banks-sync.spec.ts`). Skill `update-banks` và Action hằng tháng phải chạy cả script mới.

## Bộ chạy mẫu thử .NET

- Một test xUnit đọc **mọi** file trong `conformance/vectors/` (trừ `render/`, để 8b) và chạy đúng như
  `ts/packages/core/test/conformance.spec.ts`: cùng các `kind` (`valid`, `invalid`, `lenient`, `encode-invalid`, `link`,
  `lookup`), cùng cách so (`expected`, `warnings`, `error`, `errorTag`, mã hoá lại từ `input` phải ra đúng `payload`
  từng byte trừ khi `roundTrip: false`).
- Mẫu thuộc `scheme` mà bản .NET chưa có thì **đỏ**, không bị bỏ qua lặng lẽ.
- Tìm thư mục `conformance/` bằng cách đi ngược từ thư mục test, không đường dẫn cố định (giống `CONFORMANCE_DIR` bên TS).
- `input` của mẫu là JSON; bộ chạy chuyển sang kiểu đầu vào C#. Kiểu đầu vào phải biểu diễn được **mọi** `input` đang
  có trong mẫu thử (ví dụ `amount` của VietQR vừa là số vừa là chuỗi; `currency` của KHQR vừa là `KHR`/`USD` vừa là mã
  số). So `expected` theo cấu trúc JSON, không theo chuỗi.

### Ba chỗ C# không làm giống hệt TypeScript được (Claude quyết sau lượt đọc soát)

1. **Mẫu thử cố ý truyền sai kiểu JSON** (`vietqr-encode-bin-not-string`: `bankBin` là số;
   `vietqr-encode-purpose-not-string`: `purpose` là số; `bank-lookup/number-query`: `query` là số). Trong C# có kiểu
   tĩnh, lời gọi như vậy không biên dịch được; không dùng `object` cho các trường đó chỉ để mẫu chạy được.
   - Luật mới trong `conformance/README.md`: một mẫu có trường mang kiểu JSON khác kiểu mà ngôn ngữ có kiểu tĩnh khai báo
     là **mẫu kiểm kiểu**. Bản có kiểu tĩnh không gọi hàm với mẫu đó, mà kiểm rằng giá trị JSON đó **không chuyển được**
     sang kiểu khai báo (lỗi lúc chuyển là đạt).
   - Bộ chạy .NET giữ một **danh sách cố định** các `id` mẫu kiểm kiểu. Mẫu nào chuyển kiểu thất bại mà không có trong
     danh sách thì đỏ; mẫu trong danh sách mà lại chuyển được thì cũng đỏ. Không bỏ qua lặng lẽ.
   - `errorTag` của các mẫu này chỉ áp dụng cho bản không có kiểu tĩnh (TS).
2. **`BankAppLink` và `fallbackUrl`:** bản TS dùng bộ đọc URL WHATWG. .NET không có bộ đọc đó; `System.Uri` khác ở nhiều
   chỗ, và `IdnMapping` (đổi tên miền Unicode sang punycode) dựa vào ICU trên Linux, vào Windows trên Windows.
   - .NET viết một bộ kiểm URL nhỏ, đủ cho luật của tingqr: chỉ `http:`/`https:`, URL tuyệt đối, và ra đúng chuỗi mà mọi
     mẫu `bank-app-link` mong đợi (tên miền Unicode sang punycode qua `IdnMapping`, `https:example.com`, viết hoa và khoảng trắng hai đầu).
   - Surrogate lẻ: trong **path** thì thành U+FFFD (mẫu `mb-android-fallback-lone-surrogate`); chỉ surrogate lẻ trong
     **host** mới là `INVALID_VALUE`. (Bản đầu của spec ghi "surrogate lẻ là lỗi" là sai.)
   - **Cố ý từ chối** (`INVALID_VALUE`), dù WHATWG nhận rồi viết lại: user info; IPv6; IPv4 không chuẩn; `%` hoặc `\`
     trong host; `\` hoặc đoạn `.`/`..` trong path; host có nhãn cuối bắt đầu bằng `0x`; IPv4 có dấu chấm cuối.
   - Ví dụ lệch đã biết: `ẞ` ra `xn--zca` ở .NET nhưng `ss` ở Node.
   - Không port toàn bộ chuẩn WHATWG và bảng UTS-46. `conformance/schemes/bank-app-link.md` (hoặc README) ghi rõ: hai bản
     chỉ bảo đảm giống nhau trên các mẫu; tên miền Unicode ngoài mẫu có thể ra khác nhau giữa TS và .NET, và giữa Linux
     và Windows. CI chạy cả Ubuntu và Windows để bắt chỗ lệch trên các mẫu.
3. **`Decode`/`Detect` nhận `null`:** trả kết quả lỗi `INVALID_VALUE`, không ném (spec chung, 5.3: hàm đọc không ném vì
   dữ liệu xấu). Bản TS hiện ném `TypeError` khi nhận thứ không phải chuỗi, nên **thêm cùng luật vào bản TS** (một lần
   kiểm ở đầu mỗi hàm đọc và `detect`), kèm test, và ghi luật vào `conformance/README.md` cạnh luật "không có đầu vào"
   của hàm tạo mã.

## Ràng buộc

- **Khung đích:** `net10.0` (LTS) cho mọi gói. `TingQR.Core` thêm `netstandard2.0` (spec chung, 5.9: "nếu không tốn
  nhiều công"). **[Claude]** Lý do bỏ .NET 8 khỏi danh sách: theo hiểu biết của Claude, .NET 8 hết hỗ trợ ngày
  2026-11-10 (chưa kiểm lại; builder kiểm trên trang hỗ trợ .NET trước khi chốt). `netstandard2.0` vẫn cho dự án .NET 8,
  .NET Framework 4.6.1+ dùng được lõi.
  - Nếu `netstandard2.0` cần polyfill (record/`init`, đếm code point, `Span`) mà phải thêm gói NuGet lúc chạy, thì **bỏ
    `netstandard2.0`** thay vì thêm dependency, và ghi lý do. Polyfill viết trong mã nguồn thì được.
- **Không dependency lúc chạy** trong `TingQR.Core`. Test được dùng gói (xUnit, `System.Text.Json`…).
- Cấu trúc repo theo spec chung, mục 4: `dotnet/TingQR.sln` (hoặc `.slnx`, builder chọn theo SDK 10), `dotnet/src/TingQR.Core`,
  `dotnet/tests/TingQR.Core.Tests`.
- **CI:** workflow mới `ci-dotnet.yml`, chạy khi đổi `dotnet/**` hoặc `conformance/**`, trên Ubuntu và Windows như
  `ci-ts.yml`: build, test. Đổi `conformance/**` phải chạy **cả** `ci-ts` và `ci-dotnet` (bản TS đã chạy khi đổi
  `conformance/**`; builder kiểm lại).
- **Mutation:** Stryker.NET, ngưỡng 90% như bản TS, workflow `mutation-dotnet.yml`. **[Claude]** File dữ liệu ngân hàng
  sinh ra không chạy mutation (như bản TS).
- Lệnh gốc: `pnpm test:all`, `pnpm build:all`, `pnpm typecheck:all` nối thêm lệnh `dotnet` (Plan 1 đã định).
- `dotnet/CLAUDE.md`: lệnh, quy ước C#, các bẫy đã gặp. `CLAUDE.md` gốc: bật LSP C# từ Plan 8 (đã ghi).
- Làm trên nhánh `plan-8a`. Việc TS song song (nếu có) ở worktree riêng (`CLAUDE.md`).
- Trước khi gộp: `evidence-review`, `parity-review` (lần đầu có `dotnet/` thật), review cả nhánh.

## Đã quyết

- Cách 1, port tay (chủ dự án, 2026-11-22).
- Thứ tự 8a → 8b → 8c; `net10.0`, thêm `netstandard2.0` cho Core (Claude quyết, chủ dự án để Claude quyết).

## Để builder quyết

- Tên lớp, namespace, cách tổ chức file trong `TingQR.Core`, miễn đúng quy ước .NET (PascalCase, `record`/`init`,
  nullable bật) và có bảng đối chiếu TS ↔ .NET trong README của gói.
- Kiểu số của `amount` (VietQR, PromptPay, KHQR), miễn biểu diễn được mọi `input` của mẫu thử và cùng luật từ chối như
  bản TS (ví dụ số không nguyên, số 0, quá 13 chữ số).
- Phiên bản xUnit, Stryker.NET, cách tổ chức test đơn vị ngoài bộ chạy mẫu thử.
- Chính sách số phiên bản npm/NuGet: để 8c (khi phát hành). 8a để `0.0.0`.
