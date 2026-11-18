import { crc16 } from '../src/index.js'

// vietnam-qr-pay README sample (MIT, https://github.com/xuannghia/vietnam-qr-pay)
const SAMPLE_BODY = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304'

test('crc16 matches the CRC-16/CCITT-FALSE check value', () => {
  expect(crc16('123456789')).toBe('29B1')
})

test('crc16 matches the CRC of a published VietQR sample', () => {
  expect(crc16(SAMPLE_BODY)).toBe('AE9F')
})

test('crc16 of empty input is the initial value', () => {
  expect(crc16('')).toBe('FFFF')
})

test('crc16 always returns 4 uppercase hex digits, zero-padded', () => {
  let n = 1
  while (!crc16('A'.repeat(n)).startsWith('0') && n < 100_000) n++
  const value = crc16('A'.repeat(n))
  expect(value).toMatch(/^0[0-9A-F]{3}$/)
})

test('crc16 runs over UTF-8 bytes, not UTF-16 code units', () => {
  // 'Đ' = U+0110 → UTF-8 bytes C4 90. Reference values computed with an independent Python
  // implementation: CRC over bytes [C4 90] = 4426; over the low byte of the code unit [10] = F3C1.
  expect(crc16('Đ')).toBe('4426')
  expect(crc16('Đ')).not.toBe('F3C1')
})

test('crc16 encodes 3- and 4-byte UTF-8 characters', () => {
  // Khmer KA (U+1780, 3 bytes) and an emoji (U+1F600, 4 bytes); values from an independent Python run.
  expect(crc16('ក')).toBe('F1F1')
  expect(crc16('😀')).toBe('4F4F')
})
