// Runs extract.mjs on a temporary "private" folder holding README samples only (never real captures).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const EXTRACT = fileURLToPath(new URL('../extract.mjs', import.meta.url))
const MOMO_NEW = '00020101021138620010A000000727013200069710250118PSP1234567890000000208QRIBFTTA53037045802VN62190515MOMOW2W123456786304821F'
const VNPAY =
  '00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685'

function run() {
  const priv = mkdtempSync(join(tmpdir(), 'tq-priv-'))
  const out = mkdtempSync(join(tmpdir(), 'tq-out-'))
  writeFileSync(join(priv, 'momo__readme.txt'), MOMO_NEW + '\n')
  writeFileSync(join(priv, 'vnpay__readme.txt'), VNPAY)
  writeFileSync(join(priv, 'bank__garbage.txt'), 'not a qr')
  writeFileSync(join(priv, 'nolabel.txt'), MOMO_NEW)
  const stdout = execFileSync(process.execPath, [EXTRACT, '--private', priv, '--out', out], { encoding: 'utf8' })
  return { stdout, out }
}

test('writes one recipe per decodable, correctly named capture', () => {
  const { out } = run()
  const files = readdirSync(out, { recursive: true }).filter((f) => String(f).endsWith('.json')).map(String).sort()
  assert.deepEqual(files.map((f) => f.replace(/\\/g, '/')), ['vietqr/vietqr-real-momo-readme.json', 'vnpay/vnpay-real-vnpay-readme.json'])
})

test('a MoMo recipe is a derived, masked valid vector labelled with its wallet', () => {
  const { out } = run()
  const v = JSON.parse(readFileSync(join(out, 'vietqr', 'vietqr-real-momo-readme.json'), 'utf8'))
  assert.equal(v.kind, 'valid')
  assert.equal(v.derived, true)
  assert.equal('provider' in v.expected, false, 'no decoder emits provider yet (Plan 2 Task 6)')
  assert.match(v.note, /momo/)
  assert.ok(!v.payload.includes('PSP123456789000000'))
  assert.match(v.source, /^rút từ QR thật của momo, chụp ngày \d{4}-\d{2}-\d{2}; giá trị nhạy cảm đã thay \(masked: 38\.01\.01, 62\.05\), CRC tính lại$/)
})

test('a VNPAY recipe without tags 52/60 is lenient with two warnings', () => {
  const { out } = run()
  const v = JSON.parse(readFileSync(join(out, 'vnpay', 'vnpay-real-vnpay-readme.json'), 'utf8'))
  assert.equal(v.kind, 'lenient')
  assert.equal(v.error, 'MISSING_TAG')
  assert.equal(v.errorTag, '52')
  assert.deepEqual(v.warnings, ['MISSING_OPTIONAL_TAG', 'MISSING_OPTIONAL_TAG'])
  assert.equal('provider' in v.expected, false)
})

test('stdout names files only and never contains a payload or its values', () => {
  const { stdout } = run()
  assert.match(stdout, /wrote vietqr-real-momo-readme/)
  assert.match(stdout, /skip bank__garbage\.txt/)
  assert.match(stdout, /skip nolabel\.txt/)
  for (const secret of ['PSP123456789000000', 'MOMOW2W12345678', '0105313144', 'CELLPHONES', '000201', 'MOMOW2W']) {
    assert.ok(!stdout.includes(secret), `stdout leaks ${secret}`)
  }
})
