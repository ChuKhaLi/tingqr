# Thiết kế: bản .NET, phần vẽ QR — Plan 8b (2026-11-23)

Thuộc Plan 8 (bản .NET). 8a (`TingQR.Core`) đã gộp `main` (PR #10). 8c là `TingQR.AspNetCore`, `TingQR.BankLogos`,
phát hành NuGet. Nguồn: spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md` (5.6), thiết kế phần vẽ bản TS
`docs/superpowers/specs/2026-11-19-tingqr-render-design.md`, thiết kế 8a
`docs/superpowers/specs/2026-11-22-tingqr-dotnet-core-design.md`.

## Ý định

Bản .NET phải vẽ được QR, và phải vẽ **giống hệt** bản TS: cùng ma trận điểm ảnh với cùng chuỗi và tuỳ chọn (spec chung,
5.6), và cùng chuỗi SVG, vì hợp đồng HTTP chung (`conformance/http/svg-response.json`) ghi thân trả về là
`toSvg(payload, options)` và `TingQR.AspNetCore` (8c) sẽ trả đúng chuỗi đó.

- **Mục tiêu:** gói `TingQR.Rendering` làm được phần `@tingqr/render` làm ở máy chủ: `ToMatrix`, `ToSvg`, logo ở giữa,
  mọi luật kiểm tuỳ chọn (viền, màu và độ tương phản, cỡ, logo, ECC), `CheckSvgOptions`. Đạt cả 27 mẫu
  `conformance/vectors/render/` và các mẫu SVG mới (dưới).
- **Không làm:** vẽ PNG trên canvas (`@tingqr/render/canvas` chỉ chạy trong trình duyệt); vẽ PNG phía máy chủ (spec chung:
  sau v0.1, gói riêng, được dùng thư viện native); trang quét thử; phát hành NuGet (8c).
- **Không được:**
  - một ma trận hay chuỗi SVG khác bản TS với cùng đầu vào;
  - bọc thư viện QR khác (chủ dự án, 2026-11-18);
  - dependency lúc chạy ngoài `TingQR.Core`.

## Cách làm (đã chọn)

| Cách | Đánh giá |
|---|---|
| **1. Port `ts/packages/render/src/qrcodegen.ts` (Nayuki v1.8.0, bản trong repo) sang C# từng dòng** (chọn) | Cùng một nguồn với bản TS, so dòng với dòng được; mẫu ma trận sinh từ đúng file Nayuki gốc này |
| 2. Chép `manuelbl/QrCodeGenerator` (C#, MIT) | Ít việc hơn, nhưng là một bản port khác của Nayuki, có thể khác phiên bản, kéo theo API thừa; chỉ dựa vào 27 mẫu để tin là khớp |

Chủ dự án chọn cách 1 (2026-11-23). Spec chung 5.6 từng ghi "port từ `manuelbl/QrCodeGenerator`"; quyết định này thay
nó (ghi lại trong spec chung khi làm).

## Phạm vi

Tương ứng `ts/packages/render/src/` trừ `canvas.ts`:

| TypeScript | .NET (đề xuất, **[Claude]**) |
|---|---|
| `qrcodegen.ts` (Nayuki, đã sửa theo danh sách ở đầu file) | `internal` `QrCode`/`QrSegment`… trong `TingQR.Rendering`, file riêng, giữ nguyên header giấy phép MIT của Nayuki và danh sách thay đổi của tingqr; ghi công trong `NOTICE` của gói |
| `toMatrix(text, options)` → `QrMatrix { size, version, ecc, mask, modules }` | `TingQrRender.ToMatrix(string text, MatrixOptions? options = null)` → `QrMatrix` (bất biến) |
| `toSvg(text, options)` | `TingQrRender.ToSvg(string text, SvgOptions? options = null)` → `string` |
| `checkSvgOptions(options)` | `TingQrRender.CheckSvgOptions(SvgOptions? options)` |
| `MatrixOptions`, `SvgOptions`, `LogoOptions`, `Ecc` | record cùng tên, thuộc tính `init`; `Ecc` là enum |
| `layout.ts`, `logo.ts`, `color.ts` | `internal`, cùng luật và cùng thông báo ý nghĩa |

- **Lỗi:** mọi đầu vào hay tuỳ chọn sai ném `TingQrException` (`INVALID_VALUE`) của `TingQR.Core`, như bản TS ném
  `TingQrError`. `null` thay cho đối tượng tuỳ chọn là "mặc định"; `null` thay cho `text` là `INVALID_VALUE`.
- **Văn hoá:** mọi số trong SVG (toạ độ, `viewBox`, cỡ) viết bằng `CultureInfo.InvariantCulture`, đúng như JS
  `String(n)`. Test dưới `tr-TR` và `de-DE`.
- **Số thực:** luật tương phản (`≥ 4.5:1`, độ sáng tương đối) và cỡ logo dùng số thực. Bản .NET phải dùng `double` và
  đúng công thức, thứ tự phép tính của bản TS, để ca biên cho cùng kết quả. Có mẫu thử ngay sát ngưỡng.
- **Đếm ký tự:** như 8a, chuỗi C# là UTF-16; chế độ byte mã hoá UTF-8; surrogate lẻ là `INVALID_VALUE` (mẫu
  `render-invalid-lone-surrogate`).

## Mẫu thử

- **27 mẫu ma trận có sẵn** (`kind: "matrix"`, `scheme: "render"`): bộ chạy .NET mới trong project test của gói, so
  đúng luật ở `conformance/README.md` (mục "Mẫu ma trận") như bộ chạy TS `ts/packages/render/test/matrix-conformance.spec.ts`.
- **Mẫu SVG mới** (cần cho 8c, hiện chưa có): `kind: "svg"`, `scheme: "render"`, `input: { text, options }`,
  `expected: { svg }`; và mẫu lỗi tuỳ chọn (`kind: "encode-invalid"`, `scheme: "render"`, `error`).
  - Sinh bằng một script mới (`conformance/tools/render/gen-svg.mjs` hay tương đương) chạy `toSvg` của bản TS đã build.
    **Nguồn ghi rõ:** "đầu ra của `@tingqr/render` (TypeScript) ở commit …; mẫu vàng để hai bản khớp nhau, không phải
    oracle độc lập". Ma trận bên trong SVG đã được 27 mẫu oracle bảo đảm; mẫu SVG chỉ ghim phần trình bày.
  - Phủ: mặc định; viền 0 và lớn; màu tuỳ chọn; nền `transparent`; `size` số và chuỗi độ dài (`40mm`, `100%`); logo với
    `size`, `padding`, `background`; ECC khác nhau; văn bản byte có chữ Khmer/emoji; ca tương phản sát ngưỡng (đạt và
    không đạt); mỗi lỗi tuỳ chọn mà `toSvg`/`checkSvgOptions` có.
  - Bộ chạy TS của `render` cũng chạy các mẫu này (bản TS không được lệch khỏi mẫu của chính nó).
  - Cập nhật `vectors.schema.json` cho kind mới, và `conformance/README.md`.
  - **Phân biệt mẫu lỗi tuỳ chọn SVG với mẫu lỗi ma trận có sẵn** **[Claude]**: mẫu lỗi SVG có `input.options` khác
    rỗng hoặc trường `"render": "svg"` (builder chọn một, ghi luật ở `conformance/README.md`); bộ chạy gọi `ToSvg` cho
    chúng, `ToMatrix` cho các mẫu `render-invalid-*` cũ (không sửa). Bộ chạy của `core` (TS và .NET) vẫn bỏ qua
    `scheme: "render"`.
  - **Số không nguyên trong SVG** **[Claude]**: chỉ `size` dạng số là số thực. Viết bằng một hàm định dạng riêng cho ra
    đúng `String(n)` của JS (dạng ngắn nhất, không mũ trong khoảng `size` hợp lệ), không dựa vào `double.ToString("R")`
    vì `net481` không bảo đảm dạng ngắn nhất. Có mẫu `size` không nguyên (ví dụ `100.5`, `0.1`).

## Ràng buộc

- Khung đích như `TingQR.Core`: `net10.0` + `netstandard2.0`; test thêm `net481` trên Windows. Không dependency lúc chạy
  ngoài `TingQR.Core` (ProjectReference; khi đóng gói ở 8c là PackageReference).
- Cấu trúc: `dotnet/src/TingQR.Rendering`, `dotnet/tests/TingQR.Rendering.Tests`, thêm vào `dotnet/TingQR.slnx`.
- **File port Nayuki không chạy mutation** (như bản TS); phần còn lại của gói chạy Stryker.NET ngưỡng 90%, cùng luật
  `disable` như `dotnet/CLAUDE.md`. `mutation-dotnet.yml` chạy cả hai gói.
- `ci-dotnet.yml` không cần đổi trigger (đã có `dotnet/**`, `conformance/**`); thêm bước nếu có script sinh mẫu cần kiểm.
- Không sửa mẫu ma trận có sẵn. Mẫu SVG mới phải sinh bằng script, không viết tay.
- Trước khi gộp: `evidence-review`, `parity-review`, review cả nhánh; push qua PR để CI chạy trên Ubuntu.

## Để builder quyết

- Tên lớp tĩnh (`TingQrRender` là đề xuất), cách biểu diễn `size` của SVG (số hay chuỗi độ dài), tổ hợp kiểu cho tuỳ
  chọn, miễn mọi `input`/`options` của mẫu biểu diễn được và tên khớp bảng đối chiếu trong README của gói.
- Cách tổ chức script sinh mẫu SVG và danh sách mẫu cụ thể, trong phạm vi phủ ở trên.
- Có cần thêm mẫu kiểm kiểu (như 8a) cho tuỳ chọn sai kiểu JSON không; nếu cần, thêm vào danh sách ở `conformance/README.md`.
