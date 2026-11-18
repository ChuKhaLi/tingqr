// Turn real QR captures in conformance/private/ into masked recipe vectors under conformance/vectors/.
//
//   node conformance/tools/recipe/extract.mjs [--private <dir>] [--out <dir>]
//
// Files are named <label>__<description>.(txt|png|jpg|jpeg); <label> is bank | momo | zalopay | vnpay | other and is
// the photographer's evidence of which app the QR came from. A .txt file holds one payload.
//
// Privacy: this script prints only file names, vector ids and generic reasons. It never prints a payload — raw or
// masked — or any field value, so real captures cannot leak into terminals, logs or an assistant's context.
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { maskPayload } from './mask.mjs'
import { oracleExpected } from './oracle-map.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const LABELS = new Set(['bank', 'momo', 'zalopay', 'vnpay', 'other'])
const WALLETS = new Set(['momo', 'zalopay'])
const NAME = /^([a-z]+)__([A-Za-z0-9._-]+)\.(txt|png|jpe?g)$/i

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}

function decodeImage(file) {
  const buf = readFileSync(file)
  const img = /\.png$/i.test(file) ? PNG.sync.read(buf) : jpeg.decode(buf, { useTArray: true })
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data
}

function readPayload(file) {
  if (extname(file).toLowerCase() === '.txt') return readFileSync(file, 'utf8').trim()
  return decodeImage(file)
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const privateDir = arg('--private', join(HERE, '..', '..', 'private'))
const outDir = arg('--out', join(HERE, '..', '..', 'vectors'))

for (const name of readdirSync(privateDir).sort()) {
  const file = join(privateDir, name)
  if (!statSync(file).isFile()) continue
  const m = NAME.exec(name)
  if (!m || !LABELS.has(m[1].toLowerCase())) {
    console.log(`skip ${name}: name must be <bank|momo|zalopay|vnpay|other>__<description>.<txt|png|jpg>`)
    continue
  }
  const label = m[1].toLowerCase()
  let payload
  try {
    payload = readPayload(file)
  } catch {
    payload = undefined
  }
  if (!payload) {
    console.log(`skip ${name}: no QR found`)
    continue
  }
  let masked, oracle
  try {
    masked = maskPayload(payload)
    oracle = oracleExpected(masked.payload)
  } catch {
    console.log(`skip ${name}: not a VietQR or VNPAY payload the oracle accepts`)
    continue
  }
  const { scheme, expected, missing } = oracle
  if (scheme === 'vietqr' && WALLETS.has(label)) expected.provider = label
  const id = `${scheme}-real-${label}-${slug(m[2])}`
  const date = statSync(file).mtime.toISOString().slice(0, 10)
  const vector = {
    id,
    scheme,
    kind: missing.length ? 'lenient' : 'valid',
    payload: masked.payload,
    expected,
    ...(missing.length ? { error: 'MISSING_TAG', warnings: missing.map(() => 'MISSING_OPTIONAL_TAG') } : {}),
    source: `rút từ QR thật của ${label}, chụp ngày ${date}; giá trị nhạy cảm đã thay (masked: ${masked.masked.join(', ')}), CRC tính lại`,
    derived: true,
    note: `Nhãn ví do người chụp ghi: ${label}. Tag thiếu so với chuẩn: ${missing.length ? missing.join(', ') : 'không'}. expected lấy từ vietnam-qr-pay@1.5.1 trên chuỗi đã che.`,
  }
  mkdirSync(join(outDir, scheme), { recursive: true })
  writeFileSync(join(outDir, scheme, `${id}.json`), JSON.stringify(vector, null, 2) + '\n')
  console.log(`wrote ${id}`)
}
