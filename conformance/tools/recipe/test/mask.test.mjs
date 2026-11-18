// Uses only public README samples from vietnam-qr-pay (MIT) — never real captures.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc16 } from '../crc.mjs'
import { maskPayload } from '../mask.mjs'

const MOMO_NEW = '00020101021138620010A000000727013200069710250118PSP1234567890000000208QRIBFTTA53037045802VN62190515MOMOW2W123456786304821F'
const ZALOPAY = '00020101021138620010A00000072701320006970454011899ZP24009M072482670208QRIBFTTA53037045802VN6304073C'
const VNPAY =
  '00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685'

function crcOk(p) {
  return crc16(p.slice(0, -4)) === p.slice(-4)
}

test('MoMo: account digits and reference digits change, prefixes and length stay', () => {
  const { payload, masked } = maskPayload(MOMO_NEW)
  assert.equal(payload.length, MOMO_NEW.length)
  assert.deepEqual(masked, ['38.01.01', '62.05'])
  assert.ok(payload.includes('00069710250118PSP'), 'BIN and PSP prefix kept')
  assert.ok(!payload.includes('PSP123456789000000'), 'account digits changed')
  assert.match(payload, /0515MOMOW2W\d{8}6304/)
  assert.ok(!payload.includes('MOMOW2W12345678'), 'reference digits changed')
  assert.ok(crcOk(payload), 'CRC recomputed')
})

test('ZaloPay: 99ZP and M kept, digits changed, BIN kept', () => {
  const { payload, masked } = maskPayload(ZALOPAY)
  assert.deepEqual(masked, ['38.01.01'])
  assert.match(payload, /0006970454011899ZP\d{5}M\d{8}0208/)
  assert.ok(!payload.includes('99ZP24009M07248267'))
  assert.ok(crcOk(payload))
})

test('VNPAY: names masked to X, amount and GUID kept, ids masked', () => {
  const { payload, masked } = maskPayload(VNPAY)
  assert.equal(payload.length, VNPAY.length)
  assert.ok(payload.includes('5910XXXXXXXXXX'), '59 masked')
  assert.ok(payload.includes('0810XxxxxxxxxX'), '62.08 masked (letter case kept)')
  assert.ok(payload.includes('540821090000'), '54 kept')
  assert.ok(payload.includes('0010A000000775'), '26.00 kept')
  assert.ok(!payload.includes('0105313144'), '26.01 masked')
  assert.deepEqual(masked, ['26.01', '59', '62.03', '62.05', '62.07', '62.08'])
  assert.ok(crcOk(payload))
})

test('masking is deterministic for a given seed', () => {
  assert.equal(maskPayload(VNPAY, { seed: 's' }).payload, maskPayload(VNPAY, { seed: 's' }).payload)
})

test('an unknown top-level tag is masked with the "all" rule', () => {
  const body = MOMO_NEW.slice(0, -8) + '8105AB12-'
  const input = body + '6304' + crc16(body + '6304')
  const { payload, masked } = maskPayload(input)
  assert.ok(masked.includes('81'))
  assert.match(payload, /8105XX\d\d-6304/)
  assert.ok(crcOk(payload))
})

test('a template tag whose value is not TLV is masked whole with the "all" rule', () => {
  const body = ZALOPAY.slice(0, -8).replace('5802VN', '5802VN2604AB12') + '6304'
  const { payload, masked } = maskPayload(body + crc16(body))
  assert.ok(masked.includes('26'))
  assert.match(payload, /2604XX\d\d/)
  assert.ok(crcOk(payload))
})

test('letters in an alphanumeric account outside a known prefix or wallet shape are masked', () => {
  const body = MOMO_NEW.slice(0, -8).replace('0118PSP123456789000000', '0112NGUYENVANA88') + '6304'
  // keep the outer 38 length consistent: rebuild through the masker's own parse/write via a full payload
  const fixed = body.replace('38620010', '38560010').replace('01320006', '01260006')
  const { payload } = maskPayload(fixed + crc16(fixed), { seed: 'test' })
  assert.match(payload, /0112XXXXXXXXXX\d\d/)
  assert.ok(!payload.includes('NGUYEN'))
})

test('a template sub-tag 00 that is not an AID or reverse-domain id is masked', () => {
  const body = ZALOPAY.slice(0, -8).replace('5802VN', '5802VN26160006ABC1230102XY') + '6304'
  const { payload, masked } = maskPayload(body + crc16(body), { seed: 'test' })
  assert.ok(masked.includes('26.00'))
  assert.ok(!payload.includes('ABC123'))
  assert.match(payload, /26160006XXX\d{3}0102XX/)
})

test('an AID or reverse-domain id in sub-tag 00 is kept', () => {
  const body = ZALOPAY.slice(0, -8).replace('5802VN', '5802VN26190015vn.zalopay.test') + '6304'
  const { payload } = maskPayload(body + crc16(body), { seed: 'test' })
  assert.ok(payload.includes('0015vn.zalopay.test'))
})

test('equal digit suffixes stay equal across fields (MoMo old: 62.05 suffix = account suffix)', () => {
  const MOMO_OLD = '00020101021138620010A00000072701320006970454011899MM24011M348750800208QRIBFTTA53037045802VN62190515MOMOW2W3487508080030466304EBC8'
  const { payload } = maskPayload(MOMO_OLD, { seed: 'test' })
  const account = /011899MM\d{5}M(\d{8})0208/.exec(payload)[1]
  const ref = /0515MOMOW2W(\d{8})/.exec(payload)[1]
  assert.equal(ref, account)
  assert.notEqual(account, '34875080')
})

test('different seeds give different fake digits; the same seed is deterministic', () => {
  const a = maskPayload(MOMO_NEW, { seed: 'one' }).payload
  assert.equal(maskPayload(MOMO_NEW, { seed: 'one' }).payload, a)
  assert.notEqual(maskPayload(MOMO_NEW, { seed: 'two' }).payload, a)
})

test('fake digits are a keyed permutation per position, not a shift (no linear relation leaks)', async () => {
  const { digitMapper } = await import('../mask.mjs')
  const map = digitMapper('test')
  for (let pos = 0; pos < 20; pos++) {
    const images = Array.from({ length: 10 }, (_, d) => map(d, pos))
    assert.deepEqual([...images].sort(), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], `bijective at ${pos}`)
  }
  // A shift (d + k) mod 10 keeps every difference; a random permutation does not, for some position.
  const keepsDifferences = (pos) =>
    Array.from({ length: 10 }, (_, d) => (Number(map((d + 1) % 10, pos)) - Number(map(d, pos)) + 10) % 10).every(
      (x, _, all) => x === all[0],
    )
  assert.ok(Array.from({ length: 20 }, (_, pos) => keepsDifferences(pos)).some((v) => !v))
})

test('the "all" rule also masks spaces and combining marks, so word lengths of names do not survive', () => {
  const body = ZALOPAY.slice(0, -8).replace('5802VN', '5802VN5910NGUYEN VAN') + '6304'
  const { payload } = maskPayload(body + crc16(body), { seed: 'test' })
  assert.ok(payload.includes('5910XXXXXXXXXX'))
  const nfd = 'Nguyễn'
  const body2 = ZALOPAY.slice(0, -8).replace('5802VN', '5802VN59' + String([...nfd].length).padStart(2, '0') + nfd) + '6304'
  const { payload: p2 } = maskPayload(body2 + crc16(body2), { seed: 'test' })
  assert.ok(!/\p{M}/u.test(p2))
})

test('tag 64 (merchant information in another language) is a template: inner lengths kept, language kept', () => {
  const t64 = '0002vi' + '0105Xa Ba' // 00 = language, 01 = name
  const body = ZALOPAY.slice(0, -8).replace('5802VN', '5802VN64' + String(t64.length).padStart(2, '0') + t64) + '6304'
  const { payload, masked } = maskPayload(body + crc16(body), { seed: 'test' })
  assert.ok(payload.includes('64150002vi0105XxXXx'))
  assert.ok(masked.includes('64.01'))
})
