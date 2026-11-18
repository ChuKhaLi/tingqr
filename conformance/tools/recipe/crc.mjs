// CRC-16/CCITT-FALSE over UTF-8 bytes. Written independently of tingqr so recipes do not depend on the code under test.
export function crc16(input) {
  let crc = 0xffff
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
