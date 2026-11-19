"""CRC-16/CCITT-FALSE over UTF-8 bytes, written independently of tingqr.

Used to recompute the CRC of hand-built or edited vectors (notes saying "CRC computed with an independent Python
CRC-16/CCITT-FALSE"). Standard library only.

    python conformance/tools/crc16.py "<payload without CRC, ending in 6304>"   -> prints the 4 hex digits
    python conformance/tools/crc16.py --check "<full payload>"                 -> prints ok or the expected CRC
"""
import sys


def crc16(s: str) -> str:
    crc = 0xFFFF
    for b in s.encode('utf-8'):
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return format(crc, '04X')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) == 3 and sys.argv[1] == '--check':
        p = sys.argv[2]
        want = crc16(p[:-4])
        print('ok' if p[-4:].upper() == want else f'mismatch: expected {want}')
    elif len(sys.argv) == 2:
        print(crc16(sys.argv[1]))
    else:
        sys.exit(__doc__)
