/** UTF-8 bytes of a string. Written out so the core needs no DOM or Node typings. */
function* utf8Bytes(input: string): Generator<number> {
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number
    if (cp < 0x80) {
      yield cp
    } else if (cp < 0x800) {
      yield 0xc0 | (cp >> 6)
      yield 0x80 | (cp & 0x3f)
    } else if (cp < 0x10000) {
      yield 0xe0 | (cp >> 12)
      yield 0x80 | ((cp >> 6) & 0x3f)
      yield 0x80 | (cp & 0x3f)
    } else {
      yield 0xf0 | (cp >> 18)
      yield 0x80 | ((cp >> 12) & 0x3f)
      yield 0x80 | ((cp >> 6) & 0x3f)
      yield 0x80 | (cp & 0x3f)
    }
  }
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over the UTF-8 bytes of `input`, as 4 uppercase hex digits. */
export function crc16(input: string): string {
  let crc = 0xffff
  for (const byte of utf8Bytes(input)) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
