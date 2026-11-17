# Nghiên cứu và các hướng đi (2026-11-18)

Đây là ghi chép buổi tìm hướng, **chưa phải bản thiết kế**. Bản thiết kế sẽ viết ở `docs/superpowers/specs/` khi chủ
dự án chốt các câu hỏi ở mục 6.

Ký hiệu: **[chủ dự án]** = chủ dự án đã quyết; **[Claude]** = Claude đề xuất, chưa được duyệt; **[?]** = chưa kiểm chứng.

## 1. Ý tưởng và lý do

- Lấy cảm hứng từ `vietqr/vietqr-node` (MIT): port sang TypeScript có kiểu, .NET, kèm tích hợp sẵn cho Angular và NestJS.
- **Mục đích chính: một thư viện mã nguồn mở có tiếng.** [chủ dự án] Dùng phụ trong Noel tree (nhỏ).
- **Muốn đi trước ở QR thanh toán xuyên biên giới.** [chủ dự án]
- **Chọn hướng B: thư viện QR thanh toán Đông Nam Á, Việt Nam làm đầu tàu** (thay vì "thư viện VietQR tốt nhất" hay
  "làm đủ khu vực ngay từ đầu"). [chủ dự án]
- **Không ràng buộc lõi phải thuần JS ngay từ đầu.** Có thể tách bản server và bản client. [chủ dự án]
- **Tên: `tingqr`.** [chủ dự án, chốt 2026-11-18]
  - "Ting ting" là tiếng loa báo nhận tiền quen thuộc ở Việt Nam; tên không gắn khu vực nào nên hợp hướng xuyên biên giới.
  - Ngày 2026-11-18, `tingqr` còn trống trên npm, NuGet, PyPI và GitHub, không repo nào trùng tên; tra DNS chưa thấy
    ai đăng ký `tingqr.com`, `.vn`, `.dev`, `.io` (chưa chắc cho tới khi mua).
  - Đã loại: `seaqr` (chữ "SEA" chật khi mở rộng sang Trung Quốc, Hàn Quốc, Ấn Độ; tài khoản GitHub `seaqr` đã có
    người lấy); `vnqr` (đã có thư viện Python `vnqr` trên PyPI làm đúng VietQR, khoảng 311 lượt tải mỗi tháng; tên miền
    `.com`, `.vn`, `.dev` đã có chủ).
  - Rủi ro đã biết: dev Việt có thể tưởng thư viện lo xác nhận thanh toán. README phải ghi rõ ngay đầu là không làm việc đó.

## 2. Thanh toán QR ở Việt Nam

- **VietQR (NAPAS)** theo chuẩn EMVCo cho QR do bên nhận tiền hiển thị (merchant-presented):
  - Tag 38 chứa GUID `A000000727`, mã BIN ngân hàng 6 số, số tài khoản hoặc số thẻ, và mã dịch vụ `QRIBFTTA`
    (vào tài khoản) hoặc `QRIBFTTC` (vào thẻ).
  - Tag 01: `11` là QR tĩnh, `12` là QR động (có số tiền ở tag 54, nội dung ở tag 62.08).
  - Tiền tệ `704`, quốc gia `VN`. QR cá nhân bỏ các tag 52, 59, 60.
- **MoMo, ZaloPay:** QR nhận tiền thực chất là VietQR.
  - ZaloPay và MoMo bản cũ dùng tài khoản ảo BVBank, BIN `970454`.
  - MoMo bản mới dùng BIN `971025`, số tài khoản dạng `PSP…`, mã tham chiếu `MOMOW2W…` ở tag 62.05.
  - ZaloPay thêm một template chưa có tài liệu ở tag 26.
- **VNPAY-QR:** hệ riêng.
  - Tag 26 với GUID `A000000775`, cửa hàng, máy và mã tham chiếu nằm ở tag 62.
  - Thiếu tag 52 và 60, nên một bộ kiểm EMV chặt sẽ từ chối. Phải có chế độ "chấp nhận lệch chuẩn".
- **ShopeePay** được nói là trả được cả VietQR lẫn VNPAY-QR [?]. **Viettel Money và VNPT Money:** chưa rõ định dạng [?].
- **Đặc tả:** NAPAS không công bố đặc tả chính thức. Các thư viện dựa vào bản "NAPAS IBFT v1.5.2" lan truyền trên mạng.
- **Quy chuẩn của Ngân hàng Nhà nước:**
  - Có quy chuẩn kỹ thuật năm 2018 cho QR merchant-presented, chưa xác định được số hiệu [?].
  - TCCS 04:2024/NHNN cho QR do **khách hàng** hiển thị, hiệu lực từ 15/11/2024.
- Một README nói vietqr.io sẽ tắt API tạo mã (`/v2/generate`) vào 01/01/2027 [?]. Nếu đúng thì sẽ có làn sóng người
  cần chuyển sang thư viện tự tạo mã.

## 3. Thanh toán QR xuyên biên giới

| Nước | Trạng thái (11/2026) |
|---|---|
| Thái Lan | Chạy hai chiều (NAPAS với ITMX), ra mắt chính thức 11/2022 |
| Campuchia | Chạy hai chiều, từ 12/2023 |
| Lào | Chạy hai chiều, từ 01/2025 (LAPNet) |
| Trung Quốc | Khách Trung Quốc trả ở VN: UnionPay 12/2025, Alipay 04/2026. Chiều người Việt trả ở Trung Quốc chưa chắc đã chạy [?] |
| Hàn Quốc | Khách Hàn trả ở VN, từ 04/2026 |
| Singapore | Khách Singapore trả ở VN, từ 07/2026. Có tin nói đã đủ hai chiều [?] |
| Ấn Độ | Mới ký biên bản ghi nhớ 05/2026, mục tiêu trong năm 2026 |
| Đài Loan | Đang dự kiến |
| Nhật, Malaysia, Indonesia, Philippines | Chưa thấy kết nối song phương với VN. VN nằm trong kết nối thanh toán khu vực ASEAN (RPC) từ 2023 |

- **Về kỹ thuật:** app nước ngoài quét thẳng QR Việt Nam, còn app Việt Nam (có lẽ) quét thẳng QR nước ngoài [?];
  phần định tuyến và đổi tiền do hệ thống phía sau lo.
  - Vì vậy giá trị của thư viện là **nhận diện, đọc và tạo được QR của nhiều nước**, không phải chuyển đổi định dạng.
- NAPAS gọi QR quốc tế là "VIETQRGlobal". NAPAS chưa công bố nó khác VietQR trong nước ở đâu [?].
- **VNPAY** có mạng riêng: từ 08/2026, VNPAY-QR nhận cả WeChat Pay, UnionPay, Thái Lan, Lào, Campuchia và Hàn Quốc.
- **Project Nexus** (BIS) là chuyển tiền tức thời giữa các nước, không phải định dạng QR. Dự kiến chạy năm 2027, VN không
  nằm trong nhóm sáng lập.

**Mã nhận diện từng nước:**

| Nước | Mã nhận diện |
|---|---|
| PromptPay (Thái) | Tag 29 `A000000677010111` (chuyển tiền); tag 30 `A000000677010112` (thanh toán hoá đơn); `A000000677012006` (hoá đơn xuyên biên giới) |
| KHQR (Campuchia) | Tag 29 hoặc 30, sub 00 là tài khoản Bakong dạng `ten@nganhang` (không phải GUID); tag 99 là thời điểm hết hạn; tiền tệ 116 hoặc 840 |
| DuitNow (Malaysia) | AID `A0000006150001` |
| QRIS (Indonesia) | Tag 51 `ID.CO.QRIS.WWW`, sub 02 là mã cửa hàng quốc gia (NMID) |
| PayNow / SGQR (Singapore) | Tag 26 `SG.PAYNOW`; vỏ SGQR có thể là tag 51 `SG.SGQR` [?] |
| QR Ph (Philippines) | `ph.ppmi.p2m` (thanh toán cửa hàng); `com.p2pqrpay` (chuyển tiền cá nhân) [?] |
| UPI (Ấn Độ) | Không theo EMV: dạng đường dẫn `upi://pay?pa=…&pn=…&am=…&cu=INR`. BharatQR là bản theo EMV |
| LAO QR (Lào) | Chưa tìm thấy GUID [?] |

## 4. Các thư viện hiện có

- **TypeScript:**
  - `vietnam-qr-pay` (xuannghia) dẫn đầu: 175 sao, khoảng 13 nghìn lượt tải mỗi tháng, không phụ thuộc gói nào.
    - Làm được: tạo và đọc VietQR, VNPAY, MoMo, ZaloPay.
    - Thiếu: không vẽ ảnh, không có gói cho framework, không có logo ngân hàng.
    - Còn lỗi: trường dài quá 99 ký tự làm hỏng chuỗi mà không báo (issue #15).
  - `vietqr` (gói chính chủ, bản 1.2.0 ngày 04/11/2026): tự tạo mã, không cần API, nhưng không có kiểu TypeScript,
    không đọc ngược được, và ảnh có khung trang trí vẫn phải lấy từ img.vietqr.io.
  - `vietqr-node` (nguyenchanh0201): port của VietQR.Core, đã có module NestJS, nhưng chỉ chạy trên Node ≥ 20 và dùng
    canvas native.
  - `@viet-qr/core`: có gói React, Vue và Svelte, **không có Angular**.
- **Angular:** chỉ có `ngx-vietqr`, bỏ dở từ thời Angular 9, 8 lượt tải mỗi tháng.
- **.NET:**
  - `VietQR.Core` (Ngochiendev, 152 sao): vẽ ảnh, đọc ngược, deeplink, có DI, nhưng chỉ làm VietQR.
  - Các bản port của `vietnam-qr-pay` đều bỏ dở. Gói nhiều lượt tải nhất chưa tới 2 nghìn.
- **Nhiều nước Đông Nam Á:**
  - `asean-qr` (TypeScript): VietQR, PromptPay, DuitNow, PayNow, QRIS. Tạo tháng 10/2026, 0 sao. Thiếu KHQR, QR Ph,
    VNPAY, UPI.
  - **Bên .NET chưa có thư viện nào gộp nhiều nước.**
- **Thư viện từng nước** để tham khảo cách làm và bộ mẫu thử:
  - Thái Lan: `promptparse` (225 sao), `promptpay-qr` (331 sao).
  - Indonesia: `qris-dinamis` (551 sao).
  - Campuchia: `ts-khqr`, `bakong-khqr`.
  - Bộ đọc EMV chung: `mvallim/emv-qrcode` (Java), `mercari/go-emv-code` (Go).
- **Phàn nàn phổ biến:**
  - Quét bằng app ngân hàng thì không hiện số tiền hoặc nội dung. **Chưa ai công bố đã thử trên từng app thật.**
  - Danh sách ngân hàng cũ dần, thiếu ngân hàng mới, không có quy trình cập nhật.
  - MoMo đổi định dạng tài khoản.
  - Người dùng hỏi xác nhận thanh toán và webhook, việc nằm ngoài phạm vi của một thư viện QR.

## 5. Các hướng đi

### 5.1 Phạm vi (đề xuất [Claude], khớp hướng B)

- **Lõi EMVCo chung:**
  - Đọc và ghi cấu trúc TLV (mã tag, độ dài, giá trị), kiểm CRC.
  - Báo lỗi rõ ràng khi dữ liệu sai, không tạo chuỗi hỏng.
  - Chế độ chặt và chế độ chấp nhận lệch chuẩn (cho VNPAY và QR thực tế ngoài đời).
- **Mỗi nước hoặc mỗi hệ là một phần gắn thêm** (plugin), gồm: tạo mã, đọc mã, kiểm hợp lệ, và hàm nhận diện theo GUID.
- **`detect(payload)`:** đưa vào một chuỗi QR bất kỳ, trả về loại QR kèm dữ liệu có kiểu đầy đủ.
- **Danh sách ngân hàng và ví:** có logo, có quy trình cập nhật tự động (job định kỳ mở PR).
- **Deeplink mở app ngân hàng:** tự dựng URL, không phụ thuộc cổng của bên thứ ba.
- **Vẽ ảnh:**
  - SVG thuần chạy ở mọi môi trường.
  - Thẻ có khung trang trí (card) bản server, được phép dùng thư viện native (Skia, sharp), theo quyết định không ràng
    buộc ở mục 1.
- **Không làm:** xác nhận đã nhận tiền, webhook, gọi API của vietqr.io.

### 5.2 Cách tổ chức mã nguồn (cần chọn)

- **A. Một repo chứa cả TypeScript lẫn .NET, dùng chung bộ mẫu thử dạng JSON.** [Claude đề xuất]
  - Hai ngôn ngữ chạy cùng một bộ mẫu, nên cho ra kết quả giống hệt nhau. Đây là điểm khác biệt dễ chứng minh.
  - Một chỗ cho issue, star và tài liệu, tốt cho việc gây tiếng.
  - Đổi lại, CI phải chạy cả Node lẫn .NET.
- **B. Hai repo riêng, chia sẻ bộ mẫu bằng một repo con hoặc một gói.**
  - Mỗi bên gọn hơn, nhưng sao dễ chia đôi và hai bên dễ lệch nhau.
- **C. Viết lõi bằng Rust, biên dịch sang WASM cho JS và gọi native từ .NET.**
  - Chỉ một bản logic duy nhất.
  - Nhưng khó đóng góp cho cộng đồng dev Việt, gói nặng hơn, debug khó. Không hợp mục tiêu gây tiếng.

### 5.3 Các gói dự kiến (với cách A)

| npm | NuGet |
|---|---|
| `@tingqr/core`: TLV, CRC, `detect` | `TingQR.Core` |
| `@tingqr/vn`, `@tingqr/th`, `@tingqr/kh`…: từng nước | `TingQR.Schemes.*` |
| `@tingqr/banks`: danh sách ngân hàng và logo | |
| `@tingqr/render`: SVG thuần | `TingQR.Rendering`: SVG, SkiaSharp |
| `@tingqr/render-node`: ảnh card, bản server | |
| `@tingqr/angular`: component, pipe | `TingQR.AspNetCore`: DI, endpoint |
| `@tingqr/nestjs`: module, service | |

Có thể gộp các nước vào `core` lúc đầu, rồi mới tách gói khi đã lớn.

### 5.4 Lộ trình đề xuất [Claude]

1. **v0.1:**
   - Lõi TypeScript tạo và đọc VietQR, cùng bộ mẫu thử chung.
   - SVG.
   - Gói Angular (Angular 21 trở lên, vì Noel tree dùng Angular 21 SSR trên Cloudflare Workers).
2. **v0.2:**
   - Bản .NET đạt cùng bộ mẫu.
   - VNPAY-QR, MoMo, ZaloPay.
   - Gói NestJS.
3. **v0.3:** Thái Lan, Campuchia, Lào (các nước đã kết nối hai chiều với VN). Thêm `detect`.
4. **v0.4 trở đi:**
   - Singapore, Malaysia, Indonesia, Philippines; UPI khi tuyến VN–Ấn Độ chạy.
   - VIETQRGlobal khi NAPAS công bố khác biệt.

### 5.5 Điểm khác biệt để gây tiếng

- **Bảng thử trên app thật:** ghi từng app ngân hàng hoặc ví đã quét mã do thư viện tạo ra, có hiện đúng số tiền và
  nội dung không. Cộng đồng đóng góp qua một mẫu issue.
- **TypeScript và .NET cho ra kết quả giống hệt nhau**, chứng minh bằng cùng một bộ mẫu thử.
- **Thư viện duy nhất hỗ trợ Angular, NestJS và ASP.NET Core.**
- **Một hàm `detect` cho mọi QR thanh toán Đông Nam Á**, kể cả KHQR mà chưa ai làm.
- Hướng dẫn chuyển từ `vietqr`, `vietnam-qr-pay` và api.vietqr.io (nếu tin tắt API là đúng).

## 6. Câu hỏi còn mở (cho buổi sau)

1. **Giữ chỗ tên `tingqr`:** mua tên miền, giữ scope `@tingqr` trên npm và tiền tố
   trên NuGet.
2. **Bảng thử trên app thật:** chủ dự án có những app ngân hàng hoặc ví nào để tự quét thử?
3. **Cách tổ chức mã nguồn:** A, B hay C (mục 5.2)?
4. **Phiên bản tối thiểu được hỗ trợ:**
   - Angular: 21 trở lên, hay thấp hơn để có thêm người dùng?
   - .NET: 8 LTS trở lên?
   - Node: 20 trở lên?
5. **Giấy phép:** MIT (giống các thư viện cùng loại)?
6. **Chỗ đóng gói và phát hành:** GitHub cá nhân hay tạo một organization riêng?
   - Phát hành qua OIDC theo tag, như `zkteco-protocol`.
7. **Thứ tự sau v0.1:** .NET trước hay thêm nước trước?
