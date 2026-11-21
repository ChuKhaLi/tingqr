# Thiết kế: `@tingqr/render` (Plan 4)

Ngày: 2026-11-19. Dựa trên spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 2, 3, 5.6). Mục ghi
**[chủ dự án]** là chủ dự án đã quyết; mục **[Claude]** là đề xuất của Claude, chủ dự án có thể sửa.

## 1. Mục đích

- Biến chuỗi QR mà `@tingqr/core` tạo ra thành **ảnh QR quét được**, để:
  1. **Quét thử bằng app thật lần đầu.** Đây là khoảng trống bằng chứng lớn nhất hiện nay: VietQR, VNPAY, PromptPay,
     KHQR đều chưa quét bằng app nào.
  2. Dùng thật: **hiện trên màn hình máy tính hoặc máy POS**, và **in ra giấy hoặc nhựa để treo** ở quầy. **[chủ dự án]**
  3. Làm nền cho `@tingqr/angular` (Plan 6) và Noel tree (Angular 21 SSR trên Cloudflare Workers).
- **Thành công** là:
  - ma trận khớp từng ô với bộ mã hoá Nayuki gốc trên mọi mẫu thử;
  - SVG hiện đúng trên trình duyệt và in được;
  - chủ dự án quét được **VietQR** tạo từ tài khoản của chính mình bằng app ngân hàng thật, kể cả bản có logo, thấy đúng
    người nhận và số tiền, rồi ghi kết quả vào repo. **[chủ dự án, 2026-11-19]**
- **Plan 4 xong khi** trang quét thử chạy được và bảng `conformance/scans.md` (còn trống) đã commit. Kết quả quét do chủ
  dự án làm sau. Nếu kết quả cho thấy cần sửa giới hạn logo, đó là một bản sửa riêng. Mọi giới hạn logo trong tài liệu
  này là **tạm thời** cho tới khi có kết quả quét. **[Claude]**

## 2. Phạm vi

**Làm:**
- Gói mới `ts/packages/render` → `@tingqr/render`, gồm `toMatrix(text, options)` và `toSvg(text, options)`. **[chủ dự án,
  2026-11-18]**
- Bộ mã hoá QR **port nguyên vẹn** từ Nayuki QR Code generator (TypeScript, MIT). **[chủ dự án]**
- **Ô logo ở giữa**, làm ngay trong Plan 4. **[chủ dự án, 2026-11-19]**
- Loại mẫu thử mới: **mẫu ma trận** (`conformance/vectors/render/`), sinh từ Nayuki gốc chạy làm oracle. **[chủ dự án]**
- **Trang quét thử** và bảng ghi kết quả quét. **[Claude]**

**Không làm:**
- PNG, PDF, ảnh có khung trang trí (tên ngân hàng, tên chủ tài khoản, số tiền quanh QR). Spec để phần này cho gói vẽ ảnh
  dành cho máy chủ, sau v0.1. **[chủ dự án]**
- Logo ngân hàng đóng gói sẵn (`@tingqr/bank-logos`, Plan 5). Plan 4 chỉ nhận logo do người dùng đưa vào.
- Bản .NET (`TingQR.Rendering`, Plan 8). Nhưng mẫu ma trận phải đủ để bản .NET kiểm.
- Component Angular (Plan 6).

**Không được xảy ra (dù code chạy):**
- Ma trận khác Nayuki gốc với cùng chuỗi và cùng tuỳ chọn.
- Âm thầm đổi đầu vào: ví dụ người dùng chọn mức sửa lỗi L kèm logo mà tingqr tự đổi sang H không báo.
- Tạo ra QR mà máy quét khó đọc, mà không có cảnh báo nào: màu ô nhạt hơn nền, logo quá to, thiếu viền.
- Chèn được nội dung tuỳ ý vào SVG qua `href` của logo hay màu (SVG được nhúng vào trang web; đây là lỗ hổng XSS).

## 3. Ràng buộc

- `@tingqr/render` **không có dependency lúc chạy ngoài `@tingqr/core`** (để dùng chung `TingQrError` và mã lỗi), không
  import `node:*` trong `src/`, chạy được trên trình duyệt, Node, Cloudflare Workers và Angular SSR. Không dùng DOM:
  `toSvg` trả về **chuỗi**. **[Claude]**
- Đầu ra kép ESM và CJS, kèm file kiểu, build bằng tsup (spec 5.3). Gói chỉ có một entry.
- Mã lỗi lấy từ `conformance/errors.json`. Không thêm mã mới: đầu vào sai dùng `INVALID_VALUE`. **[Claude]**
- **Giữ header giấy phép Nayuki** trong file port, kèm ghi công trong `NOTICE` của gói và của repo. **[chủ dự án]**
- **Conformance trước, code sau** (CLAUDE.md): mẫu ma trận có trước, code port sau.
- **Chạy oracle phải qua `node conformance/tools/oracle/...`** để chủ dự án được hỏi (thoả thuận trong session
  2026-11-19).
- Chuỗi đầu vào là chuỗi Unicode bất kỳ, kể cả chữ Thái, chữ Khmer (KHQR tag 64). Byte mode mã hoá UTF-8, như Nayuki
  `encodeText`.

## 4. Cách làm đã chọn và các cách đã loại

**Đã chọn: port nguyên file `qrcodegen.ts` của Nayuki** (tag `v1.8.0`, commit
`720f62bddb7226106071d4728c292cb1df519ceb`, 991 dòng), rồi viết `toMatrix`, `toSvg` và logo bên trên. Chủ dự án đồng ý
2026-11-19.

- So được từng dòng với bản gốc, nên dễ review và dễ cập nhật khi Nayuki sửa lỗi.
- Giữ đủ chế độ số, chữ-số (alphanumeric) và byte. Nhiều chuỗi VietQR chỉ gồm chữ số, chữ hoa và dấu cách; ở chế độ
  chữ-số chúng cho QR nhỏ hơn, dễ quét hơn.
- Thư viện .NET mà spec chọn (`manuelbl/QrCodeGenerator`) là bản port trung thành của Nayuki, nên bản .NET dễ khớp ma
  trận.

**Đã loại:**
- **Bọc thư viện QR khác trên npm:** spec cấm. **[chủ dự án]**
- **Tự viết bộ mã hoá từ đầu, chỉ tham khảo Nayuki:** rủi ro sai ở sửa lỗi Reed–Solomon và chọn mask; không so từng
  dòng được.
- **Port rút gọn, chỉ giữ chế độ byte:** ma trận lệch Nayuki với các chuỗi chữ-số, và QR to hơn. Phần bỏ được (ECI,
  chia đoạn thủ công) quá nhỏ, không đáng.

## 5. Thiết kế

### 5.1 Bộ mã hoá port

- Nằm ở `ts/packages/render/src/qrcodegen.ts`, ghi rõ tag và commit nguồn ở đầu file, ngay dưới header giấy phép gốc.
- **Chỉ đổi những gì cần để thành module ES:** `namespace` thành `export`, kiểu `int`/`byte`/`bit` giữ nguyên hoặc
  thành `number`. Không đổi thuật toán, không đổi tên hàm, không "dọn" code. Mọi thay đổi khác so với bản gốc được liệt
  kê trong comment đầu file. **[Claude]**
- `toMatrix` dùng con đường `encodeSegments(QrSegment.makeSegments(text), ecl, minVersion, maxVersion, mask, boostEcl)`,
  tương đương `encodeText` khi tuỳ chọn để mặc định.

### 5.2 `toMatrix(text, options?)`

```ts
type Ecc = 'L' | 'M' | 'Q' | 'H'
interface MatrixOptions {
  ecc?: Ecc            // mặc định 'M' [Claude]
  boostEcc?: boolean   // mặc định true, như Nayuki: nâng mức sửa lỗi nếu vẫn vừa cùng phiên bản
  minVersion?: number  // 1–40, mặc định 1
  maxVersion?: number  // 1–40, mặc định 40
  mask?: number        // 0–7; mặc định tự chọn như Nayuki
}
interface QrMatrix {
  size: number         // số ô mỗi cạnh = 4 × version + 17
  version: number
  ecc: Ecc             // mức thực dùng (có thể cao hơn yêu cầu do boostEcc)
  mask: number
  modules: boolean[][] // modules[y][x], true = ô tối
}
```

- Tuỳ chọn sai (ecc lạ, phiên bản ngoài 1–40, `minVersion` > `maxVersion`, mask ngoài 0–7 hoặc không phải số nguyên)
  thì ném `TingQrError('INVALID_VALUE')`.
- Chuỗi quá dài so với `maxVersion` và mức sửa lỗi thì cũng ném `INVALID_VALUE`, kèm thông báo nói rõ. Không thêm mã
  lỗi mới.
- Mặc định `ecc: 'M'`. Với bảng treo lâu ngày dễ bẩn hay xước, tài liệu khuyên chọn `'Q'`. **[Claude]**

### 5.3 `toSvg(text, options?)`

```ts
interface SvgOptions extends MatrixOptions {
  margin?: number            // viền trắng tính bằng ô, mặc định 4 (chuẩn QR); cho phép 0–16 [Claude]
  foreground?: string        // mặc định '#000000'
  background?: string        // mặc định '#ffffff'; 'transparent' được phép
  size?: number | string     // width/height của thẻ <svg>: số (px) hoặc chuỗi có đơn vị ('40mm', '2in', '100%');
                             // không có thì SVG co giãn theo khung chứa (chỉ có viewBox)
  logo?: LogoOptions
}
```

- **Đầu ra:** một chuỗi `<svg>` hoàn chỉnh, có `viewBox` theo số ô (kể cả viền), `shape-rendering="crispEdges"`, nền là
  một `<rect>`, các ô tối là **một `<path>`**, trong đó các ô liền nhau trên cùng hàng gộp thành một đoạn. Chuỗi gọn, nét
  sắc khi in. **[Claude]**
- **Màu:** chỉ nhận `#rgb` hoặc `#rrggbb` (và `'transparent'` cho nền). **[Claude]**
  - Màu khác dạng: `INVALID_VALUE`.
  - Khi nền không trong suốt: màu ô phải **tối hơn** nền và tương phản WCAG ít nhất **4.5:1**, không thì
    `INVALID_VALUE`. Lý do: QR in màu nhạt hoặc đảo màu (ô sáng trên nền tối) là lỗi hay gặp, nhiều app ngân hàng không
    quét được.
  - Nền `'transparent'` thì không kiểm tương phản. Tài liệu ghi rõ người dùng tự chịu khi in lên nền màu.
- **`size`:** số dương, hoặc chuỗi khớp `^\d+(\.\d+)?(px|mm|cm|in|pt|%)?$`. Sai dạng thì `INVALID_VALUE`.
- **Thoát ký tự:** mọi giá trị đưa vào thuộc tính SVG đều đi qua hàm thoát `& < > " '`, dù đã kiểm dạng trước đó.

### 5.4 Logo ở giữa **[chủ dự án: làm trong Plan 4; chi tiết: Claude]**

```ts
interface LogoOptions {
  href: string          // ảnh logo
  size?: number         // cạnh logo / cạnh vùng QR (không tính viền); mặc định 0.2, tối đa 0.25
  padding?: number      // số ô trống quanh logo, mặc định 1, cho phép 0–4
  background?: string   // nền của vùng logo, mặc định = background của QR
}
```

- **Mức sửa lỗi:**
  - Có logo mà không truyền `ecc`: dùng `'H'`.
  - Có logo mà truyền `ecc` khác `'H'`: ném `INVALID_VALUE`, không tự đổi (mục 2, "không được xảy ra").
- **Vùng xoá:** một hình vuông ở chính giữa. Cạnh logo = `size × số ô của ma trận`, làm tròn lên tới số ô nguyên cùng
  chẵn lẻ với cạnh ma trận để nằm giữa đúng ô. Vùng xoá = cạnh logo cộng thêm `padding` ô mỗi phía.
  - Mọi ô tối trong vùng này bị **xoá khỏi `<path>`** (không chỉ vẽ đè), để máy quét thấy vùng trắng sạch.
  - Logo vẽ bằng `<image href=... preserveAspectRatio="xMidYMid meet">` lên vùng đó, trên một `<rect>` nền.
- **Giới hạn (tạm thời, chờ quét thật):** **[Claude]**
  - `size` ngoài khoảng (0, 0.25] thì `INVALID_VALUE`.
  - Sau khi làm tròn và cộng `padding`, vùng xoá **chiếm quá 10% số ô** của ma trận, hoặc **chạm** vào ba ô vuông định
    vị (finder) kèm dải phân cách, ô thông tin định dạng, hàng/cột timing, hay ô thông tin phiên bản: `INVALID_VALUE`.
    Thông báo nêu rõ lý do và gợi ý giảm `size`/`padding` hoặc tăng `minVersion`.
  - **Không tự tăng `minVersion`** hay tự thu nhỏ logo: đó là âm thầm đổi đầu vào. Với phiên bản nhỏ (1–2), logo mặc
    định sẽ bị từ chối. (Sửa 2026-11-20: các mẫu VietQR của repo ở mức H nằm ở phiên bản 7–12, không phải 3–6 như bản
    đầu ghi; vì vậy mọi VietQR có logo đều xoá pattern căn chỉnh ở giữa, rủi ro ở mục 6.)
  - Pattern căn chỉnh (alignment) ở giữa được phép bị xoá; rủi ro này kiểm bằng quét thật (mục 6).
- **`href` cho phép:** `data:image/png`, `data:image/jpeg`, `data:image/webp`, `data:image/svg+xml` (base64 hoặc không),
  `https:`, `http:`, hoặc đường dẫn tương đối không có `:` trước dấu `/` đầu tiên. Dạng khác (ví dụ `javascript:`) thì
  `INVALID_VALUE`.
- `toMatrix` **không** biết về logo. Ma trận trong mẫu thử là ma trận gốc trước khi xoá ô. Việc xoá ô được kiểm trong test
  của `toSvg`.

### 5.5 Mẫu ma trận (`conformance/vectors/render/`)

- **Thêm `kind: "matrix"`** vào `vectors.schema.json` và vào bảng trong `conformance/README.md`. **[Claude]**
  - Có `input`: `{ text, ecc?, boostEcc?, minVersion?, maxVersion?, mask? }`.
  - Có `expected`: `{ size, version, ecc, mask, rows }`. `rows` là mảng chuỗi, mỗi chuỗi là một hàng, `1` = ô tối,
    `0` = ô sáng.
  - Không có `payload`.
  - **Bộ chạy riêng trong gói `render`** (`ts/packages/render/test/`) gọi `toMatrix(input.text, options)` rồi so từng
    trường với `expected`. Không dùng bộ chạy của `core`, vì `render` phụ thuộc `core`; `core` gọi ngược `render` sẽ thành
    vòng phụ thuộc. Bộ chạy của `core` bỏ qua `vectors/render/`. Quy tắc so sánh ghi trong `conformance/README.md` để bộ
    chạy .NET làm y hệt. **[Claude]**
  - `vectors.schema.json`: nhánh "phải có `payload`" không áp cho `kind: "matrix"`.
- **Oracle:** `conformance/tools/oracle/gen-render.mjs`.
  - Chạy file `qrcodegen.ts` **gốc, không sửa**, ở đúng commit trên. File được tải về và kiểm SHA-256 trước khi chạy.
    Nó dùng `namespace`, nên phải được **dịch** (ví dụ bằng `typescript.transpileModule`; `typescript` thêm vào
    devDependencies của oracle, ghim phiên bản). Chế độ chỉ bỏ kiểu của Node không đủ.
  - Không bao giờ dùng code đã port để sinh mẫu (spec 5.6).
- **Bộ mẫu phải phủ:** **[Claude]**
  - chuỗi thật lấy từ các mẫu đã có: VietQR (có trường hợp chỉ gồm ký tự chữ-số), VNPAY, PromptPay (có chữ Thái), KHQR
    (có chữ Khmer). Ghi `source` trỏ tới mẫu gốc;
  - cả bốn mức sửa lỗi, có `boostEcc` bật và tắt;
  - cả tám mask truyền tay, ít nhất một lần mỗi mask;
  - ba chế độ: chuỗi chỉ có số, chỉ có ký tự chữ-số, và byte;
  - biên phiên bản: phiên bản 1, chuỗi vừa đúng sức chứa của một phiên bản và chuỗi dài hơn một byte, và ít nhất một
    phiên bản ≥ 7 (có thông tin phiên bản trong ma trận). Không cần tới phiên bản 40 (file mẫu sẽ rất to).
- Mẫu `encode-invalid` cho tuỳ chọn sai cũng nằm ở đây (`scheme: "render"`), theo cấu trúc sẵn có.

### 5.6 Trang quét thử và bảng kết quả **[Claude]**

- **Chỉ quét VietQR**, bằng app ngân hàng / ví Việt Nam. PromptPay và KHQR chưa quét. **[chủ dự án, 2026-11-19]**
- **QR thật từ tài khoản của chủ dự án:** **[chủ dự án, 2026-11-19]**
  - Chủ dự án ghi đầu vào VietQR của mình (BIN, số tài khoản, số tiền nhỏ, nội dung) vào
    `conformance/private/scan-inputs.json`. Thư mục này đã bị gitignore và Claude bị chặn đọc (CLAUDE.md).
  - Định dạng file (mảng `{ id, input }`, `input` như của `encodeVietQr`) ghi trong `conformance/README.md`. Có một file
    mẫu dữ liệu giả nằm ngoài `private/`.
  - **Chỉ chủ dự án chạy script khi có file này.** Claude không chạy script với dữ liệu thật và không đọc file HTML sinh
    ra. Script không in số tài khoản ra màn hình, chỉ in số mã và đường dẫn file HTML.
  - Khi quét: dừng ở màn hình xác nhận chuyển khoản, không cần chuyển thật. Nếu chuyển thì chỉ chuyển cho chính mình,
    số tiền nhỏ. Điều này ghi ở đầu trang HTML.
- **Mẫu giả** (các mẫu `valid` có `input` trong `conformance/vectors/vietqr/`) vẫn có trên trang, đánh dấu rõ "tài khoản
  giả: chỉ kiểm app có đọc được mã không, không chuyển tiền".
- Script `ts/packages/render/scripts/scan-sheet.mjs`, chạy sau khi build, **ghi một file HTML** vào thư mục bị gitignore
  (`ts/packages/render/scan-sheet/`). Không có file đầu vào thật thì trang chỉ có mẫu giả.
  - Mỗi mã trong HTML có:
    - `id` mẫu;
    - loại QR;
    - thông tin mong đợi khi quét: ngân hàng hoặc BIN, số tài khoản hoặc đích, số tiền, nội dung;
    - QR không logo và QR có logo (một logo thử, nhúng `data:`, do tingqr tự vẽ, không phải logo ngân hàng thật);
    - QR in ở kích thước cố định, ví dụ 40 mm. Trang có CSS để in được trên giấy A4.
- **Bảng kết quả:** `conformance/scans.md`, có cột:
  - ngày;
  - người quét;
  - app và phiên bản;
  - thiết bị;
  - `id` mẫu (với QR thật: `id` do chủ dự án đặt, không chứa số tài khoản);
  - có hay không có logo;
  - quét trên màn hình hay trên giấy;
  - kết quả: app hiện đúng người nhận, đúng số tiền hay sai, kèm ghi chú.

  Chủ dự án điền. Claude không tự điền kết quả quét.
- README của các loại QR chỉ được đổi "chưa quét bằng app thật" khi bảng có dòng tương ứng.

### 5.7 Đóng gói và kiểm tra

- `ts/packages/render/package.json`:
  - tên `@tingqr/render`;
  - giấy phép MIT;
  - `dependencies` chỉ có `@tingqr/core` (`workspace:*`);
  - `sideEffects: false`;
  - kèm `NOTICE` ghi công Nayuki.
- **Ngân sách tarball 25 KB**, kiểm bằng script giống `check-core-package.mjs` (có thể mở rộng chính script đó). Ngân sách
  này là đề xuất, đo thật rồi chỉnh. **[Claude]**
- **CI:**
  - `ci-ts.yml` đã chạy `pnpm -r` nên tự gồm gói mới; cần kiểm lại các bước typecheck, build và kiểm kích thước;
  - mutation test chạy trên code của tingqr trong `render` (`svg.ts`, logo, kiểm tuỳ chọn), ngưỡng 90% như core;
  - **file Nayuki port không chạy mutation**: nó được kiểm bằng mẫu ma trận, mạnh hơn mutation cho loại code này, và
    nhiều nhánh phòng thủ của nó không có đầu vào nào chạm tới. **[Claude]**

## 6. Rủi ro và cách kiểm

- **Logo che mất phần cần thiết của mã:** ở phiên bản ≥ 7, chính giữa có pattern căn chỉnh; xoá ô ở đó có thể làm một
  số máy quét khó đọc. Kiểm bằng trang quét thử: mỗi mã có bản có logo. Nếu app thật quét lỗi, hạ `size` tối đa hoặc
  không xoá ô thuộc pattern căn chỉnh. Quyết định lúc đó ghi vào spec này.
  - **Kết quả 2026-11-21** (`conformance/scans.md`):
    - **Điều kiện quét:**
      - logo thử của trang quét thử, `size` mặc định 0.2, `padding` 1, mức H;
      - in 40 mm;
      - Samsung Galaxy S22 Ultra, Android 16, quét cả trên màn hình lẫn giấy.
    - **Kết quả:** MB Bank 6.5.31 và MyVIB 1.80.3 đọc bản có logo giống hệt bản không logo, ở mọi mã VietQR của trang.
    - **Quyết định:** giữ nguyên giới hạn (`size` ≤ 0.25, xoá ≤ 10%).
    - **Chưa thử:**
      - `size` 0.25;
      - icon ngân hàng thật của `@tingqr/bank-logos`;
      - iPhone và app khác.

      Muốn nới giới hạn thì phải thử những trường hợp đó trước.
- **Lộ thông tin tài khoản thật:** đầu vào thật chỉ nằm trong thư mục riêng tư, trang HTML nằm ở thư mục bị gitignore,
  bảng `scans.md` chỉ ghi `id`. Claude không chạy script với dữ liệu thật.
- **App ngân hàng từ chối QR chế độ chữ-số:** chưa thấy báo cáo nào, nhưng chưa ai kiểm cho VietQR. Trang quét thử có
  chuỗi VietQR chỉ gồm ký tự chữ-số.
- **Oracle chạy code tải từ mạng:** chỉ chạy đúng file ở commit đã ghim, kiểm SHA-256, chạy qua lệnh mà chủ dự án được
  hỏi trước.

## 7. Để người lập kế hoạch tự quyết

- Chia task và thứ tự (gợi ý: khung gói → mẫu ma trận và oracle → port → `toMatrix` → `toSvg` → logo → trang quét
  thử → đóng gói, CI).
- Cách cụ thể để dịch file Nayuki trong oracle, miễn là chạy đúng file gốc đã kiểm SHA-256.
- Tên file test, cấu trúc thư mục trong `src/`.
- Có mở rộng `check-core-package.mjs` hay viết script riêng cho `render`.
- Danh sách chính xác các chuỗi trong mẫu ma trận, miễn là phủ đủ mục 5.5.
