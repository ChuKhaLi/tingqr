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
