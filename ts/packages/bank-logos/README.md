# @tingqr/bank-logos

Logo ngân hàng Việt Nam (theo BIN) và icon app ngân hàng (theo `id` app của `@tingqr/core/banks`), chạy offline, mỗi
ảnh là một module riêng.

> **Ảnh không thuộc giấy phép MIT.** Chúng là nhãn hiệu của từng ngân hàng; VietQR và NAPAS247 là của NAPAS. Chỉ dùng để
> nhận diện ngân hàng nhận tiền hay app cần mở. Nguồn và giấy phép từng file: [`LOGOS-NOTICE.md`](./LOGOS-NOTICE.md).
> Code của gói là MIT.

## Có gì

- `@tingqr/bank-logos/logo/<bin>`: logo ngang, ví dụ `logo/970418` (BIDV).
  - SVG lấy từ Wikimedia Commons, nếu có file gắn nhãn PD.
  - Còn lại là ảnh của vietqr.io, thu về cao 128 px, định dạng WebP lossless.
- `@tingqr/bank-logos/icon/<id>`: icon vuông của app, ví dụ `icon/mb`. Lấy từ vietqr.io, giữ nguyên file.
- `@tingqr/bank-logos`: chỉ có hai danh sách `LOGO_BINS` và `ICON_IDS`, không chứa ảnh nào.
- `@tingqr/bank-logos/files/...`: file ảnh gốc, cho ai muốn tự phục vụ ảnh tĩnh.

## Dùng

```ts
import mb from '@tingqr/bank-logos/icon/mb' // "data:image/webp;base64,..."
import bidv from '@tingqr/bank-logos/logo/970418'
```

**Tree-shaking:** bundle chỉ chứa ảnh bạn import. Test của gói kiểm điều này bằng esbuild:
- import một icon thì có đúng một ảnh;
- import gốc của gói thì không có ảnh nào.

Chọn ảnh theo lựa chọn của người dùng thì dùng `import()` động. Bundler hỗ trợ import động theo mẫu (Vite, webpack)
thường tách mỗi ảnh khớp mẫu thành một chunk, rồi chỉ tải chunk được dùng. tingqr chưa có test cho cách này: kiểm
bundler của bạn trước khi dựa vào nó.

```ts
import { ICON_IDS } from '@tingqr/bank-logos'

async function iconOf(id: string): Promise<string | undefined> {
  if (!ICON_IDS.includes(id)) return undefined
  return (await import(`@tingqr/bank-logos/icon/${id}`)).default
}
```

**Icon ở giữa QR** (cùng `@tingqr/render`):

```ts
import { toSvg } from '@tingqr/render'
import mb from '@tingqr/bank-logos/icon/mb'

const svg = toSvg(payload, { logo: { href: mb } })
```

> **Tạm thời.** Chưa ai quét thử QR có logo bằng app ngân hàng thật. Giới hạn kích thước logo của `@tingqr/render` cũng
> là tạm thời. Xem `conformance/scans.md` trước khi in bảng treo có logo.

**CommonJS** (`require`) trả về **đường dẫn tuyệt đối tới file ảnh**, không phải data URI. Cách này để gói không phải
chứa base64 hai lần. Cần data URI thì tự đọc file:

```js
const path = require('@tingqr/bank-logos/icon/mb')
const uri = 'data:image/webp;base64,' + require('node:fs').readFileSync(path).toString('base64')
```

Mỗi SVG đã qua bước kiểm an toàn: không có script, event handler, animation hay link ra ngoài. Logo vẫn nên được nhúng
qua `<img>` hoặc `<image>`, không chèn thẳng vào HTML.
