import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc16 } from '../crc.mjs'

test('crc16 matches the CRC-16/CCITT-FALSE check value', () => {
  assert.equal(crc16('123456789'), '29B1')
})

test('crc16 matches the CRC of the vietnam-qr-pay README MoMo sample', () => {
  const p = '00020101021138620010A000000727013200069710250118PSP1234567890000000208QRIBFTTA53037045802VN62190515MOMOW2W123456786304821F'
  assert.equal(crc16(p.slice(0, -4)), '821F')
})
