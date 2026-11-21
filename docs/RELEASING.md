# Phát hành các gói npm của tingqr

Thiết kế: `docs/superpowers/specs/2026-11-21-tingqr-release-design.md`. Workflow: `.github/workflows/release-ts.yml`.
Diễn tập: skill `release-drill` (`node .claude/skills/release-drill/scripts/drill.mjs`).

**Phát hành lên npm không rút lại được.**
- Một số phiên bản đã dùng thì không dùng lại được nữa.
- Trang npm của một bản đã phát hành không bao giờ đổi, kể cả README.

Mọi lệnh phát hành thật chỉ chạy trong CI, sau khi chủ dự án duyệt.

## Điều kiện trước v0.1 (chủ dự án quyết, 2026-11-21)

- [ ] Nhận diện QR MoMo và ZaloPay (Plan 2 Task 6, cần QR thật).
- [ ] Quét thử bằng thêm app ngân hàng, ghi vào `conformance/scans.md`.
- [ ] Chủ dự án quyết phát hành.

## Đã làm

- Org `tingqr` trên npm (chủ dự án, 2026-11-21): scope `@tingqr` đã được giữ.
- Nên bật xác thực hai lớp (2FA) cho tài khoản npm, nếu chưa bật.

## Một lần, khi quyết phát hành v0.1

npm chỉ cho cấu hình trusted publishing trên gói **đã có**. Vì vậy phải phát hành tay một bản giữ chỗ trước, rồi mới
gắn workflow vào.

1. **Mở công khai repo** `ChuKhaLi/tingqr`.
   - Đây là điều kiện bắt buộc: job `publish` từ chối chạy khi repo còn riêng tư. Với repo riêng tư, bước duyệt của
     GitHub environment chỉ có ở gói Enterprise, nên chỉ cần đẩy tag là gói phát hành luôn.
   - Provenance trên npm cũng chỉ có khi repo công khai.
2. **Tạo GitHub environment `npm-release`** (Settings → Environments). Đặt chủ dự án là người duyệt bắt buộc
   (required reviewer). Tên environment phải đúng `npm-release`.
3. **Bản giữ chỗ 0.0.1**, phát hành tay:
   1. `node ts/scripts/set-version.mjs 0.0.1`.
   2. Trong 7 README (`README.md`, `README.vi.md`, `ts/packages/*/README.md`), thay dòng trạng thái "Not released yet" /
      "chưa phát hành" bằng: **"0.0.1 is a placeholder published to set up trusted publishing. Do not use it; wait for
      0.1.0."** README tiếng Việt viết câu tương ứng.
   3. Chạy diễn tập, lấy tarball: `node .claude/skills/release-drill/scripts/drill.mjs --out release-0.0.1`
      (thư mục này không commit). Mọi mục phải đạt.
   4. Đăng nhập npm (`npm login`), rồi phát hành **theo đúng thứ tự** từng file:
      `core`, `render`, `bank-logos`, `hono`, `nestjs`, `angular`:

      ```sh
      for p in core render bank-logos hono nestjs angular; do npm publish --access public ./release-0.0.1/tingqr-$p-0.0.1.tgz; done
      ```

      Bản giữ chỗ phát hành tay nên **không có provenance**.
   5. Không commit các thay đổi ở bước 1 và 2: trả repo về `0.0.0` (`git checkout -- .`).
4. **Trusted publisher cho từng gói** (6 gói). Trên npmjs.com, mở trang của gói → Settings → Trusted publishing →
   GitHub Actions, rồi điền:
   - owner `ChuKhaLi`, repository `tingqr`;
   - workflow `release-ts.yml`;
   - environment `npm-release`.

   Đổi tên file workflow hay environment thì trust hỏng, phải sửa lại cả 6 gói.
5. **Trong vòng 2 ngày** kể từ bước 4, phát hành 0.1.0 bằng tag, theo mục "Mỗi lần phát hành" dưới đây. Cấu hình trusted
   publisher mới mà quá 2 ngày chưa có lần phát hành thành công nào thì hết hạn.

## Mỗi lần phát hành (từ 0.1.0)

1. `node ts/scripts/set-version.mjs X.Y.Z`.
2. **Sửa dòng trạng thái trong 7 README** cho đúng với bản sắp phát hành. Không còn "not released yet" / "chưa phát hành".
   - `check-release --tag` (chạy trong job `verify`) sẽ từ chối phát hành nếu còn câu đó.
   - Kiểm lại bảng bằng chứng trong README gốc theo `conformance/scans.md`.
3. Viết mục `X.Y.Z` trong `CHANGELOG.md`, chuyển nội dung từ "Unreleased" xuống.
4. Chạy diễn tập: `node .claude/skills/release-drill/scripts/drill.mjs`. Bước này gọi mạng tới registry npm.
5. Commit, mở PR, chờ CI xanh, gộp vào `main`.
6. Tag và đẩy tag:
   - `git tag ts-vX.Y.Z`
   - `git push origin ts-vX.Y.Z`
7. Xem job `verify` của `Release (TypeScript)`. Job này chạy lại mọi kiểm tra, diễn tập, và `npm publish --dry-run`.
8. Duyệt job `publish` trong environment `npm-release`. Job này phát hành đúng các tarball mà `verify` đã diễn tập.

Muốn chạy thử cả quy trình mà không phát hành: Actions → Release (TypeScript) → Run workflow, để `dry_run` bật (mặc
định). PR nào sửa workflow, script phát hành hay diễn tập cũng tự chạy dry-run.

## Khi phát hành hỏng giữa chừng

- Các gói đã lên npm thì không rút lại được.
- Đừng phát hành lại cùng số. Sửa lỗi, rồi phát hành `X.Y.(Z+1)` cho **cả sáu gói**, để sáu gói luôn cùng số.
- Một bản đã lên mà hỏng thì đánh dấu deprecated: `npm deprecate @tingqr/<gói>@X.Y.Z "<lý do>"`. Không dùng
  `npm unpublish`.

## Giới hạn

- Bản 0.0.1 không có provenance, vì phát hành tay.
- Chưa hỗ trợ phát hành bản tiền phát hành (`-rc`, `-beta`). Workflow từ chối loại tag này cho tới khi có luồng dist-tag
  riêng.
