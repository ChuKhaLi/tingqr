// Scan sheet: an HTML page of VietQR codes to scan with real banking apps (design 2026-11-19, section 5.6).
//
//   pnpm -C ts/packages/render scan-sheet
//
// Codes come from two places:
//   - the fake-account VietQR vectors (conformance/vectors/vietqr, kind "valid" with an "input"): they only show
//     whether an app can read the code; never send money to them;
//   - the owner's own accounts in conformance/private/scan-inputs.json (gitignored), or the file named by the
//     TINGQR_SCAN_INPUTS environment variable: an array of { id, input } where input is what encodeVietQr takes.
//     Only the owner runs the script with real data. The script prints counts and the output path, never a payload
//     or an account number. Output: ts/packages/render/scan-sheet/index.html (gitignored), or TINGQR_SCAN_SHEET_OUT.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodeVietQr, encodeVietQr } from '@tingqr/core'

const HERE = dirname(fileURLToPath(import.meta.url))

/** The repository's conformance/ directory, found by walking up from this script. */
export function findConformanceDir(from = HERE) {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'conformance', 'errors.json'))) return join(dir, 'conformance')
    if (dirname(dir) === dir) throw new Error('conformance/ not found')
  }
}

function entryFor(id, input, real) {
  let payload
  try {
    payload = encodeVietQr(input)
  } catch (e) {
    // encodeVietQr's message quotes the input (account number); report only the id and the error code.
    throw new Error(`${id}: invalid VietQR input (${e && typeof e === 'object' && 'code' in e ? e.code : 'error'})`)
  }
  const decoded = decodeVietQr(payload, { mode: 'strict' })
  if (!decoded.ok) throw new Error(`${id}: tingqr cannot read back its own VietQR (${decoded.error.code})`)
  const { bankBin, accountNumber, amount, purpose } = decoded.value
  const expect = { bankBin, accountNumber }
  if (amount !== undefined) expect.amount = amount
  if (purpose !== undefined) expect.purpose = purpose
  return { id, real, payload, expect }
}

/** Fake vectors first, then the owner's real entries (if the file exists). */
export function loadEntries({ conformanceDir, scanInputsPath }) {
  const dir = join(conformanceDir, 'vectors', 'vietqr')
  const entries = readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')))
    .filter((v) => v.kind === 'valid' && v.input !== undefined)
    .map((v) => entryFor(v.id, v.input, false))
  if (existsSync(scanInputsPath)) {
    const real = JSON.parse(readFileSync(scanInputsPath, 'utf8'))
    if (!Array.isArray(real)) throw new Error('scan inputs must be a JSON array of { id, input }')
    for (const { id, input } of real) entries.push(entryFor(String(id), input, true))
  }
  return entries
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A test logo drawn by tingqr ("tq" on a circle); not a bank logo. */
export const TEST_LOGO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#0b6e4f"/>' +
      '<text x="50" y="64" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="#fff" text-anchor="middle">tq</text></svg>',
  ).toString('base64')

/** The whole HTML page. `toSvg` is passed in so tests can use the source and the script the build. */
export function renderSheet(entries, { toSvg, logoHref = TEST_LOGO }) {
  const cards = entries
    .map((e) => {
      const rows = [
        ['Ngân hàng (BIN)', e.expect.bankBin],
        ['Số tài khoản', e.expect.accountNumber],
        ['Số tiền', e.expect.amount ?? '(không có)'],
        ['Nội dung', e.expect.purpose ?? '(không có)'],
      ]
        .map(([k, v]) => `<tr><th>${k}</th><td>${escapeHtml(v)}</td></tr>`)
        .join('')
      const label = e.real
        ? '<p class="real">Tài khoản thật của bạn</p>'
        : '<p class="fake">Tài khoản giả: chỉ kiểm app đọc được mã, không chuyển tiền</p>'
      return (
        `<section class="card"><h2>${escapeHtml(e.id)}</h2>${label}<table>${rows}</table>` +
        `<div class="codes"><figure>${toSvg(e.payload, { size: '40mm' })}<figcaption>Không logo</figcaption></figure>` +
        `<figure>${toSvg(e.payload, { size: '40mm', logo: { href: logoHref } })}<figcaption>Có logo</figcaption></figure></div></section>`
      )
    })
    .join('\n')
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>tingqr: trang quét thử VietQR</title>
<style>
body { font-family: system-ui, sans-serif; margin: 16px; color: #111; background: #fff; }
.notice { border: 2px solid #b00020; padding: 8px 12px; font-weight: bold; }
.card { border: 1px solid #ccc; padding: 8px 12px; margin: 12px 0; break-inside: avoid; }
.codes { display: flex; gap: 24px; flex-wrap: wrap; }
figure { margin: 0; text-align: center; }
.fake { color: #b00020; } .real { color: #0b6e4f; }
th { text-align: left; padding-right: 12px; font-weight: normal; color: #555; }
@media print { @page { size: A4; margin: 12mm; } body { margin: 0; } .card { page-break-inside: avoid; } }
</style></head><body>
<h1>Trang quét thử VietQR</h1>
<p class="notice">Dừng ở màn hình xác nhận. Nếu chuyển thì chỉ chuyển cho chính mình, số tiền nhỏ.
Ghi kết quả vào conformance/scans.md (chỉ ghi id, không ghi số tài khoản).</p>
${cards}
</body></html>
`
}

async function main() {
  const { toSvg } = await import(pathToFileURL(join(HERE, '..', 'dist', 'index.js')).href)
  const conformanceDir = findConformanceDir()
  const scanInputsPath = process.env.TINGQR_SCAN_INPUTS ?? join(conformanceDir, 'private', 'scan-inputs.json')
  const entries = loadEntries({ conformanceDir, scanInputsPath })
  const outDir = resolve(process.env.TINGQR_SCAN_SHEET_OUT ?? join(HERE, '..', 'scan-sheet'))
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, 'index.html')
  writeFileSync(out, renderSheet(entries, { toSvg }))
  const real = entries.filter((e) => e.real).length
  console.log(`${entries.length} codes (${real} real, ${entries.length - real} fake) written to ${out}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
