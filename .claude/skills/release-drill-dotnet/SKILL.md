---
name: release-drill-dotnet
description: Dùng trước mọi lần phát hành NuGet, đổi số phiên bản .NET hay `dotnet pack`, và khi sửa `.csproj` của một gói TingQR (`PackageReadmeFile`, giấy phép, `None Pack="true"`, `EmbeddedResource`, `TargetFrameworks`, `ProjectReference`, `FrameworkReference`) hay `dotnet/Directory.Build.props`. Đóng gói bốn gói TingQR, đọc từng `.nupkg`, cài vào project console và web nằm ngoài repo, rồi dùng chính các gói ĐÃ CÀI như người dùng thật. Cũng dùng khi được hỏi gói NuGet có chạy với người dùng không. `dotnet test` xanh không trả lời được câu này.
---

# Diễn tập phát hành NuGet

## Vì sao có skill này

- Mọi test .NET trong repo dùng `ProjectReference`: chạy chính mã nguồn, cùng `Directory.Build.props`. Người cài từ
  NuGet chỉ có file `.nupkg`.
- Vì vậy `dotnet test` xanh không chứng minh được rằng gói cài từ NuGet chạy được.
- Những lỗi chỉ lộ ra sau khi đóng gói và cài:
  - gói thiếu `README.md`, `NOTICE`, `LOGOS-NOTICE.md` hay file XML doc;
  - thiếu khung đích (`netstandard2.0`), hay thừa;
  - ảnh logo không được nhúng vào DLL (đường dẫn `EmbeddedResource` sai thì build vẫn xanh);
  - dependency giữa các gói sai số phiên bản, hay `ProjectReference` không thành dependency;
  - `TingQR.AspNetCore` thiếu `frameworkReference Microsoft.AspNetCore.App`;
  - cấu hình sai không chặn được app khởi động khi chạy ngoài test host.
- Skill riêng, không gộp vào `release-drill` (npm): hai đường phát hành độc lập (tag `ts-v*` và `dotnet-v*`, hai
  workflow), skill npm đã dài và cài từ registry npm.

## Cách chạy

Từ gốc repo:

```bash
node .claude/skills/release-drill-dotnet/scripts/drill.mjs            # kiểm
node .claude/skills/release-drill-dotnet/scripts/drill.mjs --out dir  # kiểm, rồi chép 4 .nupkg + 4 .snupkg vào dir
```

- **Bước này gọi mạng tới nuget.org**: `dotnet new` và restore lấy từ nuget.org mọi gói không phải `TingQR.*`. Báo chủ
  dự án trước khi chạy ở máy.
- Mất khoảng nửa phút đến vài phút (lần đầu lâu hơn vì restore vào thư mục gói riêng của lần chạy).
- Thoát 0 khi cả 6 mục ĐẠT. Có mục HỎNG thì in mục đó, thoát 1 và giữ thư mục tạm (đường dẫn in ở cuối). Muốn giữ cả
  khi đạt: `KEEP_DRILL_ARTIFACTS=1`.
- `--out` là cách lấy đúng các file dùng để phát hành; job `verify` của `release-dotnet.yml` dùng `--out packages`. Chỉ
  chép khi mọi mục đạt.
- Số phiên bản lấy từ `dotnet/Directory.Build.props` (đặt bằng `node dotnet/scripts/set-version.mjs x.y.z`).

## Kiểm gì, vì sao

1. **`dotnet pack dotnet/TingQR.slnx -c Release`** vào thư mục tạm: đúng 4 `.nupkg` + 4 `.snupkg`, đúng số phiên bản.
2. **Nội dung từng `.nupkg`** (script tự đọc zip, không cần công cụ ngoài):
   - có `README.md`; Rendering có `NOTICE`; BankLogos có `LOGOS-NOTICE.md`;
   - BankLogos: số tên tài nguyên `TingQR.BankLogos/icon|logo/...` trong mỗi DLL bằng số mục của
     `conformance/banks/logos/manifest.json` (đếm tên trong bảng chuỗi metadata của DLL);
   - `lib/` có đúng các khung `net10.0` + `netstandard2.0` (AspNetCore chỉ `net10.0`), mỗi khung có `.dll` + `.xml`;
   - `.nuspec`: số phiên bản, giấy phép (MIT; BankLogos là file `LOGOS-NOTICE.md`), `<readme>`, `repository` có
     commit; dependency đúng gói và đúng số (Rendering → Core; AspNetCore → Core, Rendering); AspNetCore có
     `frameworkReference Microsoft.AspNetCore.App`, gói khác không có;
   - `.snupkg` có `.pdb` cho mọi khung.
3. **Project ngoài repo** (thư mục tạm của hệ điều hành, không có `Directory.Build.props` hay `nuget.config` của repo
   phía trên). `nuget.config` chỉ hai nguồn, có package source mapping: `TingQR.*` chỉ từ thư mục vừa đóng gói, mọi gói
   khác chỉ từ nuget.org; thư mục gói (`globalPackagesFolder`) riêng cho lần chạy, để không dùng lại một `TingQR.*`
   cùng số đã cache từ lần trước. `dotnet new console`, `dotnet new web`, `dotnet add package` đúng số (console 3 gói,
   web 4 gói). Kiểm `.nupkg.metadata` của từng gói đã restore: nguồn đúng là thư mục đóng gói.
4. **Console:** `VietQr.Encode` với đầu vào mẫu `vietqr-dynamic-amount-purpose` ra đúng chuỗi của mẫu, `VietQr.Decode`
   đọc lại đúng, `TingQrRender.ToSvg` có logo `BankLogos.Icon("mb")`, in `TingQrVersion.Value` bằng số đã đóng gói.
5. **Web:** `AddTingQr` (tài khoản của mẫu trên), một endpoint Minimal API `WithTingQrSvg()` và một controller
   `[TingQrSvg("logo")]` (profile có logo `BankLogos.Icon("mb")`). Build, chạy thẳng `dotnet web.dll` (không qua
   `dotnet run`, để dừng tiến trình không bỏ sót tiến trình con) trên một cổng trống của `127.0.0.1`, đợi tối đa 60 giây,
   gọi hai route qua HTTP thật (`fetch` của Node): 200, bốn header đúng `conformance/http/svg-response.json`, thân bắt
   đầu `<svg`, chỉ route MVC có logo. Rồi chạy lại với `--DrillBank NOT-A-BANK`: app phải tự dừng trong 60 giây, bằng mã thoát
   khác 0 (Windows: 0xE0434352) hoặc bằng tín hiệu (Linux: ngoại lệ .NET không bắt làm tiến trình nhận SIGABRT), và
   đầu ra phải có `TingQrException` hay `INVALID_VALUE`, để một lỗi khác không lọt (cấu hình sai chặn khởi động). Cách
   xét nằm ở `scripts/bad-config-exit.mjs`, có test `dotnet/scripts/test/drill-bad-config.test.mjs`.
6. **Không còn tiến trình nào chạy:** mọi tiến trình mục 5 khởi động đều đã thoát (script luôn dừng chúng, kể cả khi
   hỏng).

## Khi một mục hỏng

- **Mục 1–2:** xem `.csproj` của gói (`None Pack="true"`, `PackageLicense*`, `TargetFrameworks`, `EmbeddedResource`) và
  `Directory.Build.props`. Mở `.nupkg` trong `<thư mục tạm>/pkgs` (là file zip).
- **Mục 3:** thường do mạng (nuget.org) hay `nuget.config`. Chạy lại `dotnet restore` trong `<thư mục tạm>/consumer/web`.
- **Mục 4–5:** chạy `dotnet run -c Release` trong `<thư mục tạm>/consumer/console` hay `.../web` để thấy lỗi đầy đủ.
- **Đừng sửa diễn tập cho tới khi nó đạt.** Phải tìm xem lỗi nằm ở gói hay ở script. Mỗi lần sửa script phải có lý do
  ghi trong commit.

## Kết quả đã chạy

- 2026-11-24, Windows 11 (10.0.26300), .NET SDK 10.0.203, Node 22.23.3, phiên bản `0.0.0`: cả 6 mục ĐẠT (khoảng 30
  giây khi gói đã build sẵn).
- 2026-11-24, Ubuntu (job `verify` của `release-dotnet.yml`, PR #11, run 45423456218): cả 6 mục ĐẠT; app cấu hình sai
  dừng bằng tín hiệu `SIGABRT` (mục 5 tính là đúng).

## Bẫy đã gặp (Windows)

- `path.relative` giữa hai ổ đĩa (`F:` của repo, `C:` của thư mục tạm) trả về đường dẫn tuyệt đối, không bắt đầu bằng
  `..`: kiểm "ngoài repo" phải xét cả trường hợp đó.
