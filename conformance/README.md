# conformance/

Nguồn sự thật chung cho mọi ngôn ngữ của tingqr. Bản TypeScript (`ts/`) và bản .NET (`dotnet/`, từ v0.2) chạy cùng một
bộ mẫu thử ở đây, nên hai bản cho cùng kết quả trên mọi hành vi có mẫu.

- `vectors.schema.json`: JSON Schema của một file mẫu thử.
- `errors.json`: bảng mã lỗi và mã cảnh báo dùng chung. Không ngôn ngữ nào được có mã ngoài bảng.
  - `LOGO_LOAD_FAILED`, `CANVAS_TAINTED`, `NO_CANVAS` chỉ đến từ phần vẽ PNG trên canvas ở trình duyệt
    (`@tingqr/render/canvas`). Mọi ngôn ngữ vẫn khai báo đủ ba mã; bản nào không có phần vẽ đó thì không bao giờ ném chúng.
  - Logo khi vẽ ảnh raster (canvas, hay bộ vẽ PNG phía máy chủ sau này): ảnh giải mã ra 0×0 thì `LOGO_LOAD_FAILED`, trừ
    logo `data:image/svg+xml` báo 0×0 (SVG không có `width`/`height`), được vẽ vừa ô logo vuông. Chrome 157 (thử
    2026-11-22) không báo 0×0 mà báo 150×150 cho SVG chỉ có `viewBox` vuông, 300×150 khi không có `viewBox`, và vẽ đúng;
    chưa thử trình duyệt nào báo 0×0. SVG không vẽ ra gì (ví dụ `<svg/>`) cho ô logo trống, không báo lỗi.
- `http/svg-response.json`: hợp đồng HTTP chung của mọi gói tích hợp trả QR dạng ảnh SVG (`@tingqr/hono`,
  `@tingqr/nestjs`, sau này `TingQR.AspNetCore`): status, header, thân lỗi 500, luật logo, cái gì kiểm lúc cấu hình. Test của từng gói đọc file
  này, không tự chép header.
- `schemes/<id>.md`: mô tả từng loại QR (tag, GUID, quy tắc, nguồn).
- `vectors/<id>/*.json`: mẫu thử, mỗi file một mẫu, tên file trùng `id`.
- `tools/crc16.py`: CRC-16/CCITT-FALSE viết bằng Python, độc lập với tingqr, để tính lại CRC của mẫu dựng tay hoặc sửa.
- `tools/oracle/`: script chạy các thư viện độc lập để sinh mẫu, có `node_modules` riêng. Phiên bản ghim cứng:

  | Gói | Phiên bản | Giấy phép | Dùng cho |
  |---|---|---|---|
  | `vietqr` | 1.2.0 | MIT | VietQR |
  | `vietnam-qr-pay` | 1.5.1 | MIT | VietQR, VNPAY |
  | `promptpay-qr` | 0.5.0 | MIT (file `LICENSE` trong gói) | PromptPay |
  | `promptparse` | 1.7.1 | MIT (file `LICENSE.md` trong gói) | PromptPay |
  | `thai-qr-payment` | 1.2.0 | MIT (khai báo trong `package.json`; file `LICENSE` có ở repo GitHub `uunw/thai-qr-payment`, không có trong gói npm) | PromptPay |
  | `bakong-khqr` | 1.0.20 | ISC khai báo trong `package.json`, không có file LICENSE (SDK của Ngân hàng Quốc gia Campuchia) | KHQR |
  | Nayuki `qrcodegen.ts` | v1.8.0, commit `720f62b` | MIT (header trong file) | Mẫu ma trận (`vendor/`, file gốc không sửa, kiểm SHA-256 trước khi chạy) |
  | `typescript` | 5.9.3 | Apache-2.0 | Dịch file Nayuki gốc trong `gen-render.mjs` |
- `tools/banks/`: tải, so sánh và cập nhật `banks/`, có `package.json` riêng (`sharp` để thu nhỏ logo).
  - Có gọi mạng: `update.mjs`, `capture-sources.mjs`, `play-check.mjs`, `commons-search.mjs`.
  - `sync-ts.mjs` sinh `ts/packages/core/src/banks/data.ts`.
  - `sync-dotnet.mjs` sinh `dotnet/src/TingQR.Core/Banks/BankData.g.cs` (cùng trường, cùng thứ tự). Chạy ngay sau
    `sync-ts.mjs`; `--check` của cả hai thoát 1 khi file sinh lệch dữ liệu.
  - Test không gọi mạng. Cách dùng: skill `update-banks`.
- `private/`: QR thật chụp ở máy chủ dự án. **Nằm trong `.gitignore`, không bao giờ commit.**
- `banks/`: danh sách ngân hàng và app ngân hàng, dùng chung cho mọi ngôn ngữ (thiết kế:
  `docs/superpowers/specs/2026-11-20-tingqr-banks-design.md`). Mỗi file có `*.schema.json` đi kèm.

  | File | Ai ghi | Nội dung |
  |---|---|---|
  | `banks.json` | `tools/banks/update.mjs` | danh sách của `api.vietqr.io/v2/banks`, đã áp `overrides.json`, kèm ngày lấy |
  | `overrides.json` | sửa tay | sửa một trường của một ngân hàng so với API, kèm lý do và nguồn |
  | `bank-apps.json` | **sửa tay**; script chỉ báo khác biệt | app mở được bằng scheme: scheme iOS, gói/scheme/host Android, nguồn, chỗ nguồn khác ý, ai đã mở thử trên máy thật |
  | `play-checks.json` | `tools/banks/update.mjs` | lần kiểm gói Android trên Google Play gần nhất |
  | `sources/<ngày>/` | chụp tay | bản chụp nguyên văn các nguồn; `NOTES.md` ghi nguồn nào độc lập với nguồn nào |

  - **`confidence: "multi-source"`** khi có ít nhất hai nguồn **khác tên**, đều `independent: true` và `agrees: true`.
    - `agrees`: nguồn ghi đúng scheme (iOS, Android), gói và host mà tingqr tạo ra.
    - `test/sources.test.mjs` tính lại cờ này từ bản chụp trong `sources/<ngày>/`.
    - `qrviet` và Noel tree chép từ vietqr.io, nên không tính là độc lập. Ngoại lệ: các mục `qrviet` tự thêm tay
      (MoMo, ZaloPay).
    - Nguồn độc lập với vietqr.io hiện chỉ có `vietnam-qr-pay` 1.5.1.
    - Nguồn nào ghi khác thì phải có dòng giải thích trong `disagreements`.
  - **Thứ tự:** `banks.json` xếp theo `bin`, `bank-apps.json` theo `id`, đều so từng mã ký tự (ordinal). API giữ
    nguyên thứ tự trong file.
  - **Trường công khai** (bản .NET sinh dữ liệu phải chọn đúng các trường này):
    - `Bank`: `bin`, `code`, `shortName`, `name`, `swift`, `logoUrl`. `overrides.json` đã được áp sẵn trong `banks.json`,
      không áp lại.
    - `BankApp`: `id`, `name`, `bin`, `ios.scheme`, `android.{package, scheme, host}`, `confidence`, `vietqrAutofill`. App
      thiếu `ios` hay `android` thì không có khoá đó (null bên .NET).
    - Không công khai: `sources`, `disagreements`, `deviceVerified`, `vietqrDiffers`, `ignoredVietqrApps`,
      `play-checks.json`.
  - **`deviceVerified`** chỉ ghi khi có người mở thử thật trên máy, ghi rõ ai, hệ điều hành nào, ngày nào.
  - `ignoredVietqrApps` liệt kê app của vietqr.io bị bỏ có chủ ý; `vietqrDiffers` liệt kê chỗ một app cố ý khác
    vietqr.io. Script cập nhật không báo lại hai loại này.

## Một file mẫu thử

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | có | `^[a-z0-9-]+$`, trùng tên file |
| `scheme` | có | ví dụ `vietqr` |
| `kind` | có | `valid`: đọc ra `expected` ở chế độ chặt (riêng `scheme: detect`, không có chế độ chặt: `detect` đọc ra `expected`). `invalid`: cả hai chế độ đều báo `error`. `lenient`: chế độ chặt báo `error`, chế độ chấp nhận lệch chuẩn đọc ra `expected` kèm `warnings`. `encode-invalid`: tạo mã từ `input` phải báo lỗi `error` (kèm `errorTag` nếu có); không có `payload` |
| `payload` | trừ `encode-invalid` | chuỗi QR, không chứa `\r` |
| `input` | không | chỉ ở `valid`: tạo mã từ `input` phải ra đúng `payload` từng byte, trừ khi `roundTrip: false` |
| `expected` | `valid`, `lenient` | dữ liệu đọc ra |
| `warnings` | `lenient` | mã cảnh báo mong đợi |
| `error` | `invalid`, `lenient`, `encode-invalid` | mã lỗi mong đợi |
| `errorTag` | không | tag kèm lỗi, dạng `62` hoặc `38.01` |
| `source` | có | nguồn: đặc tả (mục, trang), repo kèm giấy phép, oracle kèm phiên bản, hoặc "rút từ QR thật của <loại>, chụp ngày D" |
| `derived`, `derivedFrom` | khi sửa từ mẫu khác | `derivedFrom` là `id` mẫu gốc |
| `note` | không | ghi đã sửa gì, đã chạy lệnh gì |

`input` của mẫu luôn là object, nên mẫu thử không diễn tả được một lời gọi không có đầu vào. Luật chung cho mọi bản, áp
dụng cho các hàm tạo mã VietQR, PromptPay và KHQR (VNPAY không có hàm tạo): đầu vào vắng hoặc không phải object thì báo
`TingQrError` mã `INVALID_VALUE`, không kèm tag (bản TypeScript: test `*-encode.spec.ts`).
- Bản .NET: trường hợp thật duy nhất là `null`; phải ném `TingQrError` `INVALID_VALUE`, không phải `ArgumentNullException`.
- Thông báo (TypeScript: `<tên hàm> needs an input object; got <typeof>.`) không bắt buộc giống từng chữ giữa các bản.
- Mảng là object trong JavaScript, nên không bị luật này chặn; nó hỏng ở bước kiểm trường đầu tiên, vẫn là
  `INVALID_VALUE`.

Ba luật chung nữa, cùng loại:

- **Hàm đọc nhận thứ không phải chuỗi** (`null`, `undefined`, số...): `decodeVietQr`, `decodeVnpayQr`,
  `decodePromptPayQr`, `decodeKhqr` và `detect` trả kết quả lỗi `INVALID_VALUE`, không kèm tag, không ném. Bản
  TypeScript kiểm lúc chạy ở `parsePayload` (test `payload.spec.ts`); bản có kiểu tĩnh chỉ cần cổng vào nhận được
  `null`.
- **Mẫu kiểm kiểu:** mẫu có trường mang kiểu JSON khác kiểu mà bản có kiểu tĩnh khai báo. Bản có kiểu tĩnh kiểm rằng
  giá trị không chuyển được sang kiểu đó (không biên dịch được, hoặc bị từ chối khi đọc mẫu); `errorTag` chỉ áp dụng cho
  bản không có kiểu tĩnh. Danh sách hiện tại:
  - `vietqr-encode-bin-not-string`
  - `vietqr-encode-purpose-not-string`
  - `number-query` (scheme `bank-lookup`)
  - `promptpay-encode-two-targets` (đích có hai khoá `mobile` và `nationalId`: kiểu đích đóng của bản có kiểu tĩnh không
    biểu diễn được).
- **Thông báo lỗi** không bắt buộc giống từng chữ giữa các bản (luật "không có đầu vào" ở trên cũng nằm trong luật này).
- **`bank-app-link`**: hai bản chỉ bảo đảm giống nhau trên các mẫu; tên miền Unicode ngoài mẫu có thể khác giữa
  TypeScript và .NET, và giữa Linux và Windows.
  - Bản .NET không có bộ đọc WHATWG đầy đủ: nó từ chối (`INVALID_VALUE`) một số URL mà WHATWG nhận rồi viết lại, như
    có user info, IPv6, IPv4 dạng không chuẩn (`0x7f.1`), `%` hay `\` trong host, `\` hay đoạn `.`/`..` trong path,
    host có nhãn cuối bắt đầu bằng `0x` (như `a.0x`), và IPv4 có dấu chấm cuối (`127.0.0.1.`).

## Mẫu link mở app (`kind: "link"`, `scheme: "bank-app-link"`)

Dành cho `bankAppLink` (`@tingqr/core/banks`). Mẫu nằm ở `vectors/bank-app-link/`.

- `input`: `{ appId, platform, fallbackUrl? }`. `platform` là `android` hoặc `ios`. Không có `payload`, không có `error`.
- `expected`: `{ link }`.
- **Quy tắc so sánh:** gọi `bankAppLink(appId, platform, { fallbackUrl })`. Kết quả phải bằng `expected.link` từng ký tự.
  - Không truyền `fallbackUrl` khi `input` không có trường này.
- Mẫu `encode-invalid` cùng `scheme` có `input` giống vậy. `bankAppLink` phải ném lỗi có đúng mã `error`.
- Chuỗi mong đợi dựa trên `conformance/banks/bank-apps.json`. Đổi dữ liệu của một app thì phải sửa mẫu tương ứng.
- Chỉ ghi "đã mở thử" trong `source` khi `deviceVerified` của app đó có dòng tương ứng, và lần thử đó mở đúng chuỗi
  này.
- **Cách tạo link** (bản .NET phải làm y hệt):
  - `appId` và `platform` so khớp đúng từng ký tự: `"MB"` hay `"Android"` đều là lỗi.
  - Android: `intent://<host>#Intent;scheme=<scheme>;package=<package>;` + (`S.browser_fallback_url=<f>;` nếu có
    `fallbackUrl`) + `end`. iOS: `<scheme>://`.
  - App không có scheme cho hệ được hỏi: lỗi `INVALID_VALUE`.
  - `fallbackUrl` được kiểm **cả trên iOS**, dù iOS bỏ qua nó.
- **Cách kiểm và mã hoá `fallbackUrl`:**
  1. Phân tích theo [WHATWG URL Standard](https://url.spec.whatwg.org/). Không phân tích được, hoặc scheme sau khi phân
     tích không phải `http:` hay `https:`, thì lỗi `INVALID_VALUE`.
  2. Lấy chuỗi đã chuẩn hoá (`href`), không lấy chuỗi gốc. Kết quả: bỏ khoảng trắng đầu cuối, scheme và host thành chữ
     thường, tên miền có dấu thành punycode, `https:a.vn` thành `https://a.vn/`, lone surrogate thành `%EF%BF%BD`.
  3. Mã hoá như `encodeURIComponent` của ECMAScript: giữ `A–Z a–z 0–9 - _ . ! ~ * ' ( )`, mọi byte UTF-8 khác thành
     `%XX` chữ hoa. `Uri.EscapeDataString` của .NET mã hoá cả `! * ' ( )`, nên không dùng thẳng được.

## Mẫu tra cứu ngân hàng (`kind: "lookup"`)

Dành cho `findBank` và `appsForBank` (`@tingqr/core/banks`).

- **`scheme: "bank-lookup"`** (`vectors/bank-lookup/`):
  - `input` là `{ query }`; `expected` là `{ result }`, với `result` là `bin` của ngân hàng tìm thấy, hoặc `null`.
  - **Luật tra cứu:**
    - `query` khớp `^[0-9]{6}$` (đúng 6 chữ số ASCII) thì so bằng với `bin`.
    - Ngược lại, so với `code`, rồi mới tới `shortName`. So khớp ordinal sau khi chuyển chữ thường theo invariant
      culture (không theo ngôn ngữ máy, ví dụ chữ `I` của tiếng Thổ Nhĩ Kỳ).
    - Mã của ngân hàng này thắng tên ngắn của ngân hàng khác.
    - Không cắt khoảng trắng.
    - `query` không phải chuỗi (ví dụ BIN lưu dạng số) là lỗi lập trình: ném `INVALID_VALUE` (mẫu `encode-invalid`), không trả `null`.
- **`scheme: "bank-apps-for-bank"`** (`vectors/bank-apps-for-bank/`):
  - `input` là `{ bin }`; `expected` là `{ result }`, với `result` là mảng `id` app có `bin` đó, theo thứ tự trong
    `bank-apps.json`. Không có app nào thì là `[]`.
- **Quy tắc so sánh:** kết quả phải bằng `expected.result` (chuỗi, `null`, hoặc mảng đúng thứ tự).

## Logo và icon (`banks/logos/`)

Nguồn cho `@tingqr/bank-logos` và `TingQR.BankLogos` sau này.

- `manifest.json` là chỉ mục. Mỗi mục có:
  - `file`: `logo/<bin>.svg|webp` hoặc `icon/<id>.webp`;
  - `kind`;
  - `key`: khoá công khai, là `bin` hay `id` app. Lấy `key` từ manifest, không đoán từ tên file nguồn: ví dụ icon
    `baovietbank` tải từ `bvb` của vietqr.io;
  - nguồn, giấy phép, SHA-256;
  - `sourceSha256` và `processed`, khi ảnh đã được thu nhỏ.
- **MIME** đoán từ nội dung và phải khớp đuôi file; lệch thì dừng build.
  - Bắt đầu bằng `RIFF`, byte 8–11 là `WEBP`: `image/webp`.
  - Có `<svg` theo sau bởi khoảng trắng hoặc `>`, trong 4096 byte UTF-8 đầu: `image/svg+xml`.
- **Data URI:** `data:<mime>;base64,` + base64 chuẩn RFC 4648, có padding.
- **Danh sách khoá** (`LOGO_BINS`, `ICON_IDS`) xếp ordinal.
- Bản CJS của gói npm trả đường dẫn file thay vì data URI. Đây là chi tiết đóng gói riêng của JavaScript.

## Mẫu ma trận (`kind: "matrix"`, `scheme: "render"`)

Dành cho bộ vẽ QR (`@tingqr/render`, sau này `TingQR.Rendering`). Mẫu nằm ở `vectors/render/`.

- `input`: `{ text, ecc?, boostEcc?, minVersion?, maxVersion?, mask? }`. Không có `payload`, không có `error`.
- `expected`: `{ size, version, ecc, mask, rows }`. `rows[y]` là chuỗi `0`/`1`, `1` là ô tối.
- **Quy tắc so sánh:** gọi `toMatrix(input.text, các trường còn lại của input)`. Kết quả phải đúng `size`, `version`,
  `ecc` (mức thực dùng, sau khi nâng) và `mask`, và `rows[y][x] === '1'` khi và chỉ khi `modules[y][x]`.
- Mẫu `encode-invalid` có `scheme: "render"` đặt tuỳ chọn ngay trong `input` (`{ text, ...tuỳ chọn }`). `toMatrix` phải
  ném lỗi có đúng mã `error`.
- Mẫu ma trận chạy bằng bộ chạy riêng của `@tingqr/render`. Bộ chạy của `@tingqr/core` bỏ qua chúng, vì `render` phụ
  thuộc `core`.
- Mẫu ma trận chỉ sinh từ bộ mã hoá Nayuki **gốc** chạy làm oracle, không bao giờ từ code đã port.

## Trang quét thử (VietQR bằng app thật)

1. Ghi tài khoản của bạn vào `conformance/private/scan-inputs.json` (thư mục này bị gitignore, không bao giờ commit).
   File là một mảng `{ id, input }`; `input` giống tham số của `encodeVietQr` (`bankBin`, `accountNumber`, `amount`,
   `purpose`). Xem mẫu ở `conformance/scan-inputs.example.json` (dữ liệu giả).
   - `id` không được chứa số tài khoản hay tên (ví dụ `mb-1`), vì nó được ghi vào `conformance/scans.md`.
   - Có thể trỏ tới file khác bằng biến môi trường `TINGQR_SCAN_INPUTS`.
2. Chạy `pnpm -C ts/packages/render scan-sheet`. Script chỉ in số mã và đường dẫn file, không bao giờ in chuỗi QR hay số
   tài khoản. Trang ghi ra `ts/packages/render/scan-sheet/index.html` (bị gitignore).
3. Trang có:
   - các mẫu VietQR không phải tài khoản của bạn (chỉ để kiểm app đọc được mã; phần lớn là tài khoản bịa, mẫu README
     có thể là tài khoản người khác);
   - mã từ file của bạn;
   - mỗi mã in cả bản có logo lẫn bản không logo, cạnh 40 mm (kể cả viền trắng 4 ô). In trên A4 được.
   - Thông tin hiện cạnh mã được kiểm khớp với đầu vào; lệch thì script dừng và báo trường lệch (không in giá trị).
4. Quét, **dừng ở màn hình xác nhận**, rồi ghi kết quả vào `conformance/scans.md`.

Chỉ chủ dự án chạy bước 2 khi có dữ liệu thật; Claude không chạy và không đọc trang sinh ra từ dữ liệu thật.

## Quy tắc nguồn

- Không tự bịa chuỗi QR. Mẫu `invalid` là mẫu `valid` bị sửa, ghi rõ đã sửa gì.
- Nguồn được phép:
  - đặc tả công khai;
  - repo có giấy phép MIT, Apache, BSD;
  - thư viện độc lập chạy làm oracle;
  - "công thức" rút từ QR thật trong `private/` (giá trị nhạy cảm đã thay, CRC tính lại, `derived: true`).
- Không lấy chuỗi từ repo GPL hoặc không ghi giấy phép.
- Mẫu do chính code tingqr sinh ra không phải bằng chứng: nó chỉ chứng minh code đồng ý với chính nó.

## Thêm mẫu

1. Ghi file vào `vectors/<scheme>/<id>.json`.
2. Chạy `pnpm test:all`. Test `conformance-format` kiểm schema, mã lỗi, `id` trùng tên file.
3. Thêm loại QR mới: theo skill `add-scheme` (`.claude/skills/add-scheme/SKILL.md`).

## QR thật: chụp ở máy, chỉ commit công thức

1. Bỏ QR thật vào `conformance/private/` (nằm trong `.gitignore`, **không bao giờ commit**). Tên file:
   `<nhãn>__<mô-tả>.(txt|png|jpg)`.
   - `<nhãn>` là `bank`, `momo`, `zalopay`, `vnpay` hoặc `other`: app hay nơi bạn lấy QR. Nhãn này là bằng chứng
     "QR này của ví nào".
   - **`<mô-tả>` trở thành id của mẫu được commit**, nên không được chứa tên người, số điện thoại hay số tài khoản.
     Dùng mô tả chung như `nhan-tien`, `quan-cafe-1`, `mb-1`.
   - File `.txt` chứa đúng một chuỗi QR. Ảnh chụp màn hình QR trong app dễ giải hơn ảnh chụp giấy; hoặc dùng app quét QR
     để chép chuỗi.
2. Chạy (lần đầu cần `pnpm install` trong `conformance/tools/recipe`):

   ```
   node conformance/tools/recipe/extract.mjs
   ```

   - Với mỗi file, công cụ thay số tài khoản, tên, mã tham chiếu bằng giá trị giả. Độ dài, loại ký tự, GUID, BIN và
     tiền tố ví (`PSP`, `MOMOW2W`, `99ZP`, `99MM`) được giữ.
   - CRC được tính lại bằng hàm riêng của công cụ.
   - Kết quả ghi vào `vectors/<scheme>/<scheme>-real-<nhãn>-<mô-tả>.json`, có `derived: true`.
   - `expected` lấy từ bộ đọc của `vietnam-qr-pay` trên chuỗi **đã che**.
   - Công cụ chỉ in tên file và id, không bao giờ in chuỗi QR.
3. `pnpm test:all` chạy thêm `private.spec.ts`: đọc từng QR thật ở chế độ chấp nhận lệch chuẩn. Test này chỉ chạy trên máy
   có `conformance/private/`, và chỉ in tên file.
4. Test của công cụ: `pnpm test:recipe` (chỉ dùng mẫu README công khai; CI cũng chạy).
5. Che giá trị: mỗi vị trí (tính từ cuối trường) có một hoán vị bí mật của 0–9, sinh từ khoá ngẫu nhiên mỗi lần chạy (không lưu). Chữ số được thay theo hoán vị đó,
   trường, nên hai trường có cùng đuôi số vẫn cùng đuôi sau khi che. Chữ cái trong số tài khoản, mã tham chiếu… thành
   `X`/`x`, trừ tiền tố ví đã biết và dạng số tài khoản ví (`99ZP…M…`, `99MM…M…`). Sub-tag `00` của template chỉ giữ
   khi là AID hoặc tên miền ngược. Mỗi lần chạy lại cho chữ số giả khác.
