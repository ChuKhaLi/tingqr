// Build @tingqr/bank-logos from conformance/banks/logos/ (manifest.json + images):
//   files/<kind>/<name>          the images, as stored in conformance/
//   dist/<kind>/<key>.js         ESM: export default "data:<mime>;base64,..."   (one module per image: tree-shakeable)
//   dist/<kind>/<key>.cjs        CJS: module.exports = absolute path of files/<kind>/<name> (no second base64 copy)
//   dist/index.{js,cjs,d.ts,d.cts}  LOGO_BINS, ICON_IDS only (no image)
//   LOGOS-NOTICE.md              trademark notice and per-file sources
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The repository's conformance/ directory, found by walking up (works from a Stryker or tmp copy too). */
function conformanceDir() {
  let dir = PKG
  for (;;) {
    if (existsSync(join(dir, 'conformance', 'errors.json'))) return join(dir, 'conformance')
    const parent = dirname(dir)
    if (parent === dir) throw new Error('conformance/ not found above ' + PKG)
    dir = parent
  }
}

/** MIME from the bytes, checked against the extension: a mislabelled file stops the build. */
export function mimeOf(file, bytes) {
  const ext = file.split('.').pop()
  const sniffed =
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
      ? 'webp'
      : /<svg[\s>]/.test(bytes.toString('utf8', 0, 4096))
        ? 'svg'
        : null
  if (sniffed !== ext) throw new Error(`${file}: content is ${sniffed ?? 'unknown'}, extension says ${ext}`)
  return { svg: 'image/svg+xml', webp: 'image/webp' }[ext]
}

const LICENSES = {
  'PD-textlogo': 'Wikimedia Commons ghi PD-textlogo (theo luật Mỹ)',
  'PD-simple': 'Wikimedia Commons ghi PD-simple (theo luật Mỹ)',
  'trademark-no-license': 'không có giấy phép; nhãn hiệu của chủ sở hữu',
}

export function renderNotice(manifest, target = 'npm') {
  const codeLine =
    target === 'dotnet'
      ? 'Chỉ code (file `.dll` và tài liệu `.xml`) là MIT, xem https://github.com/ChuKhaLi/tingqr/blob/main/LICENSE.'
      : 'Chỉ code (các file `.js`, `.cjs`, `.d.ts`) là MIT, xem `LICENSE`.'
  const rows = manifest
    .map((e) => `| \`${e.file}\` | ${e.sourceUrl}${e.pageUrl ? ` ([trang Commons](${e.pageUrl}))` : ''} | ${LICENSES[e.license]} | ${e.processed ?? 'giữ nguyên'} |`)
    .join('\n')
  return `# Logo ngân hàng và icon app: ghi chú thương hiệu

**Ảnh trong gói này không thuộc giấy phép MIT.** ${codeLine}

- Mỗi logo và icon là nhãn hiệu của ngân hàng hoặc công ty sở hữu nó. VietQR và NAPAS247 là nhãn hiệu của NAPAS.
- Ảnh chỉ dùng để người dùng nhận ra ngân hàng nhận tiền hay app cần mở. Việc tingqr đóng gói ảnh không có nghĩa
  tingqr liên kết với, hay được bảo trợ bởi, bất kỳ ngân hàng nào.
- Nhãn PD-textlogo và PD-simple là đánh giá của Wikimedia Commons theo luật Mỹ; chưa rõ theo luật Việt Nam.
- Ngân hàng hay chủ nhãn hiệu muốn sửa hoặc gỡ ảnh: mở issue trên repo tingqr, ảnh sẽ được gỡ ở bản kế tiếp.

## Nguồn từng file

| File | Nguồn | Giấy phép | Xử lý |
|---|---|---|---|
${rows}
`
}

function build() {
  const logos = join(conformanceDir(), 'banks', 'logos')
  const manifest = JSON.parse(readFileSync(join(logos, 'manifest.json'), 'utf8')).files
  for (const d of ['dist', 'files']) rmSync(join(PKG, d), { recursive: true, force: true })
  const put = (rel, text) => {
    mkdirSync(dirname(join(PKG, rel)), { recursive: true })
    writeFileSync(join(PKG, rel), text)
  }
  for (const e of manifest) {
    const bytes = readFileSync(join(logos, e.file))
    const mime = mimeOf(e.file, bytes)
    mkdirSync(dirname(join(PKG, 'files', e.file)), { recursive: true })
    copyFileSync(join(logos, e.file), join(PKG, 'files', e.file))
    const base = `dist/${e.kind}/${e.key}`
    put(`${base}.js`, `export default ${JSON.stringify(`data:${mime};base64,${bytes.toString('base64')}`)}\n`)
    put(`${base}.d.ts`, `/** ${e.file} as a data URI. Trademark of its owner, not MIT: see LOGOS-NOTICE.md. */\ndeclare const uri: string\nexport default uri\n`)
    put(`${base}.cjs`, `'use strict'\nmodule.exports = require('node:path').join(__dirname, '..', '..', 'files', ${JSON.stringify(e.file)})\n`)
    put(`${base}.d.cts`, `/** Absolute path of files/${e.file} (CommonJS returns a path, not a data URI). */\ndeclare const path: string\nexport = path\n`)
  }
  const keys = (kind) => manifest.filter((e) => e.kind === kind).map((e) => e.key).sort()
  const lists = `LOGO_BINS = Object.freeze(${JSON.stringify(keys('logo'))})\n`
  const icons = `ICON_IDS = Object.freeze(${JSON.stringify(keys('icon'))})\n`
  put('dist/index.js', `export const ${lists}export const ${icons}`)
  put('dist/index.cjs', `'use strict'\nexports.${lists}exports.${icons}`)
  const types =
    '/** BINs that have a logo: import `@tingqr/bank-logos/logo/<bin>`. */\nexport declare const LOGO_BINS: readonly string[]\n' +
    '/** App ids (as in @tingqr/core/banks) that have an icon: import `@tingqr/bank-logos/icon/<id>`. */\nexport declare const ICON_IDS: readonly string[]\n'
  put('dist/index.d.ts', types)
  put('dist/index.d.cts', types)
  put('LOGOS-NOTICE.md', renderNotice(manifest))
  put('../../../dotnet/src/TingQR.BankLogos/LOGOS-NOTICE.md', renderNotice(manifest, 'dotnet'))
  console.log(`bank-logos: ${manifest.length} images`)
}

/** Exit 1 when the committed .NET notice differs from the one generated from conformance/banks/logos/ now. */
function checkNotice() {
  const manifest = JSON.parse(readFileSync(join(conformanceDir(), 'banks', 'logos', 'manifest.json'), 'utf8')).files
  const file = join(PKG, '..', '..', '..', 'dotnet', 'src', 'TingQR.BankLogos', 'LOGOS-NOTICE.md')
  const committed = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (committed !== renderNotice(manifest, 'dotnet')) {
    console.error('dotnet/src/TingQR.BankLogos/LOGOS-NOTICE.md is out of date: run `pnpm -C ts --filter @tingqr/bank-logos build`')
    process.exit(1)
  }
  console.log('bank-logos: .NET LOGOS-NOTICE.md is current')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check-notice')) checkNotice()
  else build()
}
