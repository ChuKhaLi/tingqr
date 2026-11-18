import { removeVietnameseAccents } from '../src/index.js'

test('removeVietnameseAccents strips tone and vowel marks', () => {
  expect(removeVietnameseAccents('Chuyển tiền Đà Nẵng')).toBe('Chuyen tien Da Nang')
})

test('removeVietnameseAccents maps đ and Đ', () => {
  expect(removeVietnameseAccents('đĐ')).toBe('dD')
})

test('removeVietnameseAccents leaves ASCII unchanged', () => {
  expect(removeVietnameseAccents('TINGQR TEST 123 -_.')).toBe('TINGQR TEST 123 -_.')
})

test('removeVietnameseAccents leaves non-Latin scripts intact', () => {
  expect(removeVietnameseAccents('ที่')).toBe('ที่')
  const korean = removeVietnameseAccents('한국')
  expect(korean).toBe('한국')
  expect(korean).toHaveLength(2)
})

test('removeVietnameseAccents handles horn letters ơ ư and returns NFC', () => {
  expect(removeVietnameseAccents('Thưởng Tết ơi')).toBe('Thuong Tet oi')
  expect(removeVietnameseAccents('Café')).toBe('Cafe')
})
