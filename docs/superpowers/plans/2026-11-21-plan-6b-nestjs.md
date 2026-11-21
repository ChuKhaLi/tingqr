# Plan 6b: `@tingqr/nestjs` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dev NestJS cấu hình tài khoản nhận tiền một lần (`TingQrModule.forRoot` / `forRootAsync`), tạo VietQR bằng
`TingQrService.paymentQr`, và trả ảnh QR SVG từ controller bằng `@TingQrSvg()`, chạy trên Express lẫn Fastify.

**Architecture:**
- Gói `ts/packages/nestjs`, build bằng tsup (ESM + CJS).
- Mọi tham số inject trong gói dùng `@Inject(TOKEN)` tường minh, vì esbuild không phát decorator metadata.
- Interceptor đặt header qua `HttpAdapterHost`. Lỗi đi qua lớp exception của NestJS (`NotFoundException`,
  `BadRequestException`).
- Test chạy trên `dist` đã build, với một app mẫu dựng bằng `@nestjs/testing` trên cả hai adapter.

**Tech Stack:**
- NestJS 12 (`@nestjs/common`, `@nestjs/core`, `@nestjs/testing`, `@nestjs/platform-express`, `@nestjs/platform-fastify`);
- `rxjs` 7, `reflect-metadata`;
- tsup, Vitest (workspace).

**Spec:** `docs/superpowers/specs/2026-11-21-tingqr-nestjs-design.md` (chủ dự án duyệt 2026-11-21). Hợp đồng HTTP lấy từ
`ts/packages/hono/src/index.ts`.

## Global Constraints

- **Dependency:**
  - `dependencies` đúng `@tingqr/core` và `@tingqr/render` (`workspace:*`);
  - `peerDependencies`: `@nestjs/common` và `@nestjs/core` `>=10.0.0`, `rxjs` `^7.0.0`, `reflect-metadata` `>=0.1.13`;
  - không phụ thuộc adapter nào.
- **Header của 200, đúng từng chữ như Hono:**
  - `Content-Type: image/svg+xml; charset=utf-8`;
  - `X-Content-Type-Options: nosniff`;
  - `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`;
  - `Cache-Control: private, max-age=300`, mặc định, đổi bằng `cacheControl`.
- **Status:**
  - chuỗi khác rỗng → 200;
  - `null`, `undefined`, `''` → 404 (`NotFoundException`);
  - `TingQrError` → 400 (`BadRequestException({ error: { code, message } })`);
  - giá trị khác (số, object) → lỗi thường, NestJS trả 500;
  - lỗi không phải `TingQrError` → để nguyên.
- **Logo** trong mọi tuỳ chọn SVG phải là `data:image/…`, cùng thông báo như Hono. Sai thì ném `INVALID_VALUE`.
- **Cấu hình sai thì app không khởi động:** ngân hàng không tra ra, tài khoản sai, logo không phải data URI. Mã lỗi
  `INVALID_VALUE`, không thêm mã mới vào `conformance/errors.json`.
- Không có route mở, không đọc query. Không gọi mạng.
- README chỉ ghi phiên bản NestJS và adapter mà CI thật sự chạy.

## Review Focus

1. **Fastify ghi đè `Content-Type`.** Header đặt trong interceptor có thể bị serializer của Fastify đổi thành
   `text/plain` hay `application/json` khi thân là chuỗi. Mong đợi: đúng `image/svg+xml; charset=utf-8` trên cả hai adapter.
   Test ở Task 3: `same contract on <adapter>`.
2. **Handler bất đồng bộ.** Handler trả `Promise<string>` hoặc `Observable<string>` phải cho cùng kết quả như trả chuỗi
   ngay. Test ở Task 2.
3. **Handler ném `TingQrError` trước khi có giá trị** (ví dụ `paymentQr` với nội dung có dấu). Phải ra 400 có mã, không
   ra 500. Test ở Task 3.
4. **`forRootAsync` có factory lỗi**, hoặc factory trả cấu hình sai: `app.init()` phải thất bại, không được khởi động
   rồi mới lỗi ở request. Test ở Task 1.
5. **Express thêm hay đổi `charset`** khi `res.send(string)`. Mong đợi: header đúng từng chữ như Hono. Test ở Task 3,
   chung bài test với điểm 1.

---

### Task 1: Gói, `TingQrModule`, `TingQrService`

**Files:**
- Create: `ts/packages/nestjs/{package.json,tsconfig.json,tsconfig.test.json,tsup.config.ts,vitest.config.ts,LICENSE}`
  (khuôn của `hono`; `LICENSE` chép từ repo; `vitest.config.ts` alias `@tingqr/nestjs` → `dist/index.js` như gói angular)
- Create: `ts/packages/nestjs/src/{index.ts,tokens.ts,module.ts,service.ts,options.ts}`
- Test: `ts/packages/nestjs/test/module.spec.ts`, `test/payload.ts` (chuỗi có nguồn từ `conformance/vectors`, như angular)

**Interfaces:**
- Produces:
  ```ts
  export interface TingQrSvgOptions extends SvgOptions { cacheControl?: string }   // same shape as @tingqr/hono
  export interface TingQrModuleOptions { bank: string; accountNumber: string; service?: 'account' | 'card'; svg?: TingQrSvgOptions }
  export interface TingQrModuleAsyncOptions { imports?: any[]; inject?: any[]; useFactory: (...args: any[]) => TingQrModuleOptions | Promise<TingQrModuleOptions>; isGlobal?: boolean }
  export const TINGQR_OPTIONS: unique symbol            // provider token: validated options + bin
  export class TingQrModule { static forRoot(o: TingQrModuleOptions & { isGlobal?: boolean }): DynamicModule; static forRootAsync(o: TingQrModuleAsyncOptions): DynamicModule }
  export class TingQrService {
    readonly bin: string            // from findBank
    readonly bank: Bank             // findBank result (@tingqr/core/banks)
    paymentQr(input?: { amount?: number | string; purpose?: string }): string   // encodeVietQr with configured bin/account/service
  }
  export function checkServedLogo(options: SvgOptions | undefined): void  // INVALID_VALUE unless logo href is data:image/
  ```
- `index.ts` export đủ các thứ trên. Riêng `checkServedLogo` chỉ dùng nội bộ, không export ra ngoài.

- [ ] **Step 1: Khung gói.**
  - devDependencies: `@nestjs/common@^12`, `@nestjs/core@^12`, `@nestjs/testing@^12`, `@nestjs/platform-express@^12`,
    `@nestjs/platform-fastify@^12`, `rxjs@^7`, `reflect-metadata`.
  - tsconfig có `experimentalDecorators: true`, lib `ES2022`.
  - `test/setup.ts` import `reflect-metadata`.
- [ ] **Step 2: Viết test** (`module.spec.ts`, mỗi test dựng `Test.createTestingModule({ imports: [TingQrModule.forRoot(...)] })`
  rồi `compile()`):
  - `forRoot({ bank: 'MB', accountNumber: '0123456789' })`:
    - `service.bin === '970422'`;
    - `paymentQr({ amount: 50000, purpose: 'TINGQR TEST' })` bằng đúng `payload` của vector
      `vietqr-dynamic-amount-purpose`;
    - `paymentQr()` bằng `encodeVietQr({ bankBin: '970422', accountNumber: '0123456789' })`.
  - `bank` viết thường (`'mb'`) hay là BIN (`'970422'`) cũng được.
  - `service: 'card'` cho ra chuỗi `QRIBFTTC`, bằng đúng `encodeVietQr` với `service: 'card'`.
  - Cấu hình sai thì `compile()` reject với `TingQrError` mã `INVALID_VALUE`:
    - `bank: 'NOPE'` (thông báo có chữ `NOPE`);
    - `accountNumber: '12'`;
    - `svg: { logo: { href: '/logo.png' } }`;
    - `svg: { foreground: '#ffffff' }`.
  - `paymentQr({ purpose: 'Tiền hàng' })` ném `NON_ASCII`.
  - `forRootAsync({ useFactory: async () => ({ bank: 'VCB', accountNumber: '0123456789' }) })` thì `bin === '970436'`.
  - `forRootAsync` với `inject` một provider cấu hình (module test có provider `CONFIG`) dùng đúng giá trị của nó.
  - `forRootAsync` có factory reject, hoặc trả `bank: 'NOPE'`, thì `compile()` reject.
  - `isGlobal: true` thì một module con không import `TingQrModule` vẫn inject được `TingQrService`.
- [ ] **Step 3:** Chạy `pnpm -C ts/packages/nestjs build; pnpm -C ts/packages/nestjs test`. Kết quả mong đợi: FAIL.
- [ ] **Step 4: Viết module và service.**
  - Provider `TINGQR_OPTIONS` dùng `useFactory`: kiểm hết cấu hình (`findBank`, `encodeVietQr` thử, `layout`/`toSvg` thử với
    tuỳ chọn `svg`, `checkServedLogo`), rồi trả `{ ...options, bin, bankInfo }`. Factory ném thì `compile()` reject.
  - `TingQrService` có constructor `@Inject(TINGQR_OPTIONS)`.
- [ ] **Step 5:** Chạy `pnpm -C ts install && pnpm -C ts/packages/nestjs build && pnpm -C ts/packages/nestjs test`. Kết quả
  mong đợi: PASS.
- [ ] **Step 6:** Commit `feat(nestjs): TingQrModule (forRoot, forRootAsync) and TingQrService.paymentQr`.

### Task 2: `@TingQrSvg()` và interceptor

**Files:**
- Create: `ts/packages/nestjs/src/svg.ts`
- Test: `ts/packages/nestjs/test/interceptor.spec.ts`

**Interfaces:**
- Consumes: `TINGQR_OPTIONS`, `TingQrSvgOptions`, `checkServedLogo` (Task 1).
- Produces:
  ```ts
  export const TINGQR_SVG_ROUTE: string                       // metadata key for per-route options
  export class TingQrSvgInterceptor implements NestInterceptor // @Inject(HttpAdapterHost), @Inject(Reflector), @Optional() @Inject(TINGQR_OPTIONS)
  export function TingQrSvg(options?: TingQrSvgOptions): MethodDecorator & ClassDecorator
  ```
  `TingQrSvg` = `applyDecorators(SetMetadata(TINGQR_SVG_ROUTE, options), UseInterceptors(TingQrSvgInterceptor))`.
  Tuỳ chọn của route ghi đè tuỳ chọn `svg` của module theo từng khoá (`{ ...moduleSvg, ...routeOptions }`).
  `checkServedLogo` chạy trên tuỳ chọn của route ngay khi decorator được gọi, nên lỗi lộ ra lúc nạp class.

- [ ] **Step 1: Viết test.** Gọi thẳng `intercept()` với `ExecutionContext` và `CallHandler` giả. Adapter giả ghi lại các
  lệnh `setHeader`; thiếu `TINGQR_OPTIONS` thì truyền `undefined`.
  - Chuỗi hợp lệ:
    - kết quả là `toSvg(PAYLOAD)`;
    - adapter nhận đúng bốn header ở Global Constraints;
    - giá trị là `Promise.resolve(PAYLOAD)` hay `of(PAYLOAD)` thì kết quả như nhau.
  - `cacheControl` của route ghi đè mặc định; `margin` của module được dùng khi route không có.
  - Không có `TINGQR_OPTIONS` (không gọi `forRoot`) vẫn vẽ được, dùng mặc định của `toSvg`.
  - `null`, `undefined`, `''` ném `NotFoundException`, và không đặt header nào.
  - Tuỳ chọn vẽ sai (`foreground: '#fff'`) ném `BadRequestException`, `getResponse()` bằng
    `{ error: { code: 'INVALID_VALUE', message: <đúng thông báo của toSvg> } }`.
  - Handler ném `TingQrError('NON_ASCII', …)` thì ra `BadRequestException` với mã `NON_ASCII`.
  - Handler ném `new Error('db')` thì lỗi đó đi ra nguyên vẹn (cùng đối tượng).
  - Handler trả `42` hay `{}` thì ném lỗi không phải `HttpException`.
  - `TingQrSvg({ logo: { href: 'https://x/l.png' } })` ném `INVALID_VALUE` ngay khi được gọi.
- [ ] **Step 2:** Build rồi chạy test. Kết quả mong đợi: FAIL.
- [ ] **Step 3:** Viết `svg.ts`.
  - Đặt header bằng `httpAdapterHost.httpAdapter.setHeader(response, name, value)` trong `map`, sau khi `toSvg` đã thành
    công, để lỗi thì không có header ảnh.
  - Bắt lỗi trong `catchError` của luồng `next.handle()`; lỗi ném đồng bộ thì bọc bằng `defer`.
- [ ] **Step 4:** Build rồi chạy test. Kết quả mong đợi: PASS.
- [ ] **Step 5:** Commit `feat(nestjs): @TingQrSvg interceptor — SVG with the Hono contract, 404/400 via Nest exceptions`.

### Task 3: App mẫu trên Express và Fastify

**Files:**
- Test: `ts/packages/nestjs/test/app.spec.ts`, `test/sample-app.ts`

**Interfaces:**
- Consumes: mọi export của Task 1–2.

- [ ] **Step 1: App mẫu** (`sample-app.ts`):
  - `OrdersController` có route `GET /orders/:id/qr.svg` dùng `@TingQrSvg()` và `paymentQr`:
    - `A1` → 50 000 đ, `TINGQR TEST`;
    - `NONE` → `null`;
    - `ACCENT` → `paymentQr({ purpose: 'Tiền' })`;
    - `BOOM` → ném `Error`.
  - Một route vẽ PromptPay `GET /pp.svg`, dùng chuỗi PromptPay có nguồn từ `conformance/vectors/promptpay`, không qua
    service.
  - Một module con dùng `@TingQrSvg()` mà không import `TingQrModule`.
  - Mọi tham số inject dùng `@Inject(...)` tường minh.
- [ ] **Step 2: Viết test.** Chạy `describe.each([['express', ExpressAdapter], ['fastify', FastifyAdapter]])`, tên
  `same contract on %s`. Dựng app bằng `NestFactory.create(AppModule, new Adapter())`, `listen(0)`, rồi gọi bằng `fetch`
  tới cổng thật.
  - `/orders/A1/qr.svg`:
    - 200;
    - thân bằng đúng `toSvg(<payload của vector vietqr-dynamic-amount-purpose>)`;
    - bốn header đúng **từng chữ**.
  - `/orders/NONE/qr.svg` → 404, `content-type` không chứa `svg`.
  - `/orders/ACCENT/qr.svg` → 400, JSON `error.code === 'NON_ASCII'`.
  - `/orders/BOOM/qr.svg` → 500.
  - `/orders/A1/qr.svg?acc=999&bank=970436&amount=1` → thân y như không có query.
  - `/pp.svg` → 200, thân là `toSvg` của chuỗi PromptPay.
  - Route của module con → 200.
  - Khởi động app với `bank: 'NOPE'` thì `NestFactory.create` hoặc `init()` reject.
- [ ] **Step 3:** Chạy test. Kết quả mong đợi: các test hợp đồng đều PASS. Nếu Fastify đổi `Content-Type` (Review Focus 1)
  thì đó là lỗi của Task 2: sửa ở `svg.ts`, ví dụ đặt header qua adapter và trả `Buffer`, rồi chạy lại cả hai adapter.
- [ ] **Step 4:** Commit `test(nestjs): sample app — same contract on Express and Fastify`.

### Task 4: Kiểm gói, CI, tài liệu

**Files:**
- Create: `ts/scripts/check-nestjs-package.mjs`, `ts/packages/nestjs/README.md`
- Modify: `ts/package.json` (`check:nestjs`), `.github/workflows/ci-ts.yml`, `ts/CLAUDE.md`, `CLAUDE.md`
- Modify: `docs/huong-dan/hien-qr-angular-hono.md` (thêm mục NestJS; đổi tên file thành `hien-qr-angular-hono-nestjs.md`
  và sửa mọi link trỏ tới nó)

- [ ] **Step 1: Script kiểm gói** theo khuôn `check-hono-package.mjs`:
  - `dependencies` và `peerDependencies` đúng như Global Constraints;
  - có `LICENSE` giống của repo;
  - `require('@tingqr/nestjs')` có đủ `TingQrModule`, `TingQrService`, `TingQrSvg`, `TingQrSvgInterceptor`;
  - ngân sách tarball = cỡ đo được, làm tròn lên 1 000 byte rồi cộng 25%, ghi ngày.
- [ ] **Step 2:** Thêm một bước vào CI, sau bước kiểm `angular`.
- [ ] **Step 3: README tiếng Anh**, gồm:
  - `forRoot`, `forRootAsync` với `ConfigService`, ví dụ controller;
  - vì sao không có route mở; logo phải là data URI;
  - hợp đồng HTTP, kể cả việc thân 404 và 400 đi qua filter của app;
  - thư viện không xác nhận thanh toán;
  - "tested on NestJS 12 with Express and Fastify" (đúng phiên bản trong lockfile);
  - ghi chú: app build bằng esbuild/SWC không phát metadata thì phải dùng `@Inject(TingQrService)`.
- [ ] **Step 4:** Thêm mục NestJS vào hướng dẫn tiếng Việt. Cập nhật `ts/CLAUDE.md` (gói mới, test chạy trên `dist`,
  `@Inject` tường minh) và `CLAUDE.md` (Plan 6b).
- [ ] **Step 5:** Chạy `pnpm test:all && pnpm typecheck:all && pnpm build:all`, rồi sáu script `check:*`. Kết quả mong
  đợi: tất cả PASS, `ok`.
- [ ] **Step 6:** Commit `ci+docs: @tingqr/nestjs package check, README, guide`. Đẩy nhánh, mở PR nháp, xem CI đạt.

### Task 5: Review trước khi gộp

- [ ] **Step 1:** Chạy song song `evidence-review` và `parity-review`; sửa những điểm được nhận.
- [ ] **Step 2:** Code review cả nhánh bằng reviewer mới, model mạnh nhất. Sửa điểm Critical/Important, mỗi điểm có test
  đỏ trước.
- [ ] **Step 3:** superpowers:finishing-a-development-branch.
