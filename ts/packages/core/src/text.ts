/**
 * Remove Vietnamese tone and vowel marks from Latin letters, and map đ/Đ to d/D. Marks on other scripts
 * (Thai, Korean, …) are left alone, and the result is NFC-normalised.
 */
export function removeVietnameseAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/([A-Za-z])\p{M}+/gu, '$1')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC')
}
