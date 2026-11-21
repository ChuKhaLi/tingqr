# Thiết kế: README, bảng thử, phát hành npm, `release-drill` (Plan 7 → v0.1)

Ngày: 2026-11-21. Dựa trên spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 1, 2, 5.7, 5.8, 5.10).
Mục ghi **[chủ dự án]** là chủ dự án đã quyết; mục **[Claude]** là đề xuất của Claude, chủ dự án có thể sửa.

## 1. Mục đích

- Đưa sáu gói TypeScript tới trạng thái **phát hành được v0.1**:
  - `@tingqr/core`, `@tingqr/render`, `@tingqr/bank-logos`, `@tingqr/hono`, `@tingqr/angular`, `@tingqr/nestjs`;
  - người lạ đọc README là hiểu thư viện làm gì, không làm gì và đã được kiểm tới đâu;
  - cài từ npm là chạy.
- Mục tiêu lớn: một thư viện mã nguồn mở có tiếng (spec chung mục 1). Vì vậy README và bằng chứng (bảng thử, mẫu thử có
  nguồn) là phần quan trọng nhất, không phải phần phụ.

## 2. Phạm vi

### Có

- **README gốc**, cùng README đầy đủ cho từng gói.
- **Mẫu issue** "Báo kết quả quét".
- **Số phiên bản chung:** script đổi phiên bản, test kiểm cả sáu gói cùng số, `CHANGELOG.md`.
- **Metadata npm** của mỗi gói (`repository`, `homepage`, `bugs`, `keywords`, `publishConfig.access`).
- **Workflow phát hành** bằng tag `ts-v*`:
  - dùng OIDC, không có token;
  - có bước chờ chủ dự án duyệt;
  - có chế độ chạy thử không phát hành (dry-run).
- **Skill `release-drill`:** cài sáu file `.tgz` vào thư mục sạch rồi chạy thử như một người dùng thật.
- **`docs/RELEASING.md`:** danh sách việc chủ dự án tự làm.
- **Ngân sách `render`:** nâng lên khoảng 36 000 byte.

### Không làm trong plan này **[chủ dự án: hướng A]**

- **Phát hành thật lên npm**, giữ scope `@tingqr`, mở công khai repo. Ba việc này không rút lại được, nên chủ dự án tự
  làm theo `docs/RELEASING.md`.
- **Hoãn phát hành v0.1 cho tới khi đủ mục tiêu v0.1** **[chủ dự án, 2026-11-21]**. Còn thiếu:
  - nhận diện QR MoMo và ZaloPay (Plan 2 Task 6, chờ QR thật);
  - quét thêm app.

  Plan 7 vẫn làm đủ phần chuẩn bị. Repo giữ `version` là `0.0.0` cho tới khi chủ dự án quyết phát hành.
  `docs/RELEASING.md` ghi các điều kiện này ở đầu.

### Đã kiểm

- **Scope `@tingqr` trên npm** (kiểm 2026-11-21 qua registry công khai):
  - org `tingqr` báo "Scope not found";
  - trang người dùng `~tingqr` trả 404;
  - chưa có gói nào.

  Vậy là có vẻ còn trống. Ai cũng có thể lấy bất cứ lúc nào, nên `RELEASING.md` khuyên tạo org `tingqr` sớm. Việc tạo
  org miễn phí và chưa phải phát hành gì.
- Bản .NET và đường phát hành NuGet (`dotnet-v*`): Plan 8.
- Trang web tài liệu riêng, tên miền.

## 3. Ràng buộc

- **Sự thật về npm** (kiểm ngày 2026-11-21 trên docs.npmjs.com và GitHub changelog):
  - Muốn cấu hình trusted publishing thì gói **phải có sẵn** trên npm. Vì vậy lần phát hành đầu của từng gói làm tay
    bằng tài khoản chủ dự án.
  - Cấu hình trusted publisher mới mà **trong 2 ngày** chưa phát hành thành công lần nào thì hết hạn.
  - **Provenance chỉ có khi repo công khai** (và gói công khai). Repo riêng tư vẫn phát hành bằng OIDC được, chỉ không
    có provenance.
  - Gói có scope mặc định là riêng tư, nên phải `access: public`.
- **Bắt buộc hỏi chủ dự án** trước mọi lệnh phát hành. Lệnh phát hành thật chỉ chạy trong CI (spec 5.8).
- **Bằng chứng (spec chung mục 2):**
  - README không ghi "chạy với app X" khi chưa ai quét bằng app X;
  - chỉ ghi những dòng có trong `conformance/scans.md`;
  - PromptPay, KHQR, VNPAY ghi rõ là chưa quét bằng app thật.
- README gốc phải nói ngay đầu: thư viện **không** xác nhận thanh toán, không nhận webhook.
- **Ngân sách `render`:** nâng từ 33 000 lên khoảng 36 000 byte, để README của `render` đầy đủ như các gói khác. **[chủ dự án]**

## 4. Các cách đã cân nhắc

### 4.1 Phát hành trong plan hay để chủ dự án **[chủ dự án: A]**

| Cách | Được và mất |
|---|---|
| **A. Chuẩn bị đủ, dừng trước khi phát hành** | Việc không rút lại được do chủ dự án tự làm, theo danh sách viết sẵn |
| B. Phát hành ngay trong plan | Cần tài khoản, scope, quyết mở công khai repo, chủ dự án có mặt duyệt từng bước |

### 4.2 Ngân sách `render` **[chủ dự án: B]**

| Cách | Được và mất |
|---|---|
| A. Giữ 33 000, README `render` ngắn | Gói nhỏ; hướng dẫn nằm trên GitHub |
| **B. Nâng lên khoảng 36 000** | README đầy đủ, giống các gói khác |
| C. Không tính README vào ngân sách | Đổi cách đo; ngân sách không còn là "cỡ tải về" |

### 4.3 Đổi phiên bản và phát hành **[chủ dự án: 1]**

| Cách | Được và mất |
|---|---|
| **1. Script của repo + tag `ts-v*`** | Ít phụ thuộc, giống `zkteco-protocol`; changelog viết tay |
| 2. Changesets | Changelog tự gom; thêm công cụ, phần mạnh nhất (phiên bản riêng từng gói) không dùng tới |

## 5. Thiết kế

### 5.1 README **[Claude]**

- **`README.md` gốc bằng tiếng Anh**, cộng **`README.vi.md` tiếng Việt** cùng nội dung chính. Lý do: thư viện hướng tới
  Đông Nam Á và QR xuyên biên giới, nên người đọc trên npm và GitHub phần lớn đọc tiếng Anh; dev Việt là người dùng đầu
  tiên nên có bản tiếng Việt. Tài liệu khác trong `docs/` vẫn tiếng Việt như quy ước repo.
- README gốc có, theo thứ tự:
  1. một câu thư viện làm gì, và ngay sau đó là **thư viện không xác nhận thanh toán, không nhận webhook**;
  2. câu giới thiệu (spec chung mục 1) viết **như mục tiêu**, không như điều đã làm được, ví dụ "Built to read every QR
     that Vietnamese banking apps can scan". Ngay dưới là trạng thái: **chưa phát hành**, còn thiếu gì cho v0.1.
     **[Claude, theo quyết định hoãn phát hành]**
  3. bảng loại QR × tạo / đọc × **đã quét bằng app thật chưa**, lấy từ `conformance/scans.md`:
     - VietQR chuyển vào **tài khoản**: MB Bank, MyVIB, Android;
     - VietQR chuyển vào **thẻ**: MyVIB không đọc được;
     - PromptPay, KHQR, VNPAY: chưa quét;
     - MoMo, ZaloPay: chưa nhận diện (đang chờ QR thật);
  4. sáu gói và mỗi gói để làm gì;
  5. ví dụ nhanh (tạo VietQR, đọc bằng `detect`, vẽ SVG);
  6. vì sao tin được: mẫu thử có nguồn ở `conformance/`, mutation test, bảng thử, mời báo kết quả quét;
  7. giấy phép: MIT; logo ngân hàng không thuộc MIT (`LOGOS-NOTICE.md`); ghi công vietqr-node, Nayuki.
- README từng gói: đủ để dùng gói đó một mình, link về README gốc. README của `core` và `bank-logos` viết lại theo cùng
  khuôn. README của `render`, `hono`, `angular`, `nestjs` đã có từ Plan 6 và 6b; chỉ sửa khuôn, giữ các câu đã qua
  evidence-review.
- Không có huy hiệu (badge) nào trỏ tới thứ chưa có: npm version, provenance, coverage. Chỉ thêm huy hiệu CI.

### 5.2 Bảng thử và mẫu issue **[Claude]**

- `conformance/scans.md` giữ nguyên quy tắc "chỉ người quét điền".
- Mẫu issue `.github/ISSUE_TEMPLATE/scan-report.yml` hỏi đúng các cột của bảng: app và phiên bản, máy và hệ điều hành,
  `id` mẫu, có logo không, màn hình hay giấy, kết quả theo các mức của bảng, ghi chú.
  - Có dòng nhắc **không dán số tài khoản thật** hay ảnh QR có dữ liệu thật.
  - Nhãn `scan-report`.
- Chủ dự án (hay Claude theo lời chủ dự án) chép dòng từ issue vào bảng. Không tự động.

### 5.3 Số phiên bản **[chủ dự án: 1; chi tiết: Claude]**

- `node ts/scripts/set-version.mjs <x.y.z>` ghi số vào `version` của sáu `package.json` và vào hằng số phiên bản nếu gói
  có. Không đụng `workspace:*`, vì pnpm tự thay khi đóng gói.
- Test kiểm cả sáu gói cùng số. Builder chọn đặt ở đâu: script check hay test của `core`.
- **Thứ tự phiên bản** **[Claude]**: npm không nhận cùng một số hai lần, mà lần đầu lại phải phát hành tay.
  - **0.0.1** là bản giữ chỗ, chủ dự án phát hành tay để có gói mà cấu hình trusted publisher. Nội dung là bản build thật
    lúc đó, README ghi rõ "placeholder, do not use".
  - **0.1.0** là bản ra mắt thật, phát hành qua CI nên có provenance (repo đã công khai).
  - `set-version` không đổi số trong repo khi Plan 7 chạy: repo vẫn để `0.0.0`.
- `CHANGELOG.md` ở gốc, viết tay, một mục cho mỗi phiên bản, ghi theo gói.

### 5.4 Metadata npm **[Claude]**

- **Mỗi gói có:**
  - `repository` (với `directory`), `homepage`, `bugs`;
  - `keywords` (`vietqr`, `napas`, `promptpay`, `khqr`, `emvco`, `qr`, `payment`… tuỳ gói);
  - `author`: `"Chung Nguyen"`, chỉ tên, không email **[chủ dự án]**;
  - `publishConfig.access: "public"`.
- Gói Angular giữ `publishConfig.directory: "dist"`.
- Các script `check:*` kiểm thêm những trường này.

### 5.5 Workflow phát hành `.github/workflows/release-ts.yml` **[Claude]**

- **Kích hoạt:**
  - đẩy tag `ts-v*`;
  - hoặc `workflow_dispatch` có ô `dry_run`, mặc định bật.
- **Job `verify`** (không quyền ghi):
  - cài đặt, typecheck, build, test, sáu `check:*`, `release-drill`;
  - kiểm tag đúng bằng `ts-v<version>` và cả sáu gói cùng số;
  - từ chối tag tiền phát hành (`-rc`…) cho tới khi cần thật.
- **Job `publish`:**
  - cần `verify` xong;
  - chạy trong GitHub environment `npm-release`: chủ dự án đặt người duyệt, nên mỗi lần phát hành phải bấm duyệt sau khi
    đã thấy kết quả `verify`;
  - **từ chối phát hành khi repo còn riêng tư** (`github.event.repository.private`). Lý do: theo hiểu biết hiện nay,
    người duyệt của environment chỉ có ở repo công khai, hoặc repo riêng tư trên gói Enterprise. Trên repo riêng tư thì
    chỉ cần đẩy tag là gói phát hành luôn. Dry-run vẫn chạy được khi repo còn riêng tư. **[Claude]**
  - quyền `id-token: write`;
  - đóng gói từng gói bằng `pnpm pack`, để `workspace:*` được thay bằng số phiên bản và gói Angular lấy từ `dist`;
  - phát hành từng file `.tgz` bằng `npm publish` (npm ≥ 11.5, hỗ trợ trusted publishing), theo thứ tự phụ thuộc:
    `core`, `render`, `bank-logos`, `hono`, `nestjs`, `angular`;
  - dry-run thì chạy `npm publish --dry-run`.
- **Đổi tên file workflow thì trust trên npm hỏng.** Comment đầu file và `RELEASING.md` ghi rõ điều này.
- Provenance tự có khi repo công khai. Workflow không bắt buộc provenance, để chạy được cả khi repo còn riêng tư.

### 5.6 Skill `release-drill` **[Claude]**

- `.claude/skills/release-drill/SKILL.md` và `scripts/drill.mjs`, theo khuôn của `zkteco-protocol`:
  1. build, `pnpm pack` sáu gói;
  2. tạo thư mục tạm không chung gì với repo, rồi `npm install` sáu file `.tgz`. Các peer lấy từ registry: `hono`,
     NestJS (`@nestjs/*`, `rxjs`, `reflect-metadata`, adapter Express), Angular (`@angular/*`, `platform-server`).
     **Bước này gọi mạng tới registry npm.**
  3. chạy thử bằng gói **đã cài**, không dùng gì của repo:
     - ESM `import` và CJS `require` mỗi gói (trừ `render/canvas` chỉ có ESM, và Angular chỉ có ESM);
     - `encodeVietQr` rồi `decodeVietQr` ra đúng dữ liệu; `detect` nhận đúng; `findBank('MB')`;
     - `toSvg` ra SVG; import một icon của `bank-logos` ra data URI;
     - Hono: `app.request` trả 200 với header đúng `conformance/http/svg-response.json`, đọc từ repo làm dữ liệu kỳ vọng;
     - NestJS: app Express nhỏ khởi động, route `@TingQrSvg()` trả 200 đúng hợp đồng;
     - Angular: render ở máy chủ một component có `<tingqr-code>` bằng `@angular/platform-server`, HTML có `<svg`;
     - mỗi tarball không chứa `src/`, `test/`, có `LICENSE` và `README.md`;
  4. thoát 0 khi mọi mục đạt; không thì in mục hỏng và giữ thư mục tạm.
- Skill ghi khi nào phải chạy: trước mọi phát hành, đổi phiên bản, `npm pack`, và khi sửa `exports`, `files`, `tsup.config`,
  `ng-package.json`.
- Job `verify` chạy diễn tập này.

### 5.7 `docs/RELEASING.md` (tiếng Việt) **[Claude]**

- **Điều kiện trước khi phát hành v0.1** **[chủ dự án]**:
  - có nhận diện MoMo và ZaloPay;
  - quét thêm app;
  - chủ dự án quyết phát hành.
- **Làm sớm được, không cần đợi** (chủ dự án làm): tạo tài khoản npm, bật 2FA, tạo org `tingqr` để giữ scope.
- **Một lần, khi quyết phát hành** (chủ dự án làm):
  1. mở công khai repo (cần cho provenance và bước duyệt; workflow từ chối phát hành từ repo riêng tư);
  2. trong GitHub, tạo environment `npm-release` có người duyệt;
  3. `set-version 0.0.1`, build, chạy `release-drill`, rồi phát hành tay từng gói theo đúng thứ tự phụ thuộc, bằng các
     file `.tgz` mà bản diễn tập tạo ra (`npm publish <tgz> --access public`). Đây là bản giữ chỗ;
  4. trên npmjs.com, cấu hình trusted publisher cho từng gói: repo `ChuKhaLi/tingqr`, workflow `release-ts.yml`,
     environment `npm-release`;
  5. **trong 2 ngày:** `set-version 0.1.0`, cập nhật `CHANGELOG.md`, tag `ts-v0.1.0`, duyệt job `publish`.
- **Mỗi lần phát hành:**
  1. `set-version`;
  2. cập nhật `CHANGELOG.md`;
  3. chạy `release-drill`;
  4. commit, tag `ts-vX.Y.Z`, push tag;
  5. xem `verify`, rồi duyệt `publish`.
- **Giới hạn:** bản giữ chỗ 0.0.1 phát hành tay nên **không** có provenance. Từ 0.1.0 trở đi, mọi bản đi qua CI.

## 6. Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Gói chạy trong repo nhưng hỏng khi cài từ npm | `release-drill` cài tarball vào thư mục sạch |
| Sáu gói lệch số phiên bản, hoặc tag lệch | Test cùng số; job `verify` kiểm tag |
| Phát hành nhầm | Tag + environment có người duyệt; dry-run mặc định khi chạy tay |
| README nói quá bằng chứng | `evidence-review`; bảng trong README lấy từ `scans.md` |
| Đổi tên workflow làm hỏng trust | Comment đầu file và `RELEASING.md` |
| Thứ tự phát hành sai (gói phụ thuộc lên trước) | Thứ tự cố định trong workflow; dry-run chạy đủ sáu gói |

## 7. Để người lập kế hoạch tự quyết

- Tên hằng số phiên bản (nếu thêm), chỗ đặt test cùng số.
- Chi tiết của `drill.mjs`: cách dựng app NestJS và SSR Angular trong thư mục tạm, thời gian chờ.
- Cách workflow `publish` lấy file `.tgz`: đóng gói lại trong job, hay nhận artifact từ `verify`. Nhận artifact thì đúng
  tinh thần "phát hành đúng thứ đã kiểm" hơn.
- Từ khoá npm của từng gói, nội dung `CHANGELOG.md` cho 0.1.0.
