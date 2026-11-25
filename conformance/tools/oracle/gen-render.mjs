// Generate matrix vectors (conformance/vectors/render/) by running the ORIGINAL Nayuki QR Code generator
// (TypeScript, MIT, https://github.com/nayuki/QR-Code-generator), never tingqr's port of it.
//
// The original file is vendored unmodified at vendor/nayuki-qrcodegen-v1.8.0.ts (tag v1.8.0, commit
// 720f62bddb7226106071d4728c292cb1df519ceb). Its SHA-256 is checked before every run. It uses `namespace`, which
// Node's type stripping cannot run, so it is transpiled with the TypeScript compiler and evaluated.
//
// Run: cd conformance/tools/oracle && pnpm install && node gen-render.mjs
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const HERE = dirname(fileURLToPath(import.meta.url))
const VECTORS = join(HERE, '..', '..', 'vectors')
const OUT = join(VECTORS, 'render')
const SOURCE = join(HERE, 'vendor', 'nayuki-qrcodegen-v1.8.0.ts')
const SHA256 = 'c4749095a91bf9696e3a303998b9905e467094f53041e64393e65e6d887737fd'

const src = readFileSync(SOURCE)
const hash = createHash('sha256').update(src).digest('hex')
if (hash !== SHA256) {
  console.error(`vendor/nayuki-qrcodegen-v1.8.0.ts has SHA-256 ${hash}, expected ${SHA256}; refusing to run.`)
  process.exit(1)
}
const js = ts.transpileModule(src.toString('utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const qrcodegen = new Function(js + '\nreturn qrcodegen;')()
const { QrCode, QrSegment } = qrcodegen
const ECC = { L: QrCode.Ecc.LOW, M: QrCode.Ecc.MEDIUM, Q: QrCode.Ecc.QUARTILE, H: QrCode.Ecc.HIGH }
const ECC_NAME = ['L', 'M', 'Q', 'H']

const payloadOf = (scheme, id) => JSON.parse(readFileSync(join(VECTORS, scheme, `${id}.json`), 'utf8')).payload

const CASES = [
  { id: 'render-vietqr-alnum', from: ['vietqr', 'vietqr-readme-sample'], options: {} },
  { id: 'render-vietqr-purpose-h', from: ['vietqr', 'vietqr-dynamic-amount-purpose'], options: { ecc: 'H' } },
  { id: 'render-vnpay', from: ['vnpay', 'vnpay-readme-cellphones'], options: { ecc: 'Q' } },
  { id: 'render-promptpay-thai', from: ['promptpay', 'promptpay-promptparse-thai-name'], options: { ecc: 'L' } },
  { id: 'render-khqr-khmer', from: ['khqr', 'khqr-sdk-individual-usd'], options: {} },
  { id: 'render-numeric', text: '0123456789', options: {} },
  { id: 'render-no-boost', text: 'HELLO', options: { ecc: 'L', boostEcc: false } },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((mask) => ({ id: `render-mask-${mask}`, text: 'TINGQR', options: { mask } })),
  { id: 'render-min-version-10', text: 'A', options: { minVersion: 10 } },
  { id: 'render-v1-full-m', text: 'tingqr-render!', options: { ecc: 'M', boostEcc: false } },
  { id: 'render-v2-overflow-m', text: 'tingqr-render!!', options: { ecc: 'M', boostEcc: false } },
  { id: 'render-emoji', text: 'ting 😀 qr', options: {} },
  // Large versions, pinned with minVersion = maxVersion. Each text is long enough that the version is also the smallest
  // that fits it at that ECC level (checked with this oracle), so the data region is mostly real data, not padding.
  // Versions 27+ use the widest character-count fields; 32 is the one version whose alignment-pattern step (26) is not given by the general formula; 40 is the largest.
  { id: 'render-version-27-byte', text: repeatTo('tingqr ', 1100), options: { ecc: 'M', minVersion: 27, maxVersion: 27 } },
  { id: 'render-version-32-alnum', text: repeatTo('TINGQR ', 1560), options: { ecc: 'Q', minVersion: 32, maxVersion: 32 } },
  // 2953 bytes is the byte-mode capacity of version 40 at ECC L: every data codeword is used.
  { id: 'render-version-40-byte-full', text: repeatTo('tingqr ', 2953), options: { ecc: 'L', minVersion: 40, maxVersion: 40 } },
  // Numeric mode from version 10 up has a 12-bit character count (10 bits below).
  { id: 'render-numeric-version-10', text: repeatTo('0123456789', 500), options: { ecc: 'M', minVersion: 10, maxVersion: 10 } },
  // 7089 digits is the numeric-mode capacity of version 40 at ECC L, the longest text any QR code holds; one more digit
  // is render-invalid-too-long-7090-digits below.
  { id: 'render-numeric-version-40-full', text: repeatTo('0123456789', 7089), options: { ecc: 'L' } },
]

/** `unit` repeated and cut to exactly `length` characters. */
function repeatTo(unit, length) {
  return unit.repeat(Math.ceil(length / unit.length)).slice(0, length)
}

/** Option validation cases: written by hand from the design (section 5.2), not produced by the oracle. */
const INVALID = [
  ['render-invalid-ecc', { text: 'A', ecc: 'X' }, 'ecc must be L, M, Q or H'],
  ['render-invalid-min-version-0', { text: 'A', minVersion: 0 }, 'versions are 1–40'],
  ['render-invalid-max-version-41', { text: 'A', maxVersion: 41 }, 'versions are 1–40'],
  ['render-invalid-min-above-max', { text: 'A', minVersion: 5, maxVersion: 4 }, 'minVersion must not exceed maxVersion'],
  ['render-invalid-mask-8', { text: 'A', mask: 8 }, 'mask is an integer 0–7'],
  ['render-invalid-mask-fraction', { text: 'A', mask: 1.5 }, 'mask is an integer 0–7'],
  [
    'render-invalid-too-long',
    { text: 'a'.repeat(1274), maxVersion: 40, ecc: 'H', boostEcc: false },
    'one byte over version 40 at ECC H (1273 bytes in byte mode); the same text fits at ECC L',
  ],
  [
    'render-invalid-too-long-7090-digits',
    { text: repeatTo('0123456789', 7090), ecc: 'L' },
    'one digit over the numeric-mode capacity of version 40 at ECC L (7089, render-numeric-version-40-full); the original encoder throws "Data too long"',
  ],
  [
    'render-invalid-lone-surrogate',
    { text: 'ting \uD83D qr' },
    'unpaired high surrogate (an emoji cut in half by slice()); the original encoder would throw a URIError',
  ],
]

const NAYUKI = 'nayuki/QR-Code-generator v1.8.0 (MIT), commit 720f62b, original file run by conformance/tools/oracle/gen-render.mjs'

mkdirSync(OUT, { recursive: true })
for (const c of CASES) {
  const text = c.text ?? payloadOf(...c.from)
  const o = c.options
  const qr = QrCode.encodeSegments(
    QrSegment.makeSegments(text),
    ECC[o.ecc ?? 'M'],
    o.minVersion ?? 1,
    o.maxVersion ?? 40,
    o.mask ?? -1,
    o.boostEcc ?? true,
  )
  const rows = []
  for (let y = 0; y < qr.size; y++) {
    let row = ''
    for (let x = 0; x < qr.size; x++) row += qr.getModule(x, y) ? '1' : '0'
    rows.push(row)
  }
  const vector = {
    id: c.id,
    scheme: 'render',
    kind: 'matrix',
    input: { text, ...o },
    expected: { size: qr.size, version: qr.version, ecc: ECC_NAME[qr.errorCorrectionLevel.ordinal], mask: qr.mask, rows },
    source: NAYUKI,
  }
  if (c.from) vector.note = `text is the payload of conformance/vectors/${c.from[0]}/${c.from[1]}.json`
  writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(vector, null, 2) + '\n')
  console.log(`${c.id}: version ${qr.version}, ecc ${vector.expected.ecc}, mask ${qr.mask}`)
}
for (const [id, input, note] of INVALID) {
  const vector = {
    id,
    scheme: 'render',
    kind: 'encode-invalid',
    input,
    error: 'INVALID_VALUE',
    source: 'docs/superpowers/specs/2026-11-19-tingqr-render-design.md section 5.2 (hand-written option check, not oracle output)',
    note,
  }
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(vector, null, 2) + '\n')
  console.log(id)
}
