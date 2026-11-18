/** Remove Vietnamese tone and vowel marks, and map đ/Đ to d/D. Other characters are left as they are. */
export function removeVietnameseAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}
