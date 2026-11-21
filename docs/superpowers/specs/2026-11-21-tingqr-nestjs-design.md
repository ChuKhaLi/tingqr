# Thiết kế: `@tingqr/nestjs` (Plan 6b)

Ngày: 2026-11-21. Dựa trên spec chung `docs/superpowers/specs/2026-11-18-tingqr-design.md` (mục 2, 3, 5.6) và thiết kế
Plan 6 `docs/superpowers/specs/2026-11-21-tingqr-angular-hono-design.md` (mục 5.3, `@tingqr/hono`).
Mục ghi **[chủ dự án]** là chủ dự án đã quyết; mục **[Claude]** là đề xuất của Claude, chủ dự án có thể sửa.

## 1. Mục đích

- Cho dev backend NestJS **cấu hình tài khoản nhận tiền một lần** rồi tạo QR VietQR ở bất kỳ đâu qua DI, và trả ảnh QR
  (SVG) từ controller của mình mà không tự lo header, mã lỗi hay adapter. Một phần mục tiêu v0.1 (gói tích hợp) và mục
  tiêu lớn: thư viện mã nguồn mở có tiếng.
- Đây đúng là việc Noel tree đang tự làm ở máy chủ (`SEPAY_BANK`, `SEPAY_ACCOUNT` → chuỗi VietQR của đơn), nên lý do để
  dev cài gói là có thật, không chỉ là bọc lại `@tingqr/core`. **[chủ dự án: phương án B]**
- **Chưa có người dùng thật.** Kiểm bằng app mẫu nhỏ trong repo, chạy trên cả Express và Fastify. **[chủ dự án, Plan 6]**

## 2. Phạm vi

### Có

- `TingQrModule.forRoot(options)` và `TingQrModule.forRootAsync({ useFactory, inject, imports })`.
- `TingQrService.paymentQr({ amount?, purpose? })` → chuỗi VietQR tới tài khoản đã cấu hình.
- Decorator `@TingQrSvg(options?)` gắn interceptor: handler trả chuỗi QR (hoặc `null`), interceptor trả ảnh SVG.
  **[chủ dự án: cách 1, interceptor]**
- App mẫu trong repo (test e2e Express và Fastify).
- README, hướng dẫn tiếng Việt, kiểm gói, CI.

### Không làm

- **Route mở** dựng QR từ tham số URL **[chủ dự án, như Hono]**.
- **Controller dựng sẵn** **[Claude]**: route có `resolve` trong NestJS chính là một controller vài dòng của dev (ví dụ ở
  mục 5.3), ngắn hơn một controller cấu hình bằng option.
- **PromptPay, KHQR** trong service **[Claude]**: tài khoản nhận là tài khoản ngân hàng Việt Nam; loại khác thì dev gọi
  `@tingqr/core` trực tiếp. Interceptor thì vẽ chuỗi QR bất kỳ.
- **Nhiều tài khoản nhận** trong một app **[Claude]**: v0.1 một tài khoản. Cần nhiều thì gọi `encodeVietQr` trực tiếp.
- Bọc lại `decode`/`detect`/`encode*` trong service: import thẳng từ `@tingqr/core` là đủ, không nhân đôi API.
- PNG ở máy chủ (gói native sau v0.1).
- Xác nhận thanh toán, webhook (không bao giờ, spec chung).

## 3. Ràng buộc

- NestJS ≥ 10 (spec chung mục 3). Bản hiện tại 12.6. Peer: `@nestjs/common` và `@nestjs/core` `>=10.0.0`, `rxjs` `^7`,
  `reflect-metadata`.
- Chạy trên cả `@nestjs/platform-express` và `@nestjs/platform-fastify`. Gói **không** phụ thuộc adapter nào.
- Chỉ phụ thuộc `@tingqr/core`, `@tingqr/render`.
- Không gọi mạng. Không import `node:*` ngoài những gì NestJS đã cần (gói chạy trên Node).
- Cùng hợp đồng HTTP với `@tingqr/hono` (mục 5.3), để hai gói tích hợp nói cùng một ngôn ngữ.
- Không bao giờ trả ảnh hỏng hay QR thiếu logo được yêu cầu.

## 4. Các cách đã cân nhắc

### 4.1 Service làm gì **[chủ dự án: B]**

| Cách | Nội dung | Được và mất |
|---|---|---|
| A. Bọc mỏng | `encode`/`decode`/`detect`/`toSvg` qua DI | Gần như không hơn import thẳng core |
| **B. Tài khoản nhận** | `forRoot({ bank, accountNumber })`, `paymentQr({ amount, purpose })` | Lý do thật để cài gói; cấu hình sai báo lúc khởi động |

### 4.2 Controller trả SVG thế nào **[chủ dự án: 1]**

| Cách | Được và mất |
|---|---|
| **1. Interceptor** (`@TingQrSvg()`) | Đúng kiểu NestJS, handler chỉ trả chuỗi, chạy cả hai adapter; phải test kỹ header trên Fastify |
| 2. `StreamableFile` + `@Header` | Dev tự gắn header mỗi route, dễ quên CSP |
| 3. Helper với `@Res({ passthrough: true })` | NestJS khuyên tránh `res`; API khác nhau giữa adapter |

## 5. Thiết kế

### 5.1 Cấu hình **[Claude]**

```ts
interface TingQrModuleOptions {
  /** Mã ngân hàng hoặc BIN, tra bằng findBank của @tingqr/core/banks: 'MB', 'mb', '970422', 'VCB'… */
  bank: string
  /** Số tài khoản hoặc số thẻ nhận tiền. */
  accountNumber: string
  /** 'account' (mặc định) hoặc 'card', như VietQrInput.service. */
  service?: 'account' | 'card'
  /** Tuỳ chọn vẽ mặc định cho @TingQrSvg (toSvg + cacheControl). */
  svg?: TingQrSvgOptions
}
```

- **Kiểm lúc khởi động:** `bank` không tra ra BIN, hoặc tài khoản sai định dạng (thử `encodeVietQr` không số tiền),
  hoặc `svg` sai (gồm logo không phải data URI, cùng luật với Hono) thì **app không khởi động được**, lỗi là
  `TingQrError`. Không đợi tới request đầu tiên.
  - Ngân hàng không tra ra dùng mã có sẵn `INVALID_VALUE`, thông báo ghi rõ giá trị `bank` và cách viết đúng.
    **[Claude]** Không thêm mã mới vào `conformance/errors.json` cho việc này.
- `forRootAsync` theo mẫu chuẩn của NestJS (`useFactory`, `inject`, `imports`), để đọc từ `ConfigService`/biến môi trường.
- Module đăng ký **global** hay không: builder chọn; gợi ý `isGlobal` tuỳ chọn, mặc định không.

### 5.2 `TingQrService` **[Claude]**

- `paymentQr({ amount?, purpose? }): string`: gọi `encodeVietQr` với BIN, tài khoản, `service` đã cấu hình. Số tiền,
  nội dung sai thì ném `TingQrError` như core (`INVALID_VALUE`, `NON_ASCII`…).
- `bin` và `bank` (kết quả `findBank`) đọc được, ví dụ để hiện tên ngân hàng trên trang.
- Không có hàm nào khác.

### 5.3 `@TingQrSvg(options?)` **[chủ dự án: interceptor; chi tiết: Claude]**

```ts
@Get('orders/:id/qr.svg')
@TingQrSvg()
async qr(@Param('id') id: string) {
  const order = await this.orders.findPending(id)
  return order ? this.tingqr.paymentQr({ amount: order.amount, purpose: order.code }) : null
}
```

- Decorator gộp `UseInterceptors` + metadata tuỳ chọn của route (ghi đè tuỳ chọn `svg` của module).
- **Dùng được cả khi không có `TingQrModule.forRoot`** **[Claude]**: interceptor inject tuỳ chọn module kiểu tuỳ chọn
  (`@Optional`), không có thì dùng mặc định của `toSvg`. Lý do: vẽ QR PromptPay, KHQR hay QR bất kỳ không cần cấu hình
  tài khoản nhận; một module con dùng decorator mà không import `TingQrModule` cũng không lỗi DI. Chỉ `TingQrService`
  cần `forRoot`.
- **400 và 404 đi qua lớp exception của NestJS** **[Claude]**: interceptor ném `NotFoundException` và
  `BadRequestException({ error: { code, message } })`, không tự ghi vào `res`.
  - Lý do: đúng kiểu NestJS, exception filter và log của app vẫn chạy, và không phải xử lý riêng việc Fastify đã gửi
    phản hồi.
  - Hệ quả: thân 404 là JSON mặc định của NestJS, không phải chữ "404 Not Found" như Hono; filter của app có thể đổi
    thân 400. Phần chung với Hono là **status, header của 200 và mã lỗi trong thân 400** (khi app không đổi filter).
    README ghi rõ điều này.
- Handler trả giá trị không phải chuỗi, `null` hay `undefined` (ví dụ số, object) là lỗi lập trình: ném lỗi thường để
  NestJS trả 500, không đổi thành 400 hay 404. **[Claude]**
- Handler trả:
  - chuỗi khác rỗng → **200**, thân là `toSvg(chuỗi, tuỳ chọn)`;
  - `null`, `undefined`, `''` → **404**;
  - ném `TingQrError` (hoặc chuỗi/tuỳ chọn vẽ sai) → **400**, JSON `{ "error": { "code", "message" } }`, giống Hono.
  - lỗi khác → để NestJS xử lý như thường (exception filter của app), không đổi.
- Header của 200, giống Hono:
  - `Content-Type: image/svg+xml; charset=utf-8`;
  - `X-Content-Type-Options: nosniff`;
  - `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`;
  - `Cache-Control: private, max-age=300` (đổi bằng `cacheControl`).
- Header đặt qua `HttpAdapterHost` (không gọi API riêng của Express hay Fastify).
- Tuỳ chọn ở decorator kiểm lúc khởi động nếu làm được, không thì ở request đầu; logo phải là data URI.
- Interceptor không đọc tham số URL hay query.

### 5.4 Build và test **[Claude]**

- **DI không dựa vào metadata kiểu tham số:** tsup/esbuild không phát `emitDecoratorMetadata`, nên mọi tham số inject
  trong gói dùng `@Inject(TOKEN)` tường minh. Hoặc builder chọn build bằng `tsc`; phải ghi lý do.
- **App mẫu** trong `ts/packages/nestjs/test/` (không phải gói riêng), chạy bằng `@nestjs/testing`:
  - cùng bộ test HTTP chạy hai lần, với Express (supertest hoặc `fetch` tới cổng thật) và Fastify (`inject` hoặc cổng thật);
  - kiểm khởi động lỗi với cấu hình sai, `forRoot` và `forRootAsync`.
- CI chạy trên NestJS **12** (bản mới nhất). NestJS 10 có được thêm một bước CI chạy lại test với dev deps bản 10 hay
  không: builder chọn; nếu không thì README ghi rõ "đã thử trên 12".
- Kiểm gói: chỉ phụ thuộc `core` + `render`, peer NestJS đúng, có `LICENSE`, ngân sách tarball đặt sau khi đo.

### 5.5 Tài liệu

- README tiếng Anh: cấu hình, `forRootAsync` với `ConfigService`, ví dụ controller, vì sao không có route mở, logo phải là
  data URI, phiên bản NestJS và adapter đã thử.
- Thêm mục NestJS vào hướng dẫn `docs/huong-dan/hien-qr-angular-hono.md` (đổi tên file nếu cần, builder chọn).
- Không ghi "chạy trên NestJS 10/11" nếu CI không chạy bản đó.

## 6. Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Header hay thân sai trên Fastify | Cùng bộ test HTTP chạy cả hai adapter |
| DI hỏng vì thiếu metadata sau khi build | Test chạy trên `dist` đã build, như gói Angular |
| Cấu hình sai chỉ lộ khi có request | Test khởi động app với cấu hình sai phải thất bại |
| Lỗi không phải `TingQrError` bị đổi thành 400 | Test: handler ném lỗi khác → status do NestJS quyết (500 mặc định) |
| Chuỗi rỗng, `null` vẫn ra ảnh | Test 404 cho cả ba |
| Logo đường dẫn hay URL ra ô trống | Test: tuỳ chọn như vậy bị từ chối |
| README nói nhiều phiên bản hơn CI chạy | `evidence-review` |

## 7. Để người lập kế hoạch tự quyết

- Tên chính xác (token inject, tên interceptor, tên kiểu), `isGlobal`.
- Build bằng tsup với `@Inject` tường minh hay bằng `tsc`.
- Cách chạy hai adapter trong test; có thêm bước CI NestJS 10 không.
- Ngân sách tarball; có chạy mutation cho gói này không.
- Tên và chỗ của phần hướng dẫn tiếng Việt.
