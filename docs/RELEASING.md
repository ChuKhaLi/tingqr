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

Nguồn các điều về npm (đọc ngày 2026-11-21; nên đọc lại trước khi làm):
- trusted publishing, provenance chỉ cho repo công khai, npm ≥ 11.5.1: https://docs.npmjs.com/trusted-publishers/
- gói phải có sẵn trước khi cấu hình: https://docs.npmjs.com/cli/v11/commands/npm-trust/
- cấu hình mới hết hạn sau 2 ngày nếu chưa phát hành thành công: kết quả tìm kiếm trên docs.npmjs.com ngày 2026-11-21;
  chưa tìm lại được trang gốc, **kiểm lại trên npmjs.com trước bước 4**.
- người duyệt của environment trên repo riêng tư cần gói Enterprise:
  https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment

0. **Rà lịch sử commit trước khi mở công khai** (chủ dự án làm).
   - Mở công khai thì **mọi commit** đều công khai, kể cả nội dung đã xoá ở commit sau.
   - Những gì đã biết đang nằm trong lịch sử:
     - commit `e3b0a39` (file kết quả thử Noel tree) có số tài khoản ảo nhận tiền của Noel tree. Bản hiện tại đã bỏ số
       này, nhưng commit cũ vẫn còn. Số này vốn hiện cho người trả tiền trên trang thanh toán của Noel tree; bạn quyết
       có cần xoá khỏi lịch sử không;
     - email tác giả trong mọi commit;
     - các ghi chú bàn giao và kế hoạch nội bộ trong `docs/superpowers/`.
   - Nên chạy thêm một công cụ dò bí mật trên toàn bộ lịch sử (ví dụ `gitleaks detect` hay `trufflehog git`), và kiểm
     rằng không commit nào từng chứa `conformance/private/` hay `ts/packages/render/scan-sheet/index.html` (dữ liệu
     quét thật). Claude không đọc được `conformance/private/`, nên việc kiểm này phải do chủ dự án làm.
   - Muốn xoá thứ gì khỏi lịch sử thì phải viết lại lịch sử (ví dụ `git filter-repo`) và force-push. Việc này không rút
     lại được và làm hỏng mọi bản clone cũ. Làm **trước** khi mở công khai, sau khi đã sao lưu repo.
1. **Mở công khai repo** `ChuKhaLi/tingqr`.
   - Đây là điều kiện bắt buộc: job `publish` từ chối chạy khi repo còn riêng tư. Với repo riêng tư, bước duyệt của
     GitHub environment chỉ có ở gói Enterprise, nên chỉ cần đẩy tag là gói phát hành luôn.
   - Provenance trên npm cũng chỉ có khi repo công khai.
2. **Tạo GitHub environment `npm-release`** (Settings → Environments). Đặt chủ dự án là người duyệt bắt buộc
   (required reviewer). Tên environment phải đúng `npm-release`.
   - **Kiểm lại trước tag đầu tiên:** mở environment, thấy dòng "Required reviewers" có tên chủ dự án. Nếu environment
     chưa có hay không có người duyệt, GitHub vẫn chạy job `publish` mà không chờ ai, tức là đẩy tag là phát hành luôn.
3. **Bản giữ chỗ 0.0.1**, phát hành tay:
   1. `node ts/scripts/set-version.mjs 0.0.1`.
   2. Trong 8 README (`README.md`, `README.vi.md` và 6 file `ts/packages/*/README.md`; ở hai README gốc là đoạn ngay
      sau `<!-- status:npm -->`), thay dòng trạng thái "Not released yet" /
      "chưa phát hành" bằng: **"0.0.1 is a placeholder published to set up trusted publishing. Do not use it; wait for
      0.1.0."** README tiếng Việt viết câu tương ứng. Đường phát hành tay này không có bước kiểm tự động: đếm đủ 8 file.
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
2. **Sửa dòng trạng thái trong 8 README** (hai README gốc: đoạn sau `<!-- status:npm -->`) cho đúng với bản sắp phát hành. Không còn "not released yet" / "chưa phát hành".
   - `check-release --tag` (chạy trong job `verify` khi chạy bằng tag) sẽ từ chối phát hành nếu còn câu đó, nếu tag lệch
     số phiên bản, hay nếu số phiên bản là `0.0.0`.
   - Kiểm lại bảng bằng chứng trong README gốc theo `conformance/scans.md`.
3. Viết mục `X.Y.Z` trong `CHANGELOG.md`, chuyển nội dung từ "Unreleased" xuống.
4. Chạy diễn tập: `node .claude/skills/release-drill/scripts/drill.mjs`. Bước này gọi mạng tới registry npm.
5. Commit, mở PR, chờ CI xanh, gộp vào `main`.
6. Tag và đẩy tag:
   - `git tag ts-vX.Y.Z`
   - `git push origin ts-vX.Y.Z`
7. Xem job `verify` của `Release (TypeScript)`. Job này chạy lại mọi kiểm tra, diễn tập, và `npm publish --dry-run`.
   - Tag phải trỏ vào một commit đã nằm trên `main` (bước "The tag must point to a commit on main"); tag trên nhánh
     khác thì dừng trước khi phát hành.
   - Mọi tag chung một hàng đợi (`concurrency`): đẩy hai tag cùng lúc thì chạy lần lượt, không huỷ lần nào.
8. Duyệt job `publish` trong environment `npm-release`. Job này phát hành đúng các tarball mà `verify` đã diễn tập.

**Chỉ tag mới phát hành.** Chạy bằng tay (Actions → Release (TypeScript) → Run workflow) và PR sửa workflow, script
phát hành hay diễn tập đều chỉ chạy job `verify` (kiểm, diễn tập, `npm publish --dry-run`). Hai đường này không kiểm
dòng trạng thái README hay tag, vì chúng không phát hành.

**Job `publish` chưa chạy lần nào** (tính tới 2026-11-21): OIDC, bước duyệt, bước từ chối repo riêng tư, việc tải
tarball từ artifact chỉ mới được đọc, chưa được chạy. Lần đầu (0.1.0) cần xem kỹ log của job này.

## Khi phát hành hỏng giữa chừng

- Các gói đã lên npm thì không rút lại được.
- **Lỗi tạm thời** (mạng, registry) làm job `publish` dừng giữa chừng: bấm "Re-run failed jobs". Job bỏ qua gói nào đã có
  đúng số đó trên npm và phát hành tiếp các gói còn lại, vẫn từ đúng các tarball đã diễn tập.
  - Artifact giữ 7 ngày. Quá hạn thì phải phát hành số mới.
- **Lỗi trong gói** (bản đã lên bị hỏng): đừng phát hành lại cùng số. Sửa lỗi, rồi phát hành `X.Y.(Z+1)` cho **cả sáu
  gói**, để sáu gói luôn cùng số.
- Một bản đã lên mà hỏng thì đánh dấu deprecated: `npm deprecate @tingqr/<gói>@X.Y.Z "<lý do>"`. Không dùng
  `npm unpublish`.

## Giới hạn

- Bản 0.0.1 không có provenance, vì phát hành tay.
- Chưa hỗ trợ phát hành bản tiền phát hành (`-rc`, `-beta`). Workflow từ chối loại tag này cho tới khi có luồng dist-tag
  riêng.
