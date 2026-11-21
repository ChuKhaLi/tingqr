# Thiết kế: danh sách ngân hàng, link mở app, `@tingqr/bank-logos` (Plan 5)

Ngày: 2026-11-20. Dựa trên spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 2, 3, 5.4, 5.5, 5.10).
Mục ghi **[chủ dự án]** là chủ dự án đã quyết; mục **[Claude]** là đề xuất của Claude, chủ dự án có thể sửa.

## 1. Mục đích

- Cho dev Việt **ba thứ đi kèm một QR chuyển khoản**:
  1. tra ngân hàng theo BIN hoặc mã viết tắt (tên ngắn, tên đầy đủ), ví dụ để hiện "MB Bank" khi đọc được BIN `970422`;
  2. link mở thẳng app ngân hàng trên Android và iPhone;
  3. logo ngân hàng và icon app, đóng gói sẵn, chạy offline.
- **Người dùng thật đầu tiên là Noel tree** (`../noel-tree/src/app/tree/bank-apps.ts`, `public/banks/`). Sau v0.1, Noel
  tree bỏ bảng app và 15 icon tự giữ, dùng tingqr thay (spec 5.11).
- **Thành công là:**
  - mọi ngân hàng trong `api.vietqr.io/v2/banks` có trong danh sách, kèm ngày lấy;
  - mỗi app trong danh sách có nguồn, có ngày kiểm gói trên Google Play;
  - 15 app của Noel tree đều có trong danh sách, cho ra **cùng link** như `appLink` của Noel tree, có icon;
  - danh sách tự được kiểm hằng tháng; có thay đổi thì mở issue kèm báo cáo, sửa ở máy rồi mở PR cho chủ dự án duyệt.

## 2. Phạm vi

**Làm:**
- Dữ liệu `conformance/banks/banks.json` và `conformance/banks/bank-apps.json`, kèm JSON Schema. **[Claude]**
- Subpath `@tingqr/core/banks`: dữ liệu, hàm tra cứu, `bankAppLink`. **[Claude]**
- Gói mới `@tingqr/bank-logos`, gồm logo ngang và icon vuông. **[chủ dự án]**
- Script `conformance/tools/banks/update.mjs`, GitHub Action hằng tháng, skill `update-banks`. **[Claude]**
- Tài liệu cho dev về giới hạn mở app trên iOS, Android và trình duyệt trong app (spec 5.5).

**Không làm:**
- **Điền sẵn số tiền và nội dung khi mở app.** `bankAppLink` chỉ mở app. Noel tree tự giữ phần điền sẵn qua
  `dl.vietqr.io`. Sau này có thể thêm tuỳ chọn mà không phá API. **[chủ dự án, 2026-11-20]**
- Gọi mạng lúc chạy. Riêng trường `logoUrl` là link tham khảo tới `cdn.vietqr.io`; tài liệu ghi rõ đây là ngoại lệ của
  "chạy offline" (spec 5.4).
- `encodeVietQr` nhận mã ngân hàng (`'MB'`) thay cho BIN. Dev tự gọi `findBank('MB')?.bin`. API của bộ tạo mã giữ
  nguyên. **[Claude]**
- `decodeVietQr` và `detect` tự gắn tên ngân hàng vào kết quả. Hai hàm này vẫn không phụ thuộc danh sách ngân hàng.
  **[Claude]**
- Nhận diện ví (`provider`): vẫn hoãn theo Plan 2.
- Bản .NET (`TingQR.Core` banks, `TingQR.BankLogos`): làm ở Plan 8. Nhưng dữ liệu, ảnh và mẫu thử phải đủ để bản .NET
  dùng lại nguyên.
- Component chọn app (tấm chọn ngân hàng): việc của `@tingqr/angular` (Plan 6) hoặc của Noel tree.

**Không được xảy ra (dù code chạy):**
- Ghi một app là "đã mở thử trên máy thật" khi chưa ai mở thử (`deviceVerified`).
- Ghi logo là MIT, hoặc thiếu nguồn của một file logo.
- Logo SVG mang theo script, thuộc tính `on*` hay link ra ngoài (logo được nhúng vào trang web; đây là lỗ hổng XSS).
- Import một logo kéo theo mọi logo khác vào bundle.
- Action ghi vào repo, hay script ghi đè các sửa tay đã biết (LPBank, VietABank/Vietbank, BaoViet Bank).
- Test thường (CI, `pnpm test`) gọi mạng.

## 3. Ràng buộc

- `@tingqr/core` vẫn **không có dependency** và chạy được trên trình duyệt, Node, Workers (spec 3). **[chủ dự án]**
- `@tingqr/bank-logos` không có dependency lúc chạy, chạy được trên SSR/Workers (không đọc file lúc chạy). **[chủ dự án]**
- Mã lỗi lấy từ `conformance/errors.json`. Không thêm mã mới nếu `INVALID_VALUE` đủ dùng. **[Claude]**
- **Conformance trước, code sau:** dữ liệu và mẫu thử có trước, code sau.
- Không import JSON nằm ngoài gói: sandbox của Stryker làm gãy đường dẫn. **[Claude, đã báo chủ dự án]**
- Việc gọi mạng (vietqr.io, Google Play, Wikimedia) chỉ nằm trong `update.mjs` và Action. Khi chạy thử ở máy, nói trước
  với chủ dự án là sẽ gọi mạng.
- Gói core hiện 29 852 / 40 000 byte (đo 2026-11-20). Xem mục 6 về kích thước.

## 4. Các cách đã cân nhắc

### 4.1 Dữ liệu ngân hàng vào core thế nào **[Claude, chủ dự án không phản đối]**

| Cách | Được và mất |
|---|---|
| **A. JSON trong `conformance/banks/` là nguồn; script chép sang file TS trong `src/` của core; test bắt lệch** (đã chọn) | Một nguồn cho cả TS và .NET. File TS nằm trong gói nên Stryker và tsup không phải với ra ngoài. Đổi lại phải nhớ chạy script; test bắt lệch nhắc việc đó |
| B. Import thẳng JSON từ `conformance/` | Gãy trong sandbox Stryker, và gói phát hành phụ thuộc đường dẫn ngoài gói |
| C. File TS là nguồn, .NET tự sinh từ TS | Ngược với "conformance là nguồn sự thật chung" |

### 4.2 Phát hành logo **[chủ dự án: cách A]**

| Cách | Được và mất |
|---|---|
| **A. Mỗi logo một module nhỏ trả data URI, kèm file ảnh gốc trong gói** (đã chọn) | Chạy trên SSR/Workers không cần đọc file, bundler chỉ lấy logo được import. Nếu cả ESM lẫn CJS đều chứa base64 thì gói gấp khoảng 3,7 lần dung lượng ảnh (1,1–2,2 MB). Vì vậy **bản CJS trỏ tới file gốc** (mục 5.4), gói còn khoảng 2,3 lần **[chủ dự án, 2026-11-20]** |
| B. Chỉ có file ảnh, dev tự phục vụ | Gói nhỏ nhất, nhưng Workers và SSR phải tự cấu hình asset; không nhúng được vào SVG một cách tự nhiên |
| C. Một module chứa mọi logo | Import một logo là kéo cả 300–600 KB |

### 4.3 Hai loại ảnh **[chủ dự án]**

- **Logo ngang theo ngân hàng**, đặt tên theo BIN: để hiện cạnh tên ngân hàng.
- **Icon vuông theo app**, đặt tên theo `id` app trong `bank-apps.json`: để đặt giữa QR và làm nút mở app.
- Đã loại cách chỉ có một loại: logo ngang không vừa ô vuông giữa QR, còn icon app không có cho ngân hàng không có app
  trong danh sách.

## 5. Thiết kế

### 5.1 `conformance/banks/banks.json` **[Claude]**

```jsonc
{
  "source": "https://api.vietqr.io/v2/banks",
  "fetchedAt": "2026-11-20",
  "banks": [
    {
      "bin": "970422",            // ^\d{6}$
      "code": "MB",               // mã viết tắt của vietqr.io, như trường `code`
      "shortName": "MBBank",
      "name": "Ngân hàng TMCP Quân đội",
      "swift": "MSCBVNVX",        // có thể null
      "logoUrl": "https://cdn.vietqr.io/img/MB.png"
    }
  ]
}
```

- Lấy nguyên từ API, giữ đúng chữ của API (không tự sửa tên). Thứ tự theo `bin` để diff dễ đọc.
- Nếu ngân hàng nào cần sửa tay so với API, ghi trong `conformance/banks/overrides.json` (trường, giá trị, lý do,
  nguồn). Script cập nhật áp sửa tay sau khi tải, nên lần tải sau không xoá mất.
- `banks.schema.json` kiểm dạng. Test kiểm thêm: `bin` không trùng, `code` không trùng (so không phân biệt hoa thường).
  Nếu dữ liệu thật có trùng, dừng lại báo chủ dự án, không tự chọn.

### 5.2 `conformance/banks/bank-apps.json` **[Claude, theo spec 5.5]**

```jsonc
{
  "apps": [
    {
      "id": "tcb",                         // ^[a-z0-9-]+$, không gây nhầm (BaoViet Bank không dùng "bvb")
      "name": "Techcombank Mobile",        // tên trên cửa hàng
      "bin": "970407",                     // null với ví không gắn ngân hàng
      "ios": { "scheme": "tcb" },
      "android": { "package": "vn.com.techcombank.bb.app", "scheme": "tcb", "host": "applink" },
      "confidence": "multi-source",        // hoặc "single-source"
      "sources": [ { "name": "vietqr.io", "url": "...", "checked": "2026-11-20" }, { "name": "qrviet", ... } ],
      "disagreements": [ "..." ],          // nguồn nào khác ý, khác ở đâu; có thể rỗng
      "deviceVerified": [ { "by": "chủ dự án", "os": "Android", "date": "2026-11-18" } ],
      "vietqrAutofill": true               // dl.vietqr.io điền sẵn được cho app này (theo API vietqr.io)
    }
  ]
}
```

- **Phạm vi** như spec 5.5: app mà vietqr.io và ít nhất một nguồn khác cùng liệt kê, cộng các sửa đã biết (LPBank,
  VietABank/Vietbank, `bvb`). App chỉ có một nguồn thì `confidence: "single-source"`. Ví không có scheme (Viettel Money,
  ShopeePay, VNPAY) không đưa vào.
- **Phải có đủ 15 app của Noel tree**, cùng `id` như Noel tree (`mb`, `vcb`, `tcb`, `bidv`, `icb`, `acb`, `vpb`, `tpb`,
  `vba`, `cake`, `ocb`, `shb`, `hdb`, `vib`, `timo`), để Noel tree đổi sang không phải đổi `id` đã lưu trong
  `localStorage`. Các `id` này cũng là `id` của vietqr.io.
- `ios` hoặc `android` có thể vắng nếu app không có trên hệ đó hoặc chưa tìm được scheme.
- `deviceVerified` lúc này chỉ có MB Bank và MyVIB (Android, chủ dự án, spec 5.5).
- `vietqrAutofill` **[Claude]**: chỉ là dữ liệu, không hàm nào của tingqr dùng. Để Noel tree bỏ được bảng riêng mà vẫn
  biết app nào điền sẵn được qua `dl.vietqr.io`. Ghi nguồn là API vietqr.io.
- Các sửa tay đã biết nằm thẳng trong file này, có `disagreements` ghi lý do. Script cập nhật **không bao giờ ghi đè**
  file này; nó chỉ báo khác biệt (mục 5.6).
- **Dữ liệu ban đầu** **[Claude]**: bản nghiên cứu ngày 2026-11-18 (35 app Android, 33 app iOS của vietqr.io; 41 app của
  `qrviet`; ZaloPay; Bao Kim) **không được lưu trong repo**. Vì vậy `update.mjs --seed` tải lại các nguồn đó, ghi một bản
  nháp (kèm bảng các chỗ nguồn khác ý) vào thư mục tạm. Claude soạn `bank-apps.json` từ bản nháp, chủ dự án duyệt trong PR.
  - Trước khi chạy, nói với chủ dự án là sẽ gọi mạng.
  - Giá trị nào không có nguồn thì để trống, không đoán. Gồm cả cặp VietABank/Vietbank: phải lấy từ nguồn, kèm Google
    Play.
  - **"Nguồn khác" cho `multi-source`** (sửa 2026-11-21 sau evidence-review): phải là nguồn **độc lập** với vietqr.io **và ghi đúng** scheme, gói, host mà tingqr tạo ra (`agrees`). `qrviet` và Noel tree chép từ vietqr.io; tài liệu ZaloPay, Bao Kim không công khai bảng scheme. Nguồn độc lập duy nhất lúc này là `vietnam-qr-pay` 1.5.1. Xem `conformance/README.md`.
  - `vietnam-qr-pay` chỉ tính là nguồn cho scheme. Tên gói Android lấy từ đó thì phải có `playVerified`.
- **Không sao chép icon từ Noel tree.** Icon tải mới để manifest có URL và SHA-256 tự lấy. Có thể so với file của Noel tree
  để bắt sai. **[Claude]**
- **Link iOS khác Noel tree:** Noel tree dùng một scheme cho cả hai hệ và chỉ mở thử trên Android. Nếu nguồn cho scheme iOS
  khác với Noel tree, theo nguồn và ghi vào `disagreements`. Tiêu chí "cùng link với Noel tree" (mục 1) chỉ áp cho
  Android, và cho iOS ở những app mà nguồn không khác ý. **[Claude]**
- `bank-apps.schema.json` kiểm dạng. Test kiểm thêm: `id` không trùng; mọi `bin` khác null có trong `banks.json`; mỗi app
  có ít nhất `ios` hoặc `android`; `single-source` khi và chỉ khi `sources` có đúng một nguồn.

### 5.3 `@tingqr/core/banks`

**Chép dữ liệu:** script `conformance/tools/banks/sync-ts.mjs` sinh `ts/packages/core/src/banks/data.ts` từ hai file JSON
(chỉ các trường mà API dùng; `sources`, `disagreements`, `deviceVerified` giữ lại hay bỏ là việc của builder, tuỳ kích
thước). Test so file sinh ra với file chạy script ngay lúc test; lệch thì báo kèm lệnh cần chạy. File `data.ts` không chạy
mutation.

**API** (tên chính xác là việc của builder, giữ các khái niệm): **[Claude]**

```ts
interface Bank { bin: string; code: string; shortName: string; name: string; swift: string | null; logoUrl: string }
interface BankApp {
  id: string; name: string; bin: string | null
  ios?: { scheme: string }
  android?: { package: string; scheme: string; host: string }
  confidence: 'multi-source' | 'single-source'
  vietqrAutofill: boolean
}
type AppPlatform = 'android' | 'ios'

const BANKS: readonly Bank[]
const BANK_APPS: readonly BankApp[]
function findBank(binOrCode: string): Bank | undefined      // BIN 6 số, hoặc code/shortName không phân biệt hoa thường
function findBankApp(id: string): BankApp | undefined
function appsForBank(bin: string): BankApp[]
function bankAppLink(appId: string, platform: AppPlatform, options?: { fallbackUrl?: string }): string
```

- **Không xuất từ `@tingqr/core` gốc**, chỉ từ subpath `@tingqr/core/banks`, để người chỉ cần VietQR không phải mang
  danh sách. Bản CJS của subpath này là một bundle riêng (không phải file một dòng trỏ về `index.cjs` như các subpath
  khác, vì `index.cjs` không chứa dữ liệu ngân hàng). **[Claude]**
- Tra cứu không tìm thấy thì trả `undefined`, không ném lỗi.
- **`bankAppLink`** **[spec 5.5]**:
  - Android: `intent://<host>#Intent;scheme=<scheme>;package=<package>;S.browser_fallback_url=<url>;end`. Không có
    `fallbackUrl` thì bỏ phần `S.browser_fallback_url`. Không có `fallbackUrl` và `host` rỗng thì phải ra **đúng chuỗi**
    `appLink` của Noel tree.
  - iOS: `<scheme>://`. `fallbackUrl` bị bỏ qua trên iOS (không có cơ chế tương đương); tài liệu ghi rõ.
  - Ném `TingQrError('INVALID_VALUE')` khi: `appId` không có trong danh sách; app không có trên hệ được hỏi; `platform`
    lạ; `fallbackUrl` không phải `https:` hoặc `http:` hợp lệ. Đây là lỗi lập trình, cùng cách với `encode` (spec 5.3).
  - `fallbackUrl` được mã hoá phần trăm (`encodeURIComponent`) trước khi đặt vào `intent://`, để `;` và `#` trong URL
    không cắt mất link. **[Claude]**
- **Mẫu thử cho `bankAppLink`** (để bản .NET ra cùng chuỗi): loại mẫu mới `kind: "link"`, `scheme: "bank-app-link"`, nằm ở
  `conformance/vectors/bank-app-link/`. `input` = `{ appId, platform, fallbackUrl? }`, `expected` = chuỗi link; mẫu
  `encode-invalid` cho các lỗi trên. Thêm vào `vectors.schema.json` và bảng trong `conformance/README.md`. **[Claude]**
  - Nguồn của chuỗi mong đợi: link do Noel tree tạo ra (app đã mở thử: MB, MyVIB) và quy tắc trong `bank-apps.json`. Ghi
    `source` rõ ràng; không ghi "đã mở thử" cho app chưa ai mở.

### 5.4 `@tingqr/bank-logos` **[chủ dự án: hai loại ảnh, cách A; chi tiết: Claude]**

**Ảnh gốc** nằm ở `conformance/banks/logos/`, dùng chung cho bản .NET sau này:

```
conformance/banks/logos/
├─ logo/<bin>.svg | <bin>.webp     ← logo ngang theo ngân hàng (PNG của vietqr.io thu về WebP 128 px, chủ dự án chọn 2026-11-21)
├─ icon/<appId>.webp               ← icon vuông theo app
└─ manifest.json                   ← mỗi file: nguồn (URL), nhãn giấy phép (PD-textlogo, PD-simple, hoặc "trademark,
                                     no license" với cdn.vietqr.io), ngày tải, SHA-256
```

- **Nguồn** (spec 5.4):
  - Logo ngang: SVG trên Wikimedia Commons gắn **PD-textlogo** hoặc **PD-simple**; còn lại PNG `cdn.vietqr.io/img/`. Bỏ
    file Commons gắn CC BY-SA.
  - Icon vuông: `cdn.vietqr.io/bank-app-icon/<id>-ios.webp`, như Noel tree (riêng `vib` lấy `vib-2-ios.webp`; manifest ghi
    URL thật đã tải).
  - Nhãn giấy phép Commons: đọc qua API của Commons lúc tải và ghi vào manifest. Chủ dự án duyệt từng file trong PR, vì
    PR không bao giờ tự gộp. **[Claude]**
- **Giữ nguyên file tải về** khi có thể, như Noel tree. Nếu tổng gói vượt ngân sách (mục 6), thêm bước thu nhỏ trong script
  cập nhật (không phải lúc build gói), và manifest ghi file đã bị thu nhỏ. **[Claude]**
- **Làm sạch SVG:** test từ chối SVG có `<script>`, `<foreignObject>`, thuộc tính `on*`, hay `href`/`xlink:href` không phải
  `#...`. File nào vi phạm thì không đưa vào (dùng PNG thay), không tự sửa SVG. **[Claude]**
- **Icon giữa QR là tạm thời** cho tới khi có kết quả quét bản có logo (thiết kế Plan 4, mục 5.4 và 6). README ghi rõ. **[chủ
  dự án]**

**Gói** `ts/packages/bank-logos`:
- Build sinh từ `conformance/banks/logos/` (chép vào gói lúc build, không đọc ngoài gói lúc chạy):
  - `@tingqr/bank-logos/logo/<bin>` và `@tingqr/bank-logos/icon/<appId>`, có kèm `.d.ts`.
    - **Bản ESM** `export default` một chuỗi data URI (`data:image/webp;base64,...`, `data:image/svg+xml;base64,...`).
    - **Bản CJS không chứa base64:** nó trả **đường dẫn tuyệt đối tới file ảnh gốc** trong gói. Mục đích là không lưu
      base64 hai lần. **[chủ dự án, 2026-11-20]**
    - Hai bản trả hai thứ khác nhau, nên kiểu (`.d.ts` / `.d.cts`) và README phải ghi rõ. Người dùng CJS cần data URI thì
      tự đọc file.
  - File ảnh gốc ở `@tingqr/bank-logos/files/logo/...` và `files/icon/...`, cho ai muốn tự phục vụ ảnh tĩnh.
  - Gốc `@tingqr/bank-logos` chỉ xuất danh sách có gì (`LOGO_BINS`, `ICON_IDS`), **không chứa ảnh**.
- `exports` dùng mẫu `"./logo/*"`, `"./icon/*"`, `"./files/*"`. `sideEffects: false`.
- Cách dùng mẫu trong README: import tĩnh một icon; import động theo `id` người dùng chọn; đặt icon giữa QR qua
  `toSvg(payload, { logo: { href: icon } })` của `@tingqr/render`.
- **Giấy phép:** code của gói là MIT; ảnh **không** MIT. Gói có `LICENSE` (MIT, cho code) và `LOGOS-NOTICE.md` theo spec
  5.4 (thương hiệu của từng ngân hàng, VietQR và NAPAS247 là của NAPAS; chỉ dùng để nhận diện; nguồn từng file sinh từ
  manifest; cách liên hệ để yêu cầu sửa hoặc gỡ). Trường `license` trong `package.json`: `"SEE LICENSE IN LOGOS-NOTICE.md"`,
  và `LOGOS-NOTICE.md` nói rõ code là MIT. **[Claude]**
- Không phụ thuộc `@tingqr/core`.

### 5.5 Phạm vi ảnh

- Logo ngang: mọi ngân hàng trong `banks.json` có logo tải được.
- Icon: mọi app trong `bank-apps.json` có icon trên `cdn.vietqr.io`. App không có icon thì không có module; `ICON_IDS` cho
  dev biết.

### 5.6 Bảo trì tự động **[Claude, chủ dự án không phản đối]**

**Script `conformance/tools/banks/update.mjs`** (Node, có `package.json` riêng như `tools/oracle/` nếu cần gói ngoài):
1. Tải `api.vietqr.io/v2/banks`, áp `overrides.json`, ghi lại `banks.json` (kèm `fetchedAt`). Đây là file duy nhất script
   được ghi đè.
2. Tải `api.vietqr.io/v2/android-app-deeplinks` và `ios-app-deeplinks`, **so** với `bank-apps.json`, in báo cáo: app mới,
   app biến mất, scheme/gói khác. Không sửa `bank-apps.json`.
3. Kiểm gói Android trên Google Play cho từng app.
   - Trang chi tiết trả 200: cập nhật ngày kiểm.
   - Trả 404: báo "gói không còn".
   - Mã khác (bị chặn, giới hạn tần suất): báo "chưa kiểm được", **không** coi là mất gói.

   Ngày kiểm nằm ở **file riêng do script quản lý**, `conformance/banks/play-checks.json` (gói → ngày kiểm được gần nhất,
   kết quả lần gần nhất). Nhờ vậy script không phải đụng `bank-apps.json`. Trường `playVerified` ở mục 5.2 chuyển sang file
   này; test đọc từ đây (`sync-ts` không đưa file này vào API). **[Claude]**
4. Kiểm link ảnh (`logoUrl`, URL trong manifest) còn sống; với `--fetch-logos` thì tải ảnh của ngân hàng/app mới và ảnh có
   SHA-256 đổi, cập nhật manifest. Ảnh đổi được nêu trong báo cáo.
5. Chạy `sync-ts.mjs`.
6. Ghi báo cáo Markdown (dùng làm nội dung PR) ra một file tạm.

**Action `.github/workflows/update-banks.yml`:** chạy ngày đầu mỗi tháng, và chạy tay được (`workflow_dispatch`). **Action
không mở PR, chỉ mở issue.** **[chủ dự án, 2026-11-20]**
- Action chạy `update.mjs --check`: tải, so sánh, kiểm Google Play, kiểm link ảnh, nhưng **không ghi file nào** trong repo.
- Có khác biệt thì mở **một** issue có nhãn cố định (ví dụ `update-banks`), nội dung là báo cáo. Nếu issue cùng nhãn còn
  mở thì thêm bình luận vào đó thay vì mở issue mới. Không có gì đổi thì không làm gì.
- Quyền của workflow: chỉ `contents: read` và `issues: write`. Không cần token riêng hay bật cài đặt repo nào.
- Sửa dữ liệu là việc làm ở máy: chủ dự án hoặc Claude chạy `update.mjs` (có ghi file, có `--fetch-logos`) theo skill
  `update-banks`, rồi mở PR như mọi thay đổi khác. Lúc đó CI chạy bình thường.

**Skill `.claude/skills/update-banks/SKILL.md`:** khi nào chạy, lệnh, cách đọc báo cáo, cách xử lý từng loại khác biệt (app
mới cần nguồn thứ hai trước khi vào `multi-source`; gói không còn thì tìm gói thay; ngân hàng đổi tên), nhắc lại là chạy ở
máy sẽ gọi mạng.

### 5.7 Tài liệu cho dev

README của core (mục banks) và của `bank-logos` nêu những điều ở spec 5.5:
- iOS chỉ mở scheme trong thao tác bấm của người dùng; app native cần `LSApplicationQueriesSchemes` (tối đa 50).
- App Android gọi từ code cần khai `<queries>` hoặc bắt `ActivityNotFoundException`.
- Trình duyệt trong Zalo, Messenger, Facebook, TikTok hay chặn scheme và `intent://` (chưa tự thử, ghi đúng như vậy).
- `bankAppLink` chỉ mở app, không điền sẵn; app nào đã có người mở thử trên máy thật thì xem `deviceVerified` trong
  `bank-apps.json`.

## 6. Rủi ro và cách kiểm

- **Gói core vượt ngân sách 40 000 byte:** dữ liệu ngân hàng (~76 ngân hàng, ~40 app) thêm vào cả ESM lẫn CJS. Đo sau khi
  có dữ liệu thật. Nếu vượt: bớt trường không dùng trong `data.ts` trước; vẫn vượt thì hỏi chủ dự án nâng ngân sách, không
  tự nâng. `check-core-package.mjs` thêm kiểm subpath `banks` nạp được bằng CJS.
- **Gói `bank-logos` to:** ước tính 300–600 KB ảnh. Gói gấp khoảng 2,3 lần dung lượng ảnh, vì có file gốc cộng base64 ở
  bản ESM. Đặt ngân sách sau khi đo, bằng một
  script giống `check-render-package.mjs`. Đây là gói tự chọn dùng và bundler chỉ lấy logo được import, nên kích thước gói
  không ảnh hưởng người dùng nhiều như core.
- **Google Play chặn máy chạy GitHub Actions:** kết quả "chưa kiểm được" không làm hỏng `playVerified` cũ; báo cáo nêu số
  app chưa kiểm được.
- **vietqr.io đổi dạng API:** script kiểm dạng phản hồi trước khi ghi; sai dạng thì dừng, không ghi file.
- **Nhãn PD theo luật Mỹ, chưa chắc theo luật Việt Nam** (spec 5.4 [?]): `LOGOS-NOTICE.md` không khẳng định ảnh nào "tự do
  dùng", chỉ ghi nhãn của nguồn.
- **Icon giữa QR chưa quét thử:** như thiết kế Plan 4 mục 6. README ghi là tạm thời.

## 7. Để người lập kế hoạch tự quyết

- Chia task và thứ tự (gợi ý: schema và dữ liệu → `sync-ts` → API banks + mẫu `bank-app-link` → `update.mjs` (chạy thử
  ở máy, có hỏi trước vì gọi mạng) → ảnh và manifest → gói `bank-logos` → Action → skill → tài liệu).
- Tên chính xác của hàm và kiểu, giữ khái niệm ở 5.3.
- Trường nào của JSON đi vào `data.ts`.
- Cách sinh module data URI trong gói `bank-logos` (script trước tsup, hay plugin của tsup).
- Có gộp `check-render-package.mjs` và script kiểm `bank-logos` thành một không.
