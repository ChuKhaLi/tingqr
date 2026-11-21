# Plan 7: README, bảng thử, phát hành npm, `release-drill` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sáu gói npm của tingqr sẵn sàng phát hành:
- README nói đúng bằng chứng;
- có mẫu issue báo kết quả quét;
- có số phiên bản chung và metadata npm;
- có workflow phát hành bằng tag dùng OIDC, có duyệt, có dry-run;
- có skill diễn tập cài từ tarball;
- có danh sách việc chủ dự án tự làm.

**Không phát hành gì** trong plan này.

**Architecture:**
- Script đổi phiên bản `ts/scripts/set-version.mjs`, và `ts/scripts/check-release.mjs` kiểm phiên bản và metadata của
  sáu gói.
- `.github/workflows/release-ts.yml`:
  - job `verify`, rồi job `publish` có environment;
  - chạy dry-run trên PR, để thử được trước khi gộp.
- `.claude/skills/release-drill/` chứa `drill.mjs`: đóng gói, cài vào thư mục tạm, chạy thử gói đã cài.
- README gốc tiếng Anh, `README.vi.md`, README từng gói.

**Tech Stack:** Node 22/24, pnpm 10, npm ≥ 11.5 (trusted publishing), GitHub Actions; Hono, NestJS 12 (Express) và
Angular 20 (`platform-server`) cài từ registry trong diễn tập.

**Spec:** `docs/superpowers/specs/2026-11-21-tingqr-release-design.md` (chủ dự án duyệt 2026-11-21).

## Global Constraints

- **Không chạy** `npm publish` hay `pnpm publish` thật, không đẩy tag `ts-v*`. Mọi lệnh phát hành chỉ ở dạng dry-run.
  Lệnh thật chỉ chạy trong CI, và phải hỏi chủ dự án (spec 5.8).
- Repo giữ `version` là `0.0.0` (hoãn phát hành, chủ dự án quyết 2026-11-21).
- `author`: `"Chung Nguyen"`, chỉ tên.
- **Ngân sách tarball:**
  - `render` nâng lên **36 000** (chủ dự án duyệt);
  - `core` vẫn **45 000**. Thêm README mà vượt thì **dừng, hỏi chủ dự án**, không tự nâng;
  - các gói khác: nếu vượt thì nâng theo quy tắc đã dùng (đo, làm tròn lên 1 000 byte, cộng 25%), ghi ngày.
- **README theo bằng chứng:**
  - mọi câu "đã quét bằng app X" phải có dòng tương ứng trong `conformance/scans.md`;
  - câu giới thiệu viết như mục tiêu;
  - có dòng trạng thái **chưa phát hành**;
  - nói ngay đầu: không xác nhận thanh toán, không nhận webhook;
  - không có huy hiệu (badge) trỏ tới thứ chưa có.
- **Workflow phát hành:**
  - từ chối phát hành từ repo riêng tư;
  - từ chối tag tiền phát hành (`-rc`…);
  - tag phải đúng `ts-v<version>`;
  - phát hành theo thứ tự `core`, `render`, `bank-logos`, `hono`, `nestjs`, `angular`.
- `release-drill` gọi mạng tới registry npm (cài peer). Báo trước khi chạy ở máy, như quy ước của repo.

## Review Focus

1. **`workspace:*` còn trong tarball.** `npm publish <tgz>` sẽ phát hành đúng nguyên văn file `package.json`. Mong đợi:
   tarball đã qua `pnpm pack`, không còn chữ `workspace:`. `check-release` và diễn tập đều kiểm (Task 1, Task 4).
2. **Gói Angular đóng gói từ chỗ khác `dist`.** Tarball phải có `fesm2022/`, không có `src/`. Đã có trong
   `check-angular`; diễn tập kiểm lại trên tarball dùng để phát hành (Task 4).
3. **CJS của `nestjs` trên Node cũ.** Diễn tập chạy trên Node của máy; CI ghi rõ phiên bản Node. Kiểm đúng
   `engines` (Task 1).
4. **Workflow chạy publish khi chỉ dry-run hay khi có PR.** Job `publish` chỉ được chạy khi đẩy tag, hoặc dispatch
   với `dry_run=false`. Trên PR chỉ chạy `verify` và `npm publish --dry-run`. Kiểm bằng cách đọc điều kiện `if:` và xem
   lượt chạy thật trên PR (Task 5).
5. **README nói quá.** Ví dụ "works with every bank app", hay ghi app chưa quét. Chạy `evidence-review` (Task 7).

---

### Task 1: Số phiên bản, metadata npm, ngân sách `render`

**Files:**
- Create: `ts/scripts/set-version.mjs`, `ts/scripts/check-release.mjs`
- Modify: `ts/packages/*/package.json` (metadata), `ts/package.json` (`check:release`, `set-version`),
  `ts/scripts/check-render-package.mjs` (36 000), `.github/workflows/ci-ts.yml` (bước `check-release`),
  `ts/packages/core/src/index.ts` (giữ `VERSION`)
- Test: `ts/scripts/test/release.test.mjs` (`node --test`, như công cụ `banks`)

**Interfaces:**
- Produces:
  - `node ts/scripts/set-version.mjs <x.y.z>`: ghi `version` vào sáu `package.json`, và `VERSION` vào
    `ts/packages/core/src/index.ts`. Từ chối số không đúng semver `x.y.z`, kể cả số tiền phát hành.
  - `node ts/scripts/check-release.mjs [--tag ts-vX.Y.Z]`:
    - sáu gói cùng `version`, và bằng `VERSION` của core;
    - nếu có `--tag` thì tag đúng bằng `ts-v<version>`;
    - mỗi gói có `license: MIT`, `author: "Chung Nguyen"`, `repository` (`type: git`,
      `url: git+https://github.com/ChuKhaLi/tingqr.git`, `directory: ts/packages/<gói>`), `homepage`, `bugs`,
      `keywords` không rỗng, `publishConfig.access: "public"`;
    - in lỗi và thoát 1 nếu sai.

- [ ] **Step 1: Viết test** (`node --test`, dựng một repo giả trong thư mục tạm có sáu `package.json` và `index.ts`):
  - `set-version 1.2.3` ghi đúng cả bảy chỗ;
  - `set-version 1.2` và `1.2.3-rc.1` thoát 1, không ghi gì;
  - `check-release` đạt trên repo giả đúng;
  - một gói lệch số thì thoát 1, thông báo nêu tên gói;
  - `--tag ts-v1.2.4` khi version là `1.2.3` thì thoát 1;
  - thiếu `author` hay `publishConfig.access` thì thoát 1.

  Hai script nhận thư mục gốc qua biến môi trường `TINGQR_REPO_ROOT`; mặc định là repo thật.
- [ ] **Step 2:** Chạy `node --test ts/scripts/test/`. Kết quả mong đợi: FAIL.
- [ ] **Step 3:** Viết hai script.
- [ ] **Step 4:** Thêm metadata vào sáu `package.json` (`keywords` theo gói). Gói `angular` giữ
  `publishConfig.directory: "dist"` và thêm `access`. Gói `nestjs` giữ `engines` `^20.19.0 || >=22.12.0`.
  `MAX_TARBALL_BYTES` của `render` = `36_000`, comment ghi "owner approved 2026-11-21 (Plan 7)".
- [ ] **Step 5:** Chạy:
  - `node --test ts/scripts/test/`;
  - `node ts/scripts/check-release.mjs`;
  - `pnpm -C ts build`, rồi sáu `check:*`.

  Kết quả mong đợi: PASS và `ok`. Kiểm gói Angular đóng gói ra có `publishConfig.access`.
- [ ] **Step 6:** Thêm `check-release` vào `ci-ts.yml`. Commit `feat(release): shared version script, release metadata check, render budget 36 000`.

### Task 2: README

**Files:**
- Create: `README.md`, `README.vi.md`, `ts/packages/core/README.md`
- Modify: `ts/packages/{render,bank-logos,hono,angular,nestjs}/README.md` (theo cùng khuôn)
- Modify: `ts/packages/core/package.json` (`files` thêm `README.md` nếu cần), các script `check-*` nếu ngân sách đổi

- [ ] **Step 1: README gốc tiếng Anh**, theo spec mục 5.1, đủ 7 phần.
  - **Bảng bằng chứng** chép từ `conformance/scans.md`, ngày 2026-11-21:
    - VietQR tài khoản: MB Bank 6.5.31 và MyVIB 1.80.3, Android 16, trên màn hình và giấy, cả bản có logo thử lẫn không
      logo;
    - VietQR thẻ: MyVIB không đọc được;
    - VNPAY, PromptPay, KHQR: chưa quét;
    - MoMo, ZaloPay: chưa nhận diện.
  - **Dòng trạng thái:** "Not released yet. v0.1 waits for MoMo/ZaloPay recognition and more app scans."
  - Ví dụ dùng chuỗi có trong `conformance/vectors/`, không bịa.
- [ ] **Step 2:** `README.vi.md` cùng nội dung chính, bằng tiếng Việt.
- [ ] **Step 3: README cho từng gói.**
  - `core` (mới): tạo và đọc VietQR, VNPAY (chỉ đọc), PromptPay, KHQR; `detect`; `@tingqr/core/banks`; lỗi và cảnh báo;
    chế độ đọc mặc định chấp nhận lệch chuẩn.
  - `bank-logos`: viết lại theo khuôn, giữ phần ghi chú thương hiệu.
  - Bốn README còn lại: thêm dòng không xác nhận thanh toán, dòng trạng thái và link về README gốc. Không đổi các câu đã
    qua `evidence-review`.
- [ ] **Step 4:** Chạy `pnpm -C ts build`, rồi sáu `check:*`.
  - **`core` vượt 45 000:** dừng, hỏi chủ dự án. Đưa con số đo được và hai cách: nâng ngân sách, hoặc rút ngắn README
    của core.
  - **Gói khác vượt:** nâng theo quy tắc ở Global Constraints, ghi ngày.
- [ ] **Step 5:** Commit `docs: root README (en, vi), README for every package`.

### Task 3: Mẫu issue báo kết quả quét

**Files:**
- Create: `.github/ISSUE_TEMPLATE/scan-report.yml`
- Modify: `conformance/scans.md` (một dòng trỏ tới mẫu issue)

- [ ] **Step 1:** Viết mẫu dạng form. Các ô có `id`:
  - `app`, `device`, `vector_id`;
  - `logo` (dropdown: không / logo thử / icon ngân hàng);
  - `medium` (màn hình / giấy);
  - `result` (dropdown đúng các mức kết quả trong `scans.md`);
  - `notes`.

  Có đoạn nhắc **không dán số tài khoản thật hay ảnh QR có dữ liệu thật**. Nhãn `scan-report`.
- [ ] **Step 2:** Kiểm file là YAML hợp lệ, có đủ khoá `name`, `description`, `labels`, `body`. Dùng một lệnh
  `node -e` đọc bằng một bộ đọc YAML có sẵn trong workspace; nếu không có thì kiểm bằng mắt và ghi vào ledger.
- [ ] **Step 3:** Commit `docs: issue form for scan reports`.

### Task 4: Skill `release-drill`

**Files:**
- Create: `.claude/skills/release-drill/SKILL.md`, `.claude/skills/release-drill/scripts/drill.mjs`

**Interfaces:**
- Produces: `node .claude/skills/release-drill/scripts/drill.mjs [--out <dir>]`.
  - Thoát 0 khi mọi mục đạt.
  - In tên từng mục đạt hay hỏng.
  - Giữ thư mục tạm khi hỏng, hoặc khi có `KEEP_DRILL_ARTIFACTS=1`.
  - `--out` chép sáu file `.tgz` vào thư mục đó, để dùng cho lần phát hành tay đầu và cho job `publish`.

- [ ] **Step 1: Viết `drill.mjs`**, theo spec mục 5.6.
  - `pnpm -C ts build`; `pnpm pack` từng gói.
  - Tạo thư mục tạm **ngoài** repo, có `package.json` (`"type": "module"`).
  - `npm install` sáu file `.tgz`, cùng các peer:
    - `hono@^4`;
    - `@nestjs/common@^12`, `@nestjs/core@^12`, `@nestjs/platform-express@^12`, `rxjs@^7`, `reflect-metadata`;
    - `@angular/core@^20`, `@angular/common@^20`, `@angular/compiler@^20`, `@angular/platform-browser@^20`,
      `@angular/platform-server@^20`.
  - Các mục kiểm, mỗi mục chạy bằng `node` trong thư mục tạm, chỉ dùng gói đã cài:
    1. tarball: không có `src/`, `test/`; có `LICENSE` và `README.md`; `package.json` không còn `workspace:`;
    2. ESM `import` sáu gói;
    3. CJS `require` của `core`, `core/banks`, `render`, `bank-logos`, `hono`, `nestjs`;
    4. `encodeVietQr(input của vector vietqr-dynamic-amount-purpose)` bằng đúng `payload` của vector; `decodeVietQr` và
       `detect` ra đúng `bankBin`, `amount`; `findBank('MB').bin === '970422'`;
    5. `toSvg` ra chuỗi bắt đầu `<svg`; icon `@tingqr/bank-logos/icon/mb` là data URI;
    6. Hono: `app.request` qua `tingqr({ resolve })` trả 200, bốn header đúng `conformance/http/svg-response.json`;
    7. NestJS: app Express với `TingQrModule.forRoot` và một route `@TingQrSvg()` (dùng `@Inject` tường minh), gọi
       `fetch` qua cổng thật, đúng hợp đồng;
    8. Angular: `renderApplication` (platform-server, zoneless) một component dùng `<tingqr-code mode="svg">`, HTML có
       `<svg`.

    Code của mục 6–8 viết dạng chuỗi trong `drill.mjs`, ghi ra file `.mjs` trong thư mục tạm rồi chạy. Phần Angular dùng
    `@angular/compiler` để JIT, như test của gói `angular`.
- [ ] **Step 2: `SKILL.md`**, theo khuôn của `zkteco-protocol`:
  - vì sao skill này tồn tại;
  - cách chạy;
  - từng mục kiểm và lý do;
  - khi nào phải chạy;
  - ghi rằng bước này gọi mạng;
  - đọc lỗi thế nào.
- [ ] **Step 3: Báo chủ dự án là sẽ gọi mạng tới registry npm**, rồi chạy
  `node .claude/skills/release-drill/scripts/drill.mjs`. Kết quả mong đợi: thoát 0, cả 8 mục đạt.
  - Mục nào hỏng vì gói (ví dụ tarball thiếu file) thì sửa ở gói, có test nếu sửa code.
  - Hỏng vì script diễn tập thì sửa script.
- [ ] **Step 4:** Thử cho chắc diễn tập bắt được lỗi: tạm xoá `README.md` khỏi `files` của một gói, chạy lại, thấy mục
  1 hỏng, rồi khôi phục.
- [ ] **Step 5:** Cập nhật `CLAUDE.md` (mục Setup Claude Code nếu có danh sách skill). Commit
  `feat(release): release-drill skill — install the packed tarballs into a clean directory and use them`.

### Task 5: Workflow `release-ts.yml`

**Files:**
- Create: `.github/workflows/release-ts.yml`

- [ ] **Step 1: Viết workflow.**
  - **Kích hoạt:**
    - `push.tags: ['ts-v*']`;
    - `workflow_dispatch` có input `dry_run` (boolean, mặc định `true`);
    - `pull_request` với `paths` gồm chính file này, `ts/scripts/set-version.mjs`, `ts/scripts/check-release.mjs`,
      `.claude/skills/release-drill/**`. Trên PR luôn là dry-run.
  - **Job `verify`** (`ubuntu-latest`, Node 24, `permissions: contents: read`):
    - `pnpm install --frozen-lockfile`, typecheck, build, test, sáu `check:*`;
    - `node ts/scripts/check-release.mjs` (thêm `--tag "$GITHUB_REF_NAME"` khi chạy bằng tag);
    - từ chối tag có dấu `-`;
    - chạy diễn tập với `--out tarballs`;
    - `actions/upload-artifact` thư mục `tarballs`;
    - `npm publish --dry-run --access public` từng tarball, theo thứ tự.
  - **Job `publish`:**
    - `needs: verify`;
    - `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/ts-v') || (github.event_name == 'workflow_dispatch' && inputs.dry_run == false)`;
    - `environment: npm-release`;
    - `permissions: contents: read, id-token: write`;
    - bước đầu tiên: thoát 1 nếu `github.event.repository.private` là `true`, kèm thông báo trỏ tới `docs/RELEASING.md`;
    - cài npm ≥ 11.5 (`npm install -g npm@^11.5`);
    - `actions/download-artifact` lấy đúng các tarball mà `verify` đã kiểm;
    - `npm publish <tgz> --access public` theo thứ tự.
  - **Comment đầu file:** tên file là một phần của trust trên npm. Đổi tên thì phải cập nhật trusted publisher.
- [ ] **Step 2:** Kiểm cú pháp bằng `actionlint`, nếu cài được qua `npx`/`go`; không thì đọc kỹ và ghi vào ledger.
- [ ] **Step 3:** Đẩy nhánh, mở PR nháp, xem lượt chạy `release-ts` trên PR:
  - `verify` xanh;
  - `npm publish --dry-run` liệt kê đủ sáu gói;
  - job `publish` bị **bỏ qua**.
- [ ] **Step 4:** Commit `ci(release): release-ts workflow — tag-triggered, approval-gated, OIDC, dry-run on PRs`.

### Task 6: `RELEASING.md`, `CHANGELOG.md`, trạng thái

**Files:**
- Create: `docs/RELEASING.md`, `CHANGELOG.md`
- Modify: `CLAUDE.md`, `ts/CLAUDE.md`

- [ ] **Step 1: `docs/RELEASING.md`** (tiếng Việt), đúng spec mục 5.7:
  - các điều kiện trước v0.1;
  - những việc đã làm (org `tingqr`);
  - các bước một lần: mở công khai repo, environment, bản giữ chỗ 0.0.1 phát hành tay, trusted publisher, 0.1.0 trong
    vòng 2 ngày;
  - các bước mỗi lần phát hành;
  - giới hạn về provenance;
  - xử lý khi phát hành hỏng giữa chừng: các gói đã lên không rút được, nên phát hành tiếp số `x.y.z+1` cho cả sáu.
- [ ] **Step 2: `CHANGELOG.md`:** mục "Unreleased" liệt kê theo gói những gì đã có. Không có mục 0.1.0.
- [ ] **Step 3:** `CLAUDE.md` thêm Plan 7, trạng thái "chưa phát hành, chờ MoMo/ZaloPay và quét thêm". `ts/CLAUDE.md`
  thêm `set-version`, `check-release`, `release-drill`, ngân sách `render` 36 000.
- [ ] **Step 4:** Chạy `pnpm test:all`, `pnpm typecheck:all`, `node --test ts/scripts/test/` và sáu `check:*`. Kết quả
  mong đợi: tất cả PASS.
- [ ] **Step 5:** Commit `docs(release): RELEASING checklist, CHANGELOG, status`.

### Task 7: Review trước khi gộp

- [ ] **Step 1:** Chạy song song `evidence-review` (README, `RELEASING.md`, `CHANGELOG.md`) và `parity-review`. Sửa
  những điểm được nhận.
- [ ] **Step 2:** Review cả nhánh bằng reviewer mới, model mạnh nhất. Chú ý riêng các điều kiện `if:` của workflow và
  quyền. Sửa điểm Critical/Important, mỗi điểm có test hay lượt chạy chứng minh.
- [ ] **Step 3:** superpowers:finishing-a-development-branch.
