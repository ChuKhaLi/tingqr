---
name: release-drill
description: Dùng trước mọi lần phát hành, đổi số phiên bản hay `npm pack`, và khi sửa `exports`, `files`, `main`/`module`, `tsup.config.ts`, `ng-package.json`, `publishConfig` hay dependency của một gói tingqr. Đóng gói sáu gói @tingqr, cài vào một thư mục sạch không chung gì với repo, rồi dùng chính các gói ĐÃ CÀI như người dùng thật. Cũng dùng khi được hỏi gói có chạy với người dùng không, hay vì sao chạy trong repo mà cài vào thì hỏng. `pnpm test` xanh không trả lời được những câu này.
---

# Release drill

## Vì sao có skill này

- Mọi test trong repo chạy gói từ chính repo: dùng chung `node_modules`, tsconfig và bản build. Người cài từ npm không
  có những thứ đó.
- Vì vậy `pnpm test` xanh không chứng minh được rằng gói cài từ npm chạy được.
- Những lỗi chỉ lộ ra sau khi cài:
  - tarball thiếu file;
  - còn `workspace:*` trong `package.json`;
  - bản CJS không nạp được;
  - gói Angular đóng gói từ nhầm thư mục;
  - DI của NestJS hỏng khi không có decorator metadata.

## Cách chạy

Từ gốc repo:

```bash
node .claude/skills/release-drill/scripts/drill.mjs            # kiểm
node .claude/skills/release-drill/scripts/drill.mjs --out dir  # kiểm, rồi chép 6 file .tgz vào dir
```

- **Bước này gọi mạng tới registry npm**, vì phải cài các peer: `hono`, `@nestjs/*`, `@angular/*`, `rxjs`,
  `reflect-metadata`. Báo chủ dự án trước khi chạy ở máy.
- Mất vài phút, phần lớn là `npm install`.
- Thoát 0 khi cả 8 mục đạt. Có mục hỏng thì in mục đó, thoát 1 và giữ thư mục tạm (đường dẫn in ở cuối). Muốn giữ cả
  khi đạt: `KEEP_DRILL_ARTIFACTS=1`.
- `--out` là cách lấy đúng các file `.tgz` dùng để phát hành. Lần phát hành tay đầu tiên (xem `docs/RELEASING.md`)
  và job `verify` của `release-ts.yml` đều dùng `--out`.

## Kiểm gì, vì sao

1. **Tarball**:
   - không có `src/`, `test/`;
   - có `LICENSE`, `README.md`;
   - `package.json` không còn `workspace:`, vì `npm publish <tgz>` phát hành nguyên văn file đó.
2. **ESM `import`** mọi entry point, kể cả `@tingqr/render/canvas` và `@tingqr/angular`.
   - Gói Angular là bản biên dịch partial. Ứng dụng Angular thật có bước linker của Angular CLI lo phần này; ở Node trần
     thì phải nạp `@angular/compiler` trước.
3. **CJS `require`** của sáu entry point có bản CJS. `render/canvas` và `angular` chỉ có ESM. Bản CJS của `nestjs` dựa
   vào `require(esm)` của Node, vì NestJS 12 chỉ có ESM.
4. **`core`:**
   - `encodeVietQr` với đầu vào của mẫu `vietqr-dynamic-amount-purpose` ra đúng chuỗi của mẫu;
   - `decodeVietQr` và `detect` đọc lại đúng;
   - `findBank('MB')` ra BIN đúng.
5. **`render` và `bank-logos`:** `toSvg` ra `<svg`; một icon là data URI.
6. **Hono:** `tingqr({ resolve })` trả 200, bốn header đúng `conformance/http/svg-response.json`, thân đúng `toSvg`.
7. **NestJS:** một app Express thật chạy qua cổng thật. App dùng `TingQrModule.forRoot` và một route `@TingQrSvg()`,
   viết bằng JS thuần không có decorator metadata, nên chứng minh được rằng DI của gói không cần metadata.
8. **Angular:** `renderApplication` (platform-server, zoneless) một component có `<tingqr-code>`, HTML có `<svg`.

## Khi một mục hỏng

- **Mục 1:** thường do `files`, `publishConfig.directory` hay `exports`. Xem `package.json` của gói, rồi
  `tar -tzf <tgz>` trong thư mục tạm.
- **Mục 2–3:** thường do `exports` hay build (thiếu file trong `dist`).
- **Mục 4–8:** chạy lại file `.mjs` tương ứng trong `<thư mục tạm>/app` để thấy lỗi đầy đủ.
- **Đừng sửa diễn tập cho tới khi nó đạt.** Phải tìm xem lỗi nằm ở gói hay ở script. Mỗi lần sửa script phải có lý do
  ghi trong commit.

## Bẫy đã gặp (Windows)

- `pnpm`/`npm` là shim `.cmd`, cần shell. Còn `node` phải gọi thẳng, vì đường dẫn của nó có dấu cách.
- `tar` của Git for Windows (GNU) hiểu `C:` trong tên file lưu trữ là một máy từ xa. Vì vậy script truyền tên file
  không kèm ổ đĩa, và chạy trong thư mục chứa tarball.
