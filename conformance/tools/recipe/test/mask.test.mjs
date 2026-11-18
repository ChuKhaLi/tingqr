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
  assert.ok(payload.includes('0810XXXXXXXXXX'), '62.08 masked')
  assert.ok(payload.includes('540821090000'), '54 kept')
  assert.ok(payload.includes('0010A000000775'), '26.00 kept')
  assert.ok(!payload.includes('0105313144'), '26.01 masked')
  assert.deepEqual(masked, ['26.01', '59', '62.03', '62.05', '62.07', '62.08'])
  assert.ok(crcOk(payload))
})

test('masking is deterministic', () => {
  assert.equal(maskPayload(VNPAY).payload, maskPayload(VNPAY).payload)
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
