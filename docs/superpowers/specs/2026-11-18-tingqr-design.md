# tingqr: thiết kế tổng thể

Ngày 2026-11-18. Trạng thái: **chủ dự án duyệt 2026-11-18** ("ok rồi, làm plan đi"). Đã qua một lượt đọc thử của builder.

Ký hiệu:
- **[chủ dự án]**: chủ dự án đã quyết, không tự đổi.
- **[Claude]**: Claude tự quyết, chủ dự án có thể sửa.
- **[?]**: chưa kiểm chứng.

Nghiên cứu nền: `docs/huong-di/2026-11-18-nghien-cuu-va-huong-di.md`. Định dạng QR, các thư viện hiện có và các tuyến
xuyên biên giới đều nằm ở đó. Tài liệu này không chép lại.

## 1. Ý định

- tingqr là **SDK mã nguồn mở cho dev**, dùng để tạo, đọc và nhận diện QR thanh toán. Lấy Việt Nam làm đầu tàu, rồi đi
  trước ở QR xuyên biên giới. **[chủ dự án]**
- **Lý do:** chủ dự án muốn có một thư viện mã nguồn mở có tiếng. **[chủ dự án]**
  - Dùng phụ trong Noel tree (`../noel-tree`). Noel tree đã có code VietQR riêng chạy ổn, nên không ép lịch ra mắt.
- **Ảnh hưởng tới thiết kế:** dev là người dùng, nên ưu tiên ba thứ:
  - API có kiểu rõ ràng.
  - Lỗi báo rõ ràng.
  - Bằng chứng mọi thứ chạy đúng: mẫu thử có nguồn, bảng thử trên app thật.
- **Câu giới thiệu bản ra mắt:** "Đọc mọi QR mà app ngân hàng Việt Nam quét được."

## 2. Mục tiêu, không làm, thất bại dù chạy được

### Mục tiêu bản ra mắt (v0.1, chỉ TypeScript) **[chủ dự án]**

- **QR Việt Nam:**
  - Tạo và đọc VietQR: chuyển vào tài khoản (`QRIBFTTA`) hoặc vào thẻ (`QRIBFTTC`), QR tĩnh và QR có số tiền.
  - Đọc VNPAY-QR.
  - Nhận ra QR của MoMo và ZaloPay. Thực chất đó là VietQR đi qua BIN `970454` hoặc `971025`.
- **Xuyên biên giới:** tạo và đọc PromptPay (Thái Lan) và KHQR (Campuchia).
- **`detect(payload)`:** đưa vào một chuỗi bất kỳ, trả về loại QR kèm dữ liệu có kiểu đầy đủ, hoặc một lỗi có lý do.
- **Kiểm CRC và báo lỗi:**
  - Trường dài quá 99 ký tự, ký tự ngoài ASCII hay CRC sai đều phải báo lỗi.
  - Không bao giờ âm thầm tạo ra chuỗi hỏng. Đây là lỗi đang có ở `vietnam-qr-pay` (issue #15).
- **Danh sách ngân hàng Việt Nam:** BIN, mã viết tắt, tên, logo (xem 5.4).
- **Link mở app ngân hàng** cho Android và iPhone (xem 5.5).
- **Vẽ QR thành SVG** ở gói `@tingqr/render`, chạy được trên trình duyệt, Node và Workers.
- **Gói Angular** (component, pipe) và **gói NestJS** (module, service).
- **Bộ mẫu thử dùng chung** ở `conformance/` (xem 5.2), dựng ngay từ đầu để bản .NET dùng lại.

### Ngay sau v0.1 (v0.2) **[chủ dự án]**

- Bản .NET (`TingQR.Core`, `TingQR.AspNetCore`), chạy đạt cùng bộ mẫu thử với bản TypeScript.

### Về sau (chưa xếp thứ tự)

- LAO QR, chờ có mẫu QR thật. **[chủ dự án]**
- Singapore, Malaysia, Indonesia, Philippines.
- UPI, khi tuyến Việt Nam – Ấn Độ chạy.
- VIETQRGlobal, khi NAPAS công bố khác biệt so với VietQR trong nước.
- Ảnh PNG và ảnh có khung trang trí. Đây là gói riêng cho máy chủ, được dùng thư viện native. **[chủ dự án]**: lõi không
  bắt buộc thuần JS.
- Bản cho các ngôn ngữ khác.

### Không làm

- Xác nhận đã nhận tiền, webhook, đối soát giao dịch. Đó là việc của SePay hay ngân hàng.
  - README phải ghi rõ điều này ngay đầu, vì tên "ting" dễ làm dev Việt tưởng thư viện lo việc này.
- Gọi API của vietqr.io hay bất kỳ dịch vụ nào lúc chạy. Mọi việc đều chạy offline.
- QR do khách hàng hiển thị (TCCS 04:2024).

### Thất bại dù chạy được

- Bộ mẫu thử chứa chuỗi QR do mình tự bịa, không có nguồn.
- README hay bảng thử ghi "chạy với app X" khi chưa ai quét thật bằng app X.
- Hai bản TypeScript và .NET cho kết quả khác nhau trên cùng một đầu vào.
- Thêm tag EMV tuỳ ý vào VietQR khiến app ngân hàng từ chối quét.

## 3. Ràng buộc

- **Phiên bản hỗ trợ tối thiểu:** **[Claude]**
  - Node 20 trở lên.
  - Angular 20 trở lên. Noel tree dùng Angular 21 SSR trên Cloudflare Workers, nên component phải render được ở SSR.
  - NestJS 10 trở lên.
  - .NET 8 trở lên. Phần lõi có thêm `netstandard2.0` nếu không tốn nhiều công.
- **Chỉ riêng `@tingqr/core` không có dependency** và chạy được trên trình duyệt, Node và Workers. **[chủ dự án, 2026-11-18]**
  - Lõi chỉ dựng, đọc và nhận diện chuỗi QR, vốn không cần gói nào. Lý do giữ: đây là điểm người dùng đánh giá cao nhất ở
    thư viện đang dẫn đầu.
  - **Các gói tích hợp được dùng gói ngoài** (Angular, NestJS, ASP.NET Core). Riêng bộ mã hoá QR thì không bọc thư viện
    QR khác mà port vào tingqr (5.6). **[chủ dự án, 2026-11-18]**
  - Thư viện native chỉ dùng trong gói vẽ ảnh dành cho máy chủ (PNG, ảnh có khung trang trí; sau v0.1).
- **Giấy phép:** MIT. Ghi công vietqr-node (MIT, Casso) ở những file được port từ đó. **[Claude]**
- **Repo trên GitHub:** đặt dưới tài khoản cá nhân của chủ dự án, như `zkteco-protocol` và `nom-na`. Có thể chuyển sang
  một organization sau. **[Claude]**
- **Mã nguồn bên thứ ba có giấy phép GPL hoặc không ghi giấy phép:** không đọc để chép. Nếu cần thì chỉ chạy để so kết quả.
  Theo cách đã làm ở `zkteco-protocol`.

## 4. Các cách đã cân nhắc

| Cách | Mô tả | Được và mất |
|---|---|---|
| **A. Một repo, chia theo ngôn ngữ, có `conformance/` chung** | `ts/` (pnpm workspace), `dotnet/` (`.sln`), `conformance/` | Mỗi ngôn ngữ dùng đúng công cụ của nó. Mọi sao và issue dồn về một repo. Đổi lại, CI phải chạy hai hệ |
| B. Một repo, chia theo gói | `packages/core/{ts,dotnet}`… | Cấu hình workspace và solution phải trỏ chéo nhau. Gói Angular và NestJS không có bản .NET tương ứng, nên cấu trúc bị lệch |
| C. Ba repo riêng | `tingqr-spec`, `tingqr-js`, `tingqr-dotnet` | Sao và issue bị chia ba, mẫu thử dễ lệch nhau giữa các repo |

**Chủ dự án chọn A. [chủ dự án]**

**Có dùng Nx hay Turborepo không? Không. [chủ dự án]**
- Turbo không hỗ trợ .NET sẵn.
- Nx có `@nx/dotnet` (từ Nx 22), nhưng với vài gói như tingqr thì cache và "chỉ chạy phần bị ảnh hưởng" gần như không
  có lợi. Thứ ràng hai ngôn ngữ là file JSON, Nx không theo dõi được.
- Nx còn tạo thêm rào cản cho người muốn đóng góp.
- Xem lại khi repo có khoảng 8–10 gói trở lên hoặc CI chạy quá 10 phút. Khi đó chọn Nx.

**Thứ tự ra mắt:**
- Cách 2 được chọn: chỉ TypeScript nhưng có xuyên biên giới, .NET ra ngay sau. **[chủ dự án]**
- Các cách đã bỏ:
  - Chỉ có phần Việt Nam: không có gì "đi trước".
  - Hai ngôn ngữ cùng ngày: chủ dự án từng chọn rồi đổi lại.

## 5. Thiết kế

### 5.1 Cấu trúc repo **[chủ dự án: cách A; chi tiết: Claude]**

```
tingqr/
├─ conformance/              ← nguồn sự thật chung, không thuộc ngôn ngữ nào
│  ├─ schemes/<id>.md        ← mô tả từng loại QR: tag, GUID, quy tắc, nguồn
│  ├─ vectors/<id>/*.json    ← mẫu thử (5.2)
│  ├─ vectors.schema.json    ← JSON Schema cho file mẫu thử
│  └─ banks/                 ← banks.json, bank-apps.json (5.4, 5.5)
├─ ts/                       ← pnpm workspace
│  ├─ packages/core          ← @tingqr/core (không dependency)
│  ├─ packages/render        ← @tingqr/render (SVG, bộ mã hoá QR port từ Nayuki, không dependency)
│  ├─ packages/angular       ← @tingqr/angular (ng-packagr)
│  ├─ packages/nestjs        ← @tingqr/nestjs
│  └─ packages/bank-logos    ← @tingqr/bank-logos (logo, không thuộc MIT, 5.4)
├─ dotnet/                   ← v0.2
│  ├─ TingQR.sln
│  ├─ src/TingQR.Core, src/TingQR.AspNetCore, src/TingQR.BankLogos
│  └─ tests/
├─ docs/
│  ├─ superpowers/specs, plans
│  ├─ huong-di/
│  └─ conformance-matrix.md  ← bảng thử trên app thật (5.7)
├─ .github/workflows/        ← ci-ts, ci-dotnet, release-npm, release-nuget
├─ package.json              ← lệnh gom chung: test:all, build:all
└─ CLAUDE.md, ts/CLAUDE.md, dotnet/CLAUDE.md, .claude/
```

### 5.2 Mẫu thử dùng chung

- Mỗi mẫu là một file JSON có các trường:
  - `id`, `scheme`;
  - `payload`: chuỗi QR;
  - `expected`: dữ liệu đọc ra mong đợi;
  - `kind`: `valid`, `invalid` hoặc `lenient`;
  - `error`: mã lỗi mong đợi khi mẫu không hợp lệ;
  - `source`: bắt buộc. Có thể là "đặc tả X trang Y", "app Z chụp ngày D", hoặc "mẫu trong repo R (giấy phép L)".
- **Chiều đọc:** cả hai bản đều đọc `payload` và phải ra đúng `expected`.
- **Chiều tạo:** với mẫu `valid` có `expected`, tạo lại từ `expected` phải ra **đúng từng byte** của `payload`, trừ khi
  mẫu ghi `roundTrip: false`. Ví dụ QR thật có thứ tự tag khác thứ tự mình tạo.
- Mẫu `invalid` dùng để bắt lỗi: CRC sai, độ dài sai, trường quá 99 ký tự, ký tự ngoài ASCII, thiếu tag bắt buộc.
- **Mã lỗi là một bảng chung cho cả hai ngôn ngữ,** đặt trong `conformance/`. Ví dụ `CRC_MISMATCH`, `FIELD_TOO_LONG`,
  `NON_ASCII`, `MISSING_TAG`, `UNKNOWN_SCHEME`.
- CI kiểm mọi file mẫu khớp `vectors.schema.json`.
- **Nguồn mẫu được phép** **[Claude]**: đặc tả công khai; repo có giấy phép MIT, Apache, BSD hoặc tương đương (ghi giấy phép
  vào `source`); QR thật chụp theo quy tắc riêng tư ở 5.2a. Không lấy chuỗi từ repo GPL hay không ghi giấy phép, kể cả khi
  chỉ là dữ liệu, cho đồng nhất với quy tắc ở mục 3.

### 5.2a QR thật: mẫu riêng ở máy, công thức lên repo **[chủ dự án]**

- **Phần tạo mã không cần QR thật.** Mẫu thử dùng số tài khoản và tên giả rõ ràng (ví dụ `0123456789`, `NGUYEN VAN A`).
- **Quét thử bằng app** dùng tài khoản thật của chủ dự án, tạo ngay trên máy; bảng thử chỉ ghi kết quả, không ghi chuỗi.
- **QR thật chỉ cần cho phần đọc** những loại mình không tự tạo: VNPAY, MoMo, ZaloPay, QR cửa hàng, QR nước ngoài.
  - Lưu ở `conformance/private/` (nằm trong `.gitignore`), kèm ghi chú nguồn. **Không bao giờ commit.**
  - Một script rút ra **công thức**: thứ tự tag, template lồng, GUID, độ dài và kiểu từng trường, trường có hoặc vắng.
    Giá trị nhạy cảm (số tài khoản, tên, mã tham chiếu) thay bằng giá trị giả cùng độ dài và kiểu, tính lại CRC. Kết quả
    là mẫu thử `derived: true`, `source` ghi "rút từ QR thật của <loại>, chụp ngày D", được commit.
  - CI chạy trên mẫu công thức. Ở máy có `conformance/private/` thì chạy thêm bộ test trên QR thật; không có thì bộ này
    tự bỏ qua, không báo lỗi.
  - Điều gì chỉ kiểm được trên QR thật ở máy thì tài liệu ghi "đã kiểm ở máy chủ dự án ngày D", không ghi là CI đã kiểm.

### 5.3 Lõi và API (TypeScript; .NET dùng cùng tên khái niệm)

- **Tầng EMV:** đọc và ghi TLV (tag 2 ký tự + độ dài 2 chữ số + giá trị), template lồng nhau, CRC16-CCITT-FALSE.
  - **Hai chế độ đọc:**
    - Chặt: theo đúng EMVCo.
    - Chấp nhận lệch chuẩn: cho VNPAY-QR và QR ngoài đời thiếu tag 52 hoặc 60.
  - `detect` dùng chế độ chấp nhận lệch chuẩn và báo các chỗ lệch kèm kết quả.
  - **Mọi hàm đọc mặc định dùng chế độ chấp nhận lệch chuẩn**, mọi chỗ lệch nằm trong `warnings`; chế độ chặt phải
    truyền `{ mode: 'strict' }`. Lý do: VNPAY-QR ngoài đời thiếu tag 52/60, mặc định chặt sẽ báo lỗi với gần như mọi
    QR thật. **[chủ dự án, 2026-11-18]**
- **Mỗi loại QR là một module:** gồm `id`, cách nhận ra (GUID và tag), `encode`, `decode` và kiểu dữ liệu riêng.
  - Module của v0.1: `vietqr`, `vnpay`, `promptpay`, `khqr`.
  - MoMo và ZaloPay là **biến thể nhận diện** của `vietqr` (`provider: 'momo' | 'zalopay'`), không phải module riêng.
    - **[Claude]** Chỉ gán `provider` khi dấu hiệu chắc chắn đã được một mẫu thật có nguồn chứng minh. BIN `970454` là BIN
      của BVBank, nên một mình BIN không đủ để gán ZaloPay hay MoMo. Không chắc thì `provider` để trống; bản ra mắt
      chấp nhận chưa nhận ra được ví nào nếu chưa có mẫu.
- **Ký tự ngoài ASCII** **[Claude]**:
  - Khi **tạo** VietQR: báo `NON_ASCII` (app ngân hàng Việt Nam không chịu chữ có dấu).
  - Khi **đọc**: chấp nhận UTF-8 (KHQR, tag 64 ngôn ngữ khác, tên cửa hàng Thái). Độ dài đếm theo cách đặc tả EMVCo quy
    định; nếu mẫu thật cho thấy app đếm khác, ghi cách đếm theo từng loại QR trong `conformance/schemes/<id>.md` và có mẫu
    thử chứng minh.
  - Tag 64 được đọc và trả về ở mọi loại QR; chỉ tạo tag 64 ở loại nào đặc tả của nó có dùng.
- **`detect(payload)`:** trả về một discriminated union theo trường `scheme`, hoặc lỗi `UNKNOWN_SCHEME` kèm cây TLV thô để
  dev tự xử lý.
- **Import riêng từng module** để bundler bỏ được phần không dùng (ví dụ `@tingqr/core/vietqr`).
- **Đầu ra kép ESM và CJS,** có file kiểu `.d.ts`, build bằng tsup như `zkteco-protocol`.
- **Lỗi trả về dạng gì:** builder chọn giữa ném lỗi và trả về `Result`, nhưng phải thống nhất trong toàn bộ thư viện và
  dịch sang .NET được một cách tự nhiên. Gợi ý **[Claude]**: `decode` và `detect` trả `Result`, còn `encode` ném lỗi có
  mã, vì đầu vào sai ở `encode` là lỗi lập trình.
- **Tiện ích tiếng Việt:** hàm bỏ dấu cho nội dung chuyển khoản. Gọi tự động hay không do dev chọn, mặc định là báo lỗi
  `NON_ASCII` thay vì âm thầm sửa nội dung. **[Claude]**

### 5.4 Danh sách ngân hàng và logo

- **Danh sách** `conformance/banks/banks.json` **[Claude]**: BIN, mã viết tắt, tên ngắn, tên đầy đủ.
  - Lấy từ `api.vietqr.io/v2/banks` (76 ngân hàng ngày 2026-11-18; dữ liệu công khai), ghi ngày lấy.
  - Skill `update-banks` cộng một GitHub Action hằng tháng tự mở PR khi danh sách đổi.
- **Logo đóng gói vào repo** **[chủ dự án]**, theo cách sau **[Claude]**:
  - **Gói riêng, tự chọn dùng:** `@tingqr/bank-logos` và `TingQR.BankLogos`. Lõi không chứa logo, giữ nhỏ và giữ thuần MIT.
    Gói lõi chỉ có `logoUrl` tham khảo (có gọi mạng, ghi rõ là ngoại lệ của "chạy offline").
  - **Logo không thuộc giấy phép MIT.** File `LOGOS-NOTICE.md` (theo mẫu `DISCLAIMER.md` của simple-icons) ghi:
    - logo là thương hiệu của từng ngân hàng, VietQR và NAPAS247 là của NAPAS;
    - chỉ dùng để nhận diện ngân hàng nhận tiền, không ngụ ý liên kết hay được bảo trợ;
    - nguồn của từng file;
    - cách liên hệ để ngân hàng yêu cầu sửa hoặc gỡ.
    Không ghi logo là "MIT" như `vietqr-node` (nguyenchanh0201) đã làm.
  - **Nguồn ưu tiên:** SVG trên Wikimedia Commons gắn nhãn PD-textlogo hoặc PD-simple (đã thấy: BIDV, Techcombank, MB,
    Agribank, VPBank, ACB, TPBank); còn lại lấy PNG từ `cdn.vietqr.io`. Bỏ các file Commons gắn CC BY-SA cho logo ngân hàng
    (người tải lên không có quyền cấp phép). Nhãn PD theo luật Mỹ, chưa chắc theo luật Việt Nam [?].
  - **Chuẩn hoá lúc build:** đặt tên theo BIN, PNG hoặc WebP khoảng 128 px, kèm SVG khi có. Ước tính tổng 300–600 KB
    (76 PNG gốc là 1,62 MB).
  - **Tham khảo:** `VietQR.Core` nhúng khoảng 80 PNG (1,8 MB) vào DLL; `vietqr-zero` nhúng WebP base64 (736 KB); không
    thư viện nào có ghi chú thương hiệu đầy đủ.

### 5.5 Link mở app ngân hàng **[Claude]**

Nghiên cứu ngày 2026-11-18. Nguồn chính là hai API công khai của vietqr.io: `api.vietqr.io/v2/android-app-deeplinks`
(35 app) và `api.vietqr.io/v2/ios-app-deeplinks` (33 app). Đối chiếu với `nghiepdev/qrviet` (41 app, cập nhật 2026-11-16),
`xuannghia/vietnam-qr-pay` (cũ, 8 gói Android đã không còn trên Google Play), tài liệu ZaloPay và Bao Kim. Bảng của Noel
tree khớp với vietqr.io ở cả 15 app nó có.

- **`conformance/banks/bank-apps.json`**, mỗi app gồm:
  - `id`, tên app trên cửa hàng, BIN ngân hàng (nếu có);
  - **scheme riêng cho iOS và Android** (KienlongBank, SAIGONBANK, MyVIB dùng scheme khác nhau giữa hai hệ);
  - gói Android, phần host của `intent://` (Techcombank `applink`, BIDV `payment`, TPBank `onboarding`, SeABank `app`…);
  - `sources`: nguồn nào liệt kê, và nguồn nào khác ý;
  - `playVerified`: ngày kiểm gói còn trên Google Play;
  - `deviceVerified`: ai mở thử trên máy thật, hệ điều hành, ngày. Lúc này chỉ có MB Bank và MyVIB (Android, chủ dự án).
- **Đã biết phải sửa so với vietqr.io:**
  - LPBank: gói `vn.com.lpb.lienviet24h` không còn; gói thật là `vn.com.lpbank.digibank`, scheme `lv24h`.
  - VietABank và Vietbank bị trộn: scheme của VietABank đi với gói của Vietbank.
  - `bvb` của vietqr.io là BaoViet Bank, không phải BVBank (Bản Việt). Đặt `id` không gây nhầm.
- **Phạm vi v0.1:** các app mà vietqr.io và ít nhất một nguồn khác cùng liệt kê, cộng các sửa ở trên. App chỉ có một
  nguồn (Sacombank, MSB, Vikki, Liobank, MoMo, ZaloPay…) được thêm với `confidence: "single-source"`; ví không tìm thấy
  scheme (Viettel Money, ShopeePay, VNPAY) không đưa vào.
- **API:**
  - `bankAppLink(appId, platform, { fallbackUrl })` trả về link mở app, không mang số tiền hay nội dung.
  - Android dùng `intent://…#Intent;scheme=…;package=…;S.browser_fallback_url=…;end`. iOS dùng `scheme://`.
- **Không làm điền sẵn số tiền và nội dung.** Mọi cách điền sẵn đã biết đều đi qua máy chủ bên thứ ba (vietqr.io, ZaloPay,
  Bao Kim) hoặc là định dạng đoán ngược chưa có tài liệu (`applink?qrContent=` của `qrviet`). Không ngân hàng nào công bố
  deeplink điền sẵn của riêng mình.
- **Tài liệu cho dev phải nêu:**
  - iOS chỉ mở được scheme trong thao tác bấm của người dùng; app native cần `LSApplicationQueriesSchemes` (tối đa 50).
  - App Android gọi từ code cần khai `<queries>` hoặc bắt `ActivityNotFoundException`.
  - Trình duyệt trong Zalo, Messenger, Facebook, TikTok hay chặn scheme và `intent://` [?, chưa tự thử].
- **Liên kết tên miền (universal link)** của các ngân hàng không có đường dành cho thanh toán, nên scheme vẫn là cách mở
  app duy nhất dùng được chung.

### 5.6 Vẽ SVG và gói tích hợp **[Claude]**

- **Vẽ SVG:**
  - Gói riêng `@tingqr/render` có `toSvg(payload, options)` và `toMatrix(payload, options)`. **[chủ dự án, 2026-11-18]**
  - **Bộ mã hoá QR là code của tingqr, port từ Nayuki QR Code generator** (bản TypeScript, MIT, header
    `Copyright (c) Project Nayuki`; https://github.com/nayuki/QR-Code-generator). Không bọc thư viện QR khác, không có
    dependency. Giữ header giấy phép và ghi công trong file được port và trong NOTICE. **[chủ dự án, 2026-11-18]**
  - Bản .NET (`TingQR.Rendering`, v0.2) port từ `manuelbl/QrCodeGenerator` (MIT), vốn là bản port trung thành của Nayuki.
  - **Hai ngôn ngữ phải cho cùng một ma trận điểm ảnh** với cùng chuỗi và cùng tuỳ chọn (mức sửa lỗi, mask, phiên bản).
    Bộ mẫu thử có loại mẫu ma trận (`conformance/vectors/render/`) để chứng minh. Mẫu ma trận lấy từ chính bộ mã hoá
    Nayuki gốc chạy làm oracle, không lấy từ code đã port.
  - Tuỳ chọn: mức sửa lỗi, viền, màu, ô logo ở giữa. Nếu có logo giữa thì tự nâng mức sửa lỗi lên H.
- **`@tingqr/angular`:**
  - Component standalone `<tingqr-code [payload]>` hoặc nhận dữ liệu VietQR.
  - Pipe `tingqrSvg`.
  - Dùng signals, render được ở SSR, không cần zone.js.
- **`@tingqr/nestjs`:**
  - `TingQrModule.forRoot({ defaultBank, … })`.
  - `TingQrService`, bọc lõi.
  - Tuỳ chọn một controller mẫu trả SVG.
- **`TingQR.AspNetCore` (v0.2):**
  - `services.AddTingQr()`.
  - Minimal API endpoint mẫu trả SVG.

### 5.7 Bảng thử trên app thật **[Claude]**

- **`docs/conformance-matrix.md`:** mỗi dòng ghi:
  - app và phiên bản app;
  - hệ điều hành;
  - mẫu thử nào (theo `id` trong `conformance/vectors`);
  - kết quả: quét được không, hiện đúng tên, số tiền, nội dung không;
  - người thử, ngày thử.
- **Mẫu issue "Báo kết quả quét":** để cộng đồng thêm dòng.
- **Bản ra mắt chỉ ghi những dòng chủ dự án đã tự quét.** Không ghi app nào chưa ai thử.
- **Mức tối thiểu trước khi ra mắt** **[Claude]**: chủ dự án quét bằng ít nhất 2 app ngân hàng Việt Nam một QR tĩnh và một
  QR có số tiền do tingqr tạo ra.
- **PromptPay và KHQR chưa ai quét thử bằng app thì vẫn ra mắt** **[chủ dự án]**, dựa trên mẫu từ đặc tả, repo giấy phép
  MIT và QR thật ở máy. README ghi rõ hai loại này chưa được quét thử bằng app thật.

### 5.8 Phát hành **[Claude]**

- **Hai đường phát hành riêng, đều dùng OIDC (trusted publishing), không lưu token:**
  - Tag `ts-v*` phát hành lên npm.
  - Tag `dotnet-v*` phát hành lên NuGet.
- **Số phiên bản:** các gói npm dùng chung một số phiên bản.
- Có lệnh diễn tập phát hành, như skill `release-drill` của `zkteco-protocol`.
- **Bắt buộc hỏi chủ dự án** trước mọi lệnh phát hành. Lệnh phát hành thật chỉ chạy trong CI.

### 5.9 CI **[Claude]**

- `ci-ts` chạy khi có thay đổi trong `ts/**` hoặc `conformance/**`: typecheck, test, build, kiểm kích thước gói lõi.
- `ci-dotnet` chạy khi có thay đổi trong `dotnet/**` hoặc `conformance/**`: build, test.
  - Có từ v0.2. Trước đó chưa có workflow này.
- Có một bước kiểm `conformance/` theo JSON Schema.
- **Chạy trên Ubuntu và Windows,** vì chủ dự án làm trên Windows và lỗi xuống dòng (CRLF) làm sai CRC.

### 5.10 Setup Claude Code **[Claude]**

- **CLAUDE.md theo tầng:**
  - Gốc: mục đích, quy tắc "conformance trước, code sau", không bịa mẫu, viết tài liệu bằng tiếng Việt và code bằng tiếng
    Anh, cách chạy lệnh gom chung.
  - `ts/CLAUDE.md`: lệnh pnpm, quy ước TypeScript.
  - `dotnet/CLAUDE.md`: lệnh dotnet, quy ước C#.
- **`.claude/settings.json`** (theo khung của `zkteco-protocol`):
  - Tự cho phép: `pnpm install/test/build/typecheck`, `dotnet build/test/restore`, các lệnh git chỉ đọc, `gh run/pr/issue`
    chỉ đọc.
  - Luôn hỏi trước: `npm publish`, `pnpm publish`, `dotnet nuget push`, `git push`.
- **Agent:**
  - `parity-review`: kiểm mỗi thay đổi ở một ngôn ngữ đã có phần tương ứng ở ngôn ngữ kia, hoặc đã ghi rõ là chưa làm,
    và có mẫu thử trong `conformance/`.
  - `evidence-review`: port từ `zkteco-protocol`. Bắt những chỗ code, test, tài liệu hay bảng thử khẳng định nhiều hơn
    những gì đã được chứng minh.
- **Skill:**
  - `add-scheme`: danh sách việc khi thêm một loại QR: tìm mẫu thật kèm nguồn → `conformance/schemes/<id>.md` → mẫu thử →
    code TypeScript → code .NET (từ v0.2) → tài liệu → dòng mới trong bảng thử trên app thật.
  - `update-banks`: cập nhật `banks.json`, kiểm gói Android trên Google Play, kiểm link logo còn sống.
  - `release-drill`.
- **Worktree:** việc TypeScript và .NET chạy song song phải ở hai worktree riêng.
- **LSP:** TypeScript và C#.

### 5.11 Noel tree là nơi dùng đầu tiên

- Sau v0.1, Noel tree thay `src/app/tree/vietqr.ts` và `bank-apps.ts` bằng `@tingqr/core`.
  - Đây là việc của repo Noel tree, làm theo quy trình riêng bên đó.
  - Đây cũng là cách kiểm `@tingqr/angular` chạy được trên Angular 21 SSR trên Workers.

## 6. Để builder tự quyết

- Tên chính xác của các hàm, kiểu dữ liệu, mã lỗi (giữ các khái niệm ở 5.3).
- Port bộ mã hoá QR từ nguồn nào (phải có giấy phép MIT, Apache hoặc tương đương, ghi công đầy đủ).
- Chọn framework test (Vitest phía TypeScript, xUnit phía .NET là gợi ý).
- Cách chia các plan nhỏ cho v0.1.

## 7. Câu hỏi còn mở

- Tìm được mẫu QR thật của KHQR và PromptPay từ đâu, giấy phép thế nào. Cần làm trước khi viết code cho hai loại này.
- Chủ dự án có những app ngân hàng hoặc ví nào để quét thử trước khi ra mắt.
- Mua tên miền `tingqr` và giữ chỗ scope `@tingqr` trên npm (việc của chủ dự án).
