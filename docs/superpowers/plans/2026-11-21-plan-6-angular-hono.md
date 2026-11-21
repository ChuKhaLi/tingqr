# Plan 6: `@tingqr/render/canvas`, `@tingqr/hono`, `@tingqr/angular` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dev hiện QR thanh toán trong Angular (SSR) và trả ảnh QR từ máy chủ Hono, kèm PNG vẽ ở trình duyệt để nhấn giữ
lưu được trong Zalo hay Messenger; thử cả ba trên một nhánh của Noel tree.

**Architecture:**
- **`@tingqr/render`**:
  - Phần kiểm tuỳ chọn và tính bố cục (ma trận, viền, màu, ô logo) tách ra `src/layout.ts`.
  - `toSvg` và subpath mới `@tingqr/render/canvas` dùng chung phần đó.
  - Subpath canvas chỉ có bản ESM.
- **`@tingqr/hono`** (tsup, ESM + CJS):
  - hàm `tingqrSvg` trả `Response` SVG;
  - route `tingqr({ resolve })`.
- **`@tingqr/angular`** (ng-packagr, toolchain Angular 20):
  - component `<tingqr-code>` có ba chế độ: `svg`, `img`, `auto`;
  - pipe `tingqrSvg`.
- **Noel tree** chỉ cài các gói từ file `.tgz` trên nhánh thử, không gộp vào `main` bên đó.

**Tech Stack:**
- Đang dùng: TypeScript 5.9, tsup, Vitest, Stryker.
- Thêm:
  - esbuild cho test tree-shaking;
  - Hono 4;
  - Angular 20 (`@angular/core`, `common`, `platform-browser`, `platform-server`, `compiler`, `compiler-cli`);
  - ng-packagr 20;
  - `@analogjs/vite-plugin-angular` và jsdom để test Angular trong Vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-tingqr-angular-hono-design.md` (chủ dự án duyệt 2026-11-21). Spec chung
`docs/superpowers/specs/2026-11-18-tingqr-design.md` mục 3, 5.6, 5.11.

## Global Constraints

- **Dependency:**
  - `@tingqr/core` không có dependency, không import `node:*`.
  - `@tingqr/render` chỉ phụ thuộc `@tingqr/core`.
  - `@tingqr/hono` không import `node:*`; `hono` là `peerDependency` `^4.0.0`.
- **Ngân sách tarball `render`: 33 000 byte** (chủ dự án duyệt 2026-11-21). Ngân sách hai gói mới đặt sau khi đo (Task 7).
- **Phiên bản:** Angular ≥ 20 (peer `>=20.0.0`), Node ≥ 20 (CI chạy 20, 22, 24; Angular 20 đòi ≥ 20.19).
- **Không bao giờ hiện hay trả QR sai:**
  - chuỗi hay tuỳ chọn sai thì báo lỗi, không vẽ gì;
  - đổi chuỗi thì ảnh cũ biến mất ngay;
  - kết quả vẽ của chuỗi cũ về muộn thì bỏ đi.
- **Giới hạn logo giữ nguyên** (`MAX_CLEARED_SHARE` 0.1, `size` ≤ 0.25) và áp dụng y hệt cho canvas qua code dùng chung.
- **Mã lỗi:**
  - chỉ dùng mã trong `conformance/errors.json`;
  - Task 1 thêm đúng ba mã: `LOGO_LOAD_FAILED`, `CANVAS_TAINTED`, `NO_CANVAS`;
  - tuỳ chọn sai vẫn là `INVALID_VALUE` với cùng thông báo như `toSvg`.
- **Không có route mở:** không gói nào dựng QR từ tham số URL hay query string.
- **Ngôn ngữ:** tài liệu và commit message theo quy ước repo (tài liệu tiếng Việt; code, tên API, comment tiếng Anh).
- **Bằng chứng:** README và tài liệu không ghi "lưu được trong Zalo/Messenger" hay "chạy trên Angular 21" khi chưa có kết
  quả thử ghi lại (Task 8, `conformance/scans.md`).
- **Noel tree:**
  - chỉ làm trên nhánh `try/tingqr`, không push, không gộp;
  - đọc `../noel-tree/CLAUDE.md` trước khi sửa;
  - không đọc `conformance/private/` của tingqr.

## Review Focus

1. **Đổi `payload` khi PNG của chuỗi cũ chưa vẽ xong:** ảnh của chuỗi cũ không bao giờ hiện, và `png` không phát cho chuỗi
   cũ (Task 6, test `discards a stale PNG when payload changes mid-draw`).
2. **Logo khác nguồn không có CORS:** `toPngBlob` báo `CANVAS_TAINTED`, không trả ảnh rỗng hay ném `SecurityError` trần
   (Task 3, test `maps SecurityError from toBlob to CANVAS_TAINTED`).
3. **Chuỗi sai khi render ở máy chủ:** trang SSR vẫn render xong, component không có SVG, không ném ra ngoài (Task 5, test
   SSR `renders nothing for an invalid payload`).
4. **`resolve` của route Hono ném lỗi không phải `TingQrError`:** lỗi đi tới `app.onError` (500 mặc định), không bị đổi
   thành 400 (Task 4, test `passes non-TingQrError from resolve to onError`).
5. **Chuỗi rỗng `''`** (ví dụ signal chưa có dữ liệu):
   - component không vẽ gì và không phát lỗi;
   - route Hono coi `resolve` trả `''` như `null` → 404.

   `toMatrix('')` vẫn ra một QR hợp lệ, nên phải chặn ở tầng tích hợp (Task 4, 5).

---

### Task 1: Ba mã lỗi mới cho canvas

**Files:**
- Modify: `conformance/errors.json` (mảng `errors`)
- Modify: `ts/packages/core/src/errors.ts` (`ERROR_CODES`)
- Test: `ts/packages/core/test/errors.spec.ts` (test so `ERROR_CODES` với `errors.json` đã có, phải tự đỏ rồi xanh)

**Interfaces:**
- Produces: `ErrorCode` có thêm `'LOGO_LOAD_FAILED' | 'CANVAS_TAINTED' | 'NO_CANVAS'`.

- [ ] **Step 1:** Thêm ba dòng vào `conformance/errors.json`, đúng khuôn `{ code, en, vi }`:
  - `LOGO_LOAD_FAILED`: en "The logo image could not be loaded or decoded (canvas rendering in a browser only)." vi "Không
    nạp hoặc không giải mã được ảnh logo (chỉ khi vẽ trên canvas ở trình duyệt)."
  - `CANVAS_TAINTED`: en "The canvas cannot be exported because a cross-origin logo without CORS tainted it; use a data URI
    or a same-origin image." vi "Không xuất được canvas vì logo khác nguồn, không có CORS, làm canvas bị khoá; dùng data URI
    hoặc ảnh cùng nguồn."
  - `NO_CANVAS`: en "No canvas is available in this environment (canvas rendering needs a browser)." vi "Môi trường này không
    có canvas (vẽ canvas cần trình duyệt)."
- [ ] **Step 2:** Chạy `pnpm -C ts/packages/core test errors`. Kết quả mong đợi: FAIL, vì `ERROR_CODES` lệch với
  `errors.json`.
- [ ] **Step 3:** Thêm ba mã vào cuối `ERROR_CODES`, theo đúng thứ tự trong JSON.
- [ ] **Step 4:** Chạy `pnpm -C ts test` và `pnpm -C ts build && node ts/scripts/check-core-package.mjs` (core vẫn dưới
  45 000 byte). Kết quả mong đợi: PASS và `ok`.
- [ ] **Step 5:** Commit `feat(errors): LOGO_LOAD_FAILED, CANVAS_TAINTED, NO_CANVAS for browser canvas rendering`.

### Task 2: Tách bố cục dùng chung, thêm `drawQr`

**Files:**
- Create: `ts/packages/render/src/layout.ts`
- Modify: `ts/packages/render/src/svg.ts` (gọi `layout`, giữ nguyên hành vi)
- Create: `ts/packages/render/src/canvas.ts`
- Test: `ts/packages/render/test/layout.spec.ts`, `ts/packages/render/test/canvas.spec.ts`,
  `ts/packages/render/test/fake-canvas.ts` (canvas giả dùng cho test)

**Interfaces:**
- Consumes: `toMatrix`, `MatrixOptions`, `SvgOptions`, `LogoOptions`, `logoBox`, `checkLogoBox`, `checkLogoHref`,
  `parseHexColor`, `contrastRatio`, `luminance` (đã có).
- Produces:
  ```ts
  // layout.ts
  export interface Layout {
    modules: boolean[][]; size: number; margin: number
    foreground: string; background: string           // background may be 'transparent'
    logo?: { href: string; background: string; box: LogoBox }
    cleared(x: number, y: number): boolean            // true inside the logo's cleared box
  }
  export function layout(text: string, options: Omit<SvgOptions, 'size'>): Layout
  // canvas.ts
  export interface Canvas2DLike {
    fillStyle: unknown
    fillRect(x: number, y: number, w: number, h: number): void
    clearRect(x: number, y: number, w: number, h: number): void
    drawImage(image: unknown, x: number, y: number, w: number, h: number): void
  }
  export interface CanvasLike { width: number; height: number; getContext(id: '2d'): Canvas2DLike | null }
  export interface CanvasOptions extends Omit<SvgOptions, 'size'> { /** px per module, integer 1–64; default 8 */ scale?: number }
  export function drawQr(canvas: CanvasLike, text: string, options?: CanvasOptions): Promise<void>
  ```
  Kiểu tự khai báo theo cấu trúc, **không** thêm `lib: DOM` vào `tsconfig`. Lý do: test chạy được với canvas giả, và
  `HTMLCanvasElement` hay `OffscreenCanvas` vẫn khớp kiểu.

- [ ] **Step 1: Test `layout`** (`layout.spec.ts`):
  - `layout('x', {})` có `margin` 4, `foreground` `#000000`, `background` `#ffffff`, không có `logo`, `modules` bằng
    `toMatrix('x').modules`;
  - có logo thì ECC là H và `cleared` đúng bằng ô của `logoBox`;
  - mọi tuỳ chọn sai ném `INVALID_VALUE` với **cùng thông báo** như `toSvg`. Chạy cùng một bảng đầu vào sai cho cả `toSvg`
    lẫn `layout`, rút từ `svg.spec.ts`.
- [ ] **Step 2:** Chạy `pnpm -C ts/packages/render test layout`. Kết quả mong đợi: FAIL (chưa có module).
- [ ] **Step 3:** Viết `layout` bằng cách chuyển phần kiểm tra và tính toán ra khỏi `toSvg`, giữ **đúng thứ tự kiểm**:
  margin → màu → tuỳ chọn logo → ECC đối với logo → mã hoá → `checkLogoBox`. `toSvg` kiểm `size` ngay sau màu như hiện nay
  rồi gọi `layout`.
- [ ] **Step 4:** Chạy `pnpm -C ts/packages/render test`. Mọi test cũ (`svg.spec.ts`, `logo.spec.ts`…) phải PASS mà **không
  sửa**.
- [ ] **Step 5: Test `drawQr`** (`canvas.spec.ts`). Canvas giả ghi lại mọi lệnh gọi và `fillStyle` lúc gọi.
  - `drawQr(c, 'x', { scale: 3 })`:
    - `c.width` và `c.height` = `(size + 8) * 3`;
    - có `fillRect` nền trắng phủ cả ảnh;
    - tập ô đen (suy ra từ các `fillRect` màu `#000000`, chia cho `scale`) đúng bằng ô `true` của `toMatrix('x')` cộng
      viền 4.
  - `background: 'transparent'` thì gọi `clearRect` thay vì vẽ nền.
  - `scale` 0, 65, 2.5, `NaN` thì ném `INVALID_VALUE`.
  - `getContext` trả `null` thì ném `NO_CANVAS`.
  - Logo không đổi gì trong Task này: test có logo nằm ở Task 3.
- [ ] **Step 6:** Chạy `pnpm -C ts/packages/render test canvas`. Kết quả mong đợi: FAIL.
- [ ] **Step 7:** Viết `drawQr`:
  - gọi `layout`;
  - đặt cỡ canvas;
  - vẽ nền;
  - vẽ ô tối theo từng dải ngang như `modulePath` (một `fillRect` cho mỗi dải), bỏ ô `cleared`;
  - nếu có logo thì chỉ vẽ nền ô logo; phần ảnh ở Task 3.

  Không truy cập `document`/`Image` ở tầng module, để import ở SSR không lỗi.
- [ ] **Step 8:** Chạy `pnpm -C ts/packages/render test` và `pnpm -C ts typecheck`. Kết quả mong đợi: PASS.
- [ ] **Step 9:** Commit `refactor(render): shared layout for svg and canvas; feat(render): drawQr`.

### Task 3: Logo trên canvas, xuất PNG, đóng gói subpath `canvas`

**Files:**
- Modify: `ts/packages/render/src/canvas.ts`
- Modify: `ts/packages/render/tsup.config.ts`, `ts/packages/render/package.json` (`exports["./canvas"]`, devDependency
  `esbuild` `0.27.7` như `bank-logos`)
- Modify: `ts/scripts/check-render-package.mjs`
- Test: `ts/packages/render/test/canvas.spec.ts`, `ts/packages/render/test/package.spec.ts` (mới)

**Interfaces:**
- Produces:
  ```ts
  export function toPngBlob(text: string, options?: CanvasOptions): Promise<Blob>
  export function toPngDataUrl(text: string, options?: CanvasOptions): Promise<string>
  ```
  Cả hai tự tạo canvas bằng `globalThis.document.createElement('canvas')`, gọi `drawQr`, rồi `toBlob` / `toDataURL` dạng
  `image/png`. Import từ `@tingqr/render/canvas` (chỉ ESM).

- [ ] **Step 1: Test logo và xuất ảnh.** Dùng `globalThis.document`/`Image` giả trong test, gỡ lại sau test.
  - Có logo thì `drawImage` được gọi đúng một lần:
    - ô vẽ = `logoBox` nhân `scale` cộng viền;
    - ảnh không vuông thì giữ tỉ lệ và căn giữa, như `preserveAspectRatio="xMidYMid meet"` của SVG.
  - `href` dạng http(s) thì `crossOrigin = 'anonymous'`; data URI thì không đặt `crossOrigin`.
  - Ảnh logo `decode()` bị reject thì ném `LOGO_LOAD_FAILED`, và **không** vẽ ô tối nào. Logo phải nạp xong trước khi vẽ.
  - Test `maps SecurityError from toBlob to CANVAS_TAINTED`: `toBlob`/`toDataURL` ném `DOMException` tên `SecurityError`
    thì `toPngBlob`/`toPngDataUrl` ném `TingQrError` mã `CANVAS_TAINTED`.
  - Không có `globalThis.document` thì ném `NO_CANVAS`. Không có `Image` khi cần logo cũng ném `NO_CANVAS`.
  - `toBlob` gọi callback với `null` thì ném `NO_CANVAS`.
- [ ] **Step 2:** Chạy `pnpm -C ts/packages/render test canvas`. Kết quả mong đợi: FAIL ở các test mới.
- [ ] **Step 3:** Viết phần logo, `toPngBlob`, `toPngDataUrl`.
- [ ] **Step 4:** Chạy lại. Kết quả mong đợi: PASS.
- [ ] **Step 5: Đóng gói.**
  - `tsup.config.ts`:
    - `entry: { index: 'src/index.ts', canvas: 'src/canvas.ts' }`, `format: ['esm', 'cjs']`;
    - `onSuccess` xoá `dist/canvas.cjs` và `dist/canvas.d.cts`. Lý do: bản CJS không tách chunk được, sẽ chép thêm cả bộ
      mã hoá và vỡ ngân sách; canvas chỉ chạy ở trình duyệt, nơi dùng ESM.
  - `package.json` `exports["./canvas"]` = `{ "import": { "types": "./dist/canvas.d.ts", "default": "./dist/canvas.js" } }`.
  - `index.ts` **không** export gì từ `canvas.ts`.
- [ ] **Step 6: Test gói** (`package.spec.ts`, chạy trên `dist` đã build, theo kiểu `bank-logos/test/package.spec.ts`):
  - bundle `import { toSvg } from '@tingqr/render'` bằng esbuild: kết quả không chứa `getContext`;
  - bundle `import { toPngBlob } from '@tingqr/render/canvas'`: chứa `getContext`, và chỉ có **một** bản `encodeSegments`;
  - `dist/canvas.cjs` không tồn tại.
- [ ] **Step 7:** Sửa `check-render-package.mjs`:
  - `MAX_TARBALL_BYTES = 33_000`, comment ghi "owner approved 2026-11-21 for render/canvas";
  - kiểm thông báo giấy phép Nayuki trong **mọi** file `dist/*.js`/`*.cjs` có chứa `encodeSegments`, thay danh sách cố
    định `index.js`/`index.cjs`. Bản ESM giờ có chunk chung.
- [ ] **Step 8:** Chạy `pnpm -C ts build && node ts/scripts/check-render-package.mjs && pnpm -C ts test`. Kết quả mong đợi:
  `ok`, in ra cỡ tarball (ghi con số vào commit message), test PASS.
- [ ] **Step 9:** Chạy `pnpm -C ts/packages/render mutate`. Kết quả mong đợi: ≥ 90%. Đột biến sống trong `canvas.ts`/
  `layout.ts` thì viết test giết nó, không hạ ngưỡng.
- [ ] **Step 10:** Commit `feat(render): render/canvas subpath — logo, toPngBlob, toPngDataUrl (ESM only)`.

### Task 4: `@tingqr/hono`

**Files:**
- Create: `ts/packages/hono/{package.json,tsconfig.json,tsconfig.test.json,tsup.config.ts,vitest.config.ts,LICENSE,README.md}`
  (chép khuôn của `render`; `LICENSE` là bản sao của repo)
- Create: `ts/packages/hono/src/index.ts`
- Test: `ts/packages/hono/test/hono.spec.ts`

**Interfaces:**
- Consumes: `toSvg`, `SvgOptions` (`@tingqr/render`); `TingQrError` (`@tingqr/core`).
- Produces:
  ```ts
  export interface TingQrSvgOptions extends SvgOptions { /** default 'private, max-age=300' */ cacheControl?: string }
  export function tingqrSvg(c: Context, payload: string, options?: TingQrSvgOptions): Response
  export interface TingQrRouteOptions extends TingQrSvgOptions {
    resolve: (c: Context) => string | null | undefined | Promise<string | null | undefined>
  }
  export function tingqr(options: TingQrRouteOptions): Handler
  ```
  `dependencies`: `@tingqr/core`, `@tingqr/render` (`workspace:*`); `peerDependencies`: `hono` `^4.0.0`; devDependency
  `hono` theo bản 4 mới nhất.

- [ ] **Step 1: Viết test** bằng `new Hono()` và `app.request()`:
  - `tingqrSvg` với chuỗi VietQR hợp lệ (lấy một payload có nguồn từ `conformance/vectors/`, không bịa):
    - status 200, thân bằng đúng `toSvg(payload)`;
    - header `Content-Type: image/svg+xml; charset=utf-8`;
    - `X-Content-Type-Options: nosniff`;
    - `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`;
    - `Cache-Control: private, max-age=300`;
  - `cacheControl: 'no-store'` thì header đổi theo;
  - `tingqrSvg` với tuỳ chọn sai thì ném `TingQrError`, không trả `Response`;
  - route `tingqr({ resolve })`:
    - `resolve` trả chuỗi → 200 SVG;
    - trả `null`, `undefined`, `''` → 404;
    - `resolve` async → chạy đúng;
    - tuỳ chọn sai → 400, JSON `{ "error": { "code": "INVALID_VALUE", "message": "…" } }`, `Content-Type` JSON, không có
      SVG;
    - test `passes non-TingQrError from resolve to onError`: `resolve` ném `new Error('db')` → `app.onError` nhận đúng lỗi
      đó, status do `onError` quyết;
  - route không đọc query string: `GET /qr?acc=1&bank=x` với `resolve` trả `null` vẫn 404.
- [ ] **Step 2:** Chạy `pnpm -C ts/packages/hono test`. Kết quả mong đợi: FAIL.
- [ ] **Step 3:** Viết `src/index.ts`. Dùng `c.body(svg, 200, headers)` để chạy được trên mọi runtime của Hono.
- [ ] **Step 4:** Chạy `pnpm -C ts install && pnpm -C ts test && pnpm -C ts typecheck`. Kết quả mong đợi: PASS. Sửa script
  `typecheck` ở `ts/package.json` nếu thứ tự build cần `hono` đứng sau `render`.
- [ ] **Step 5:** README tiếng Anh ngắn, gồm:
  - ví dụ Workers: `app.get('/orders/:id/qr.svg', tingqr({ resolve }))`;
  - mục "Why there is no open `?acc=&bank=` endpoint";
  - ghi rằng ảnh SVG trong `<img>` có thể không nhấn giữ lưu được trong app chat, nên phía trình duyệt nên dùng
    `@tingqr/render/canvas`.
- [ ] **Step 6:** Commit `feat(hono): @tingqr/hono — tingqrSvg helper and resolve-only route`.

### Task 5: `@tingqr/angular` — khung gói, pipe, component chế độ `svg`, SSR

**Files:**
- Create: `ts/packages/angular/{package.json,ng-package.json,tsconfig.lib.json,tsconfig.spec.json,vitest.config.ts,LICENSE,README.md}`
- Create: `ts/packages/angular/src/public-api.ts`, `src/tingqr-code.component.ts`, `src/tingqr-svg.pipe.ts`
- Test: `ts/packages/angular/test/pipe.spec.ts`, `test/component.spec.ts`, `test/ssr.spec.ts`

**Interfaces:**
- Consumes: `toSvg`, `SvgOptions` (`@tingqr/render`); `TingQrError` (`@tingqr/core`).
- Produces:
  ```ts
  @Component({ selector: 'tingqr-code', changeDetection: OnPush, host: { role: 'img', '[attr.aria-label]': 'label()' } })
  export class TingQrCode {
    readonly payload = input.required<string>()
    readonly options = input<CanvasOptions>({})            // CanvasOptions from @tingqr/render/canvas (Task 2)
    readonly mode = input<'auto' | 'svg' | 'img'>('auto')
    readonly label = input<string | undefined>(undefined)
    readonly error = output<TingQrError>()
    readonly png = output<Blob>()                          // Task 6
  }
  @Pipe({ name: 'tingqrSvg' }) export class TingQrSvgPipe { transform(payload: string | null | undefined, options?: SvgOptions): SafeHtml }
  ```
  `package.json`:
  - `peerDependencies`: `@angular/core` và `@angular/common` `>=20.0.0`;
  - `dependencies`: `@tingqr/core`, `@tingqr/render` (`workspace:*`);
  - devDependencies: Angular `~20` (bản 20.x mới nhất), `ng-packagr` `~20`, `@angular/platform-server`,
    `@analogjs/vite-plugin-angular`, `jsdom`.

  Script `build` = `ng-packagr -p ng-package.json`.

- [ ] **Step 1: Thử khung trước.** Tạo gói với component rỗng và một test `TestBed` tối thiểu, rồi chạy:
  - `pnpm -C ts/packages/angular build`: build xong, `dist/` theo Angular Package Format;
  - `pnpm -C ts/packages/angular test`: PASS.

  Nếu `@analogjs/vite-plugin-angular` không chạy được với Angular 20 thì dùng builder `@angular/build:unit-test` (Vitest)
  của Angular 20. Ghi lựa chọn vào `ts/CLAUDE.md` ở Task 7.
- [ ] **Step 2: Test pipe:**
  - chuỗi hợp lệ cho ra đúng chuỗi `toSvg(payload, options)` (đọc qua `DomSanitizer` / `ɵ` không cần; gắn vào template
    rồi so `innerHTML` của phần tử);
  - `''`, `null`, `undefined` cho ra rỗng;
  - chuỗi hay tuỳ chọn sai cho ra rỗng và **không ném**. Ở dev mode có `console.error` mang `TingQrError`.
- [ ] **Step 3: Test component, chế độ `svg`** (zoneless: `provideZonelessChangeDetection()`):
  - có `<svg>` đúng của `toSvg(payload, options)`;
  - host có `role="img"`, `aria-label` theo `label`;
  - đổi `payload` thì SVG đổi;
  - chuỗi sai thì không có `<svg>`, `error` phát đúng một lần với `TingQrError`;
  - `''` thì không có `<svg>`, `error` không phát.
- [ ] **Step 4: Test SSR** (`ssr.spec.ts`, dùng `renderApplication` của `@angular/platform-server` với app chứa
  `<tingqr-code>`):
  - `mode` `'auto'` và `'svg'`: HTML trả về có `<svg` của QR;
  - `mode` `'img'`: không có `<svg`, có phần tử giữ chỗ;
  - test `renders nothing for an invalid payload`: `renderApplication` resolve bình thường, không có `<svg`.
- [ ] **Step 5:** Chạy `pnpm -C ts/packages/angular test`. Kết quả mong đợi: FAIL ở các test mới.
- [ ] **Step 6: Viết pipe và component** (chế độ `img` để phần tử giữ chỗ trống, Task 6 làm tiếp):
  - SVG gắn bằng `[innerHTML]` qua `bypassSecurityTrustHtml`; bỏ `scale` khỏi `options` trước khi gọi `toSvg`;
  - comment ghi lý do an toàn: SVG do `toSvg` tạo, mọi thuộc tính đã escape, `href` của logo đã qua `checkLogoHref`;
  - không truy cập `window`/`document` ở constructor hay khi đang ở máy chủ.
- [ ] **Step 7:** Chạy `pnpm -C ts/packages/angular build && pnpm -C ts/packages/angular test && pnpm -C ts test`. Kết quả
  mong đợi: PASS.
- [ ] **Step 8:** Commit `feat(angular): @tingqr/angular — tingqr-code (svg) and tingqrSvg pipe, SSR-safe`.

### Task 6: Component chế độ `img` và `auto`, sự kiện `png`

**Files:**
- Modify: `ts/packages/angular/src/tingqr-code.component.ts`
- Test: `ts/packages/angular/test/component-img.spec.ts`

**Interfaces:**
- Consumes: `drawQr`, `CanvasOptions` (`@tingqr/render/canvas`, Task 2–3).
- Produces: hành vi của `mode`:
  - `'img'`: `<img>` với `src` là data URL PNG;
  - `'auto'`: SVG cho tới khi PNG ở trình duyệt vẽ xong, rồi `<img>`.

  `png` phát `Blob` của đúng ảnh đang hiện.

- [ ] **Step 1: Viết test** (jsdom + canvas giả của Task 2 cài vào `document.createElement('canvas')`):
  - `'img'`:
    - trước khi vẽ xong thì không có `<img>` và không có `<svg>`;
    - sau khi vẽ xong thì có `<img src="data:image/png…">` với `alt` bằng `label`, và `png` phát một lần;
  - `'auto'`: lúc đầu có `<svg>`; vẽ xong thì chỉ còn `<img>`;
  - đổi `payload` thì ngay sau `fixture.detectChanges()` (trước khi vẽ xong) **không** còn `<img>` của chuỗi cũ. Ở `'auto'`
    thì là SVG của chuỗi mới;
  - test `discards a stale PNG when payload changes mid-draw`:
    - canvas giả giữ lại lần `toBlob` đầu;
    - đổi `payload`, cho lần thứ hai xong trước, rồi mới cho lần đầu xong;
    - ảnh hiện và `png` chỉ ứng với chuỗi mới;
  - vẽ lỗi (`LOGO_LOAD_FAILED`, `CANVAS_TAINTED`) thì:
    - `error` phát lỗi đó;
    - ở `'img'` không hiện gì;
    - ở `'auto'` thì **giữ SVG** (SVG vẫn đúng, chỉ không lưu được).
- [ ] **Step 2:** Chạy test. Kết quả mong đợi: FAIL.
- [ ] **Step 3: Viết phần còn lại:**
  - chỉ bắt đầu vẽ ở trình duyệt (`afterNextRender` hoặc `isPlatformBrowser`);
  - mỗi lần đổi `payload`/`options` thì tăng số thứ tự; kết quả về mang số cũ thì bỏ;
  - vẽ một canvas rồi lấy cả `toDataURL` (gắn vào `src`) và `toBlob` (phát `png`), để không phải vẽ hai lần.
- [ ] **Step 4:** Chạy `pnpm -C ts/packages/angular test`. Kết quả mong đợi: PASS.
- [ ] **Step 5:** Commit `feat(angular): img and auto modes with PNG for long-press save; drop stale renders`.

### Task 7: CI, kiểm gói, tài liệu

**Files:**
- Create: `ts/scripts/check-hono-package.mjs`, `ts/scripts/check-angular-package.mjs`
- Modify: `ts/package.json` (`check:hono`, `check:angular`), `.github/workflows/ci-ts.yml`
- Modify: `ts/packages/render/README.md` (mục `render/canvas`), `ts/packages/angular/README.md`, `ts/packages/hono/README.md`
- Create: `docs/huong-dan/hien-qr-angular-hono.md`
- Modify: `ts/CLAUDE.md`, `CLAUDE.md` (mục Trạng thái: Plan 6)

- [ ] **Step 1: Kiểm gói** theo khuôn `check-render-package.mjs`:
  - `hono`:
    - `dependencies` đúng `@tingqr/core` + `@tingqr/render`;
    - `peerDependencies` đúng `{ hono: '^4.0.0' }`;
    - có `LICENSE` giống của repo;
    - `require('@tingqr/hono')` có `tingqr` và `tingqrSvg`;
    - `dist` không có chuỗi `node:`.
  - `angular`:
    - `dist` có `package.json` với `peerDependencies` Angular `>=20.0.0`;
    - có `fesm2022/*.mjs`;
    - có `LICENSE`.
  - Ngân sách tarball của mỗi gói = cỡ đo được lúc này, làm tròn lên 1 000 byte rồi cộng 25%. Ghi con số và ngày vào
    comment.
- [ ] **Step 2:** Thêm hai bước vào `ci-ts.yml`, ngay sau bước kiểm `bank-logos`. Đẩy lên một nhánh rồi xem CI chạy trên
  cả 6 tổ hợp (Ubuntu/Windows × Node 20/22/24). Nếu Angular build lỗi trên Node 20, ghi lại phiên bản 20.x mà runner dùng.
- [ ] **Step 3: Tài liệu:**
  - README mỗi gói (tiếng Anh): cách dùng, ví dụ Angular SSR và Hono trên Workers;
  - ghi rõ:
    - `render/canvas` chỉ chạy ở trình duyệt và chỉ có bản ESM;
    - logo khác nguồn cần CORS hoặc data URI (`@tingqr/bank-logos`);
    - vì sao không có route mở.
  - Hướng dẫn tiếng Việt `docs/huong-dan/hien-qr-angular-hono.md` theo kiểu `ngan-hang-va-mo-app.md`;
  - **không** ghi đã lưu được trong Zalo/Messenger.
- [ ] **Step 4:** `ts/CLAUDE.md`, thêm một mục cho mỗi gói:
  - lệnh build và test;
  - cách test Angular đã chọn ở Task 5;
  - subpath canvas chỉ có ESM, và vì sao;
  - ngân sách.

  `CLAUDE.md`: thêm Plan 6 vào mục Trạng thái.
- [ ] **Step 5:** Chạy `pnpm test:all && pnpm typecheck:all && pnpm build:all` và cả bốn `check:*` từ gốc repo. Kết quả
  mong đợi: tất cả PASS, `ok`.
- [ ] **Step 6:** Commit `ci+docs: package checks for hono and angular; docs for render/canvas, angular, hono`.

### Task 8: Thử trong Noel tree (nhánh `try/tingqr`)

**Files (repo `../noel-tree`, nhánh `try/tingqr`, không push):**
- Modify: `package.json` (cài từ `.tgz`)
- Modify: `src/app/tree/pay-panel.ts`, `src/api/orders.ts`, `src/api/baubles.ts`, route Hono mới trong `src/api/`
- Create (repo tingqr): `docs/huong-di/2026-11-2x-thu-tingqr-trong-noel-tree.md` (ghi kết quả)

**Interfaces:**
- Consumes: `encodeVietQr` (`@tingqr/core`), `findBank` (`@tingqr/core/banks`), `drawQr` (`@tingqr/render/canvas`),
  `TingQrCode` (`@tingqr/angular`), `tingqr` (`@tingqr/hono`).

- [ ] **Step 1:** Đọc `../noel-tree/CLAUDE.md`. Ghi số đo **trước**:
  - test của Noel tree xanh hay không;
  - cỡ chunk phía trình duyệt có `qrcode-generator` (từ `ng build`).
- [ ] **Step 2:** Trong `ts/`, `pnpm -r build`, rồi `pnpm pack` bốn gói (`core`, `render`, `hono`, `angular`; với Angular
  là `dist/`) vào một thư mục trong scratchpad. Ở Noel tree:
  - `git switch -c try/tingqr`;
  - cài cả bốn file `.tgz` bằng npm. Nếu npm đi tìm `@tingqr/core@0.0.0` trên registry, dùng `overrides` trong
    `package.json` trỏ về file `.tgz`.
- [ ] **Step 3: Đổi phía trình duyệt:**
  - `pay-panel.ts` tạo chuỗi bằng `encodeVietQr` và `findBank` (thay `vietQrText` và `binOf`);
  - vẽ bằng `drawQr` lên canvas của nó (giữ phần vẽ số tiền và mã đơn), thay `loadQr` và `qrcode-generator`.

  Nếu dùng được `<tingqr-code mode="img">` cho ảnh hiện trên trang thì dùng, rồi ghi lại component có thiếu gì so với
  nhu cầu thật.
- [ ] **Step 4: Đổi phía máy chủ:**
  - thêm route, ví dụ `GET /api/orders/:code/qr.svg`, dùng `tingqr({ resolve })`. `resolve` đọc đơn từ D1, trả `null`
    khi đơn không còn chờ, và tìm BIN bằng `findBank`;
  - `qrUrl` ở `orders.ts` và `baubles.ts` trỏ về route đó, thay `vietqr.app`.
- [ ] **Step 5:** Chạy test của Noel tree, `ng build` (SSR), rồi `wrangler dev`. Kiểm bằng trình duyệt (Playwright):
  - trang thanh toán SSR có QR;
  - ở trình duyệt, QR đổi sang `<img>` PNG;
  - route SVG trả 200 với đơn còn chờ, 404 với đơn đã hết;
  - giải mã ảnh PNG đã lưu bằng `decodeVietQr` (đọc ma trận từ ảnh nếu có công cụ, nếu không thì so chuỗi trước khi vẽ)
    ra đúng tài khoản, số tiền và mã đơn của đơn thử.
- [ ] **Step 6:** Ghi file kết quả `docs/huong-di/…`:
  - số đo trước và sau (cỡ chunk);
  - test đạt hay không;
  - lỗi phải sửa ngược về tingqr (mỗi lỗi một dòng, kèm commit sửa);
  - mục **"Chưa thử, cần chủ dự án"**:
    - nhấn giữ lưu PNG trong Zalo và Messenger;
    - app ngân hàng quét ảnh đã lưu;
    - ảnh SVG dự phòng trong app chat.

  Thêm các dòng đó vào `conformance/scans.md` với trạng thái chưa thử, theo khuôn hiện có.
- [ ] **Step 7:** Commit ở Noel tree trên `try/tingqr` (không push). Commit file kết quả ở tingqr:
  `docs(plan-6): Noel tree trial results`.

### Task 9: Review trước khi gộp

- [ ] **Step 1:** Chạy agent `evidence-review` trên toàn nhánh, nhất là README, hướng dẫn, `scans.md` và file kết quả
  Task 8.
- [ ] **Step 2:** Chạy agent `parity-review`, vì `conformance/errors.json` đổi: bản .NET (Plan 8) phải khai báo ba mã mới.
  Ghi việc này vào plan .NET nếu agent đề nghị.
- [ ] **Step 3:** Code review cả nhánh (superpowers:requesting-code-review), sửa những điểm được nhận, rồi chạy lại
  Task 7 Step 5.
- [ ] **Step 4:** superpowers:finishing-a-development-branch.
