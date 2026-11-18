import { TingQrError, encodeFields, field, parseTlv } from '../src/index.js'

const SAMPLE = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'

function thrownCode(fn: () => unknown): { code: string; tag?: string } | undefined {
  try {
    fn()
  } catch (e) {
    if (e instanceof TingQrError) return { code: e.code, tag: e.tag }
    throw e
  }
  return undefined
}

test('field writes tag, two-digit length and value', () => {
  expect(field('00', '01')).toBe('000201')
})

test('field accepts exactly 99 characters', () => {
  expect(field('62', 'x'.repeat(99))).toHaveLength(103)
})

test('field rejects 100 characters with FIELD_TOO_LONG on that tag', () => {
  expect(thrownCode(() => field('62', 'x'.repeat(100)))).toEqual({ code: 'FIELD_TOO_LONG', tag: '62' })
})

test('field counts characters, not bytes', () => {
  expect(field('59', 'Đà')).toBe('5902Đà')
})

test('parseTlv splits top-level fields', () => {
  expect(parseTlv('000201010211')).toEqual([
    { tag: '00', value: '01' },
    { tag: '01', value: '11' },
  ])
})

test('parseTlv rejects a non-numeric length', () => {
  expect(thrownCode(() => parseTlv('00AB01'))?.code).toBe('BAD_LENGTH')
})

test('parseTlv rejects a length past the end', () => {
  expect(thrownCode(() => parseTlv('000501'))?.code).toBe('TRUNCATED')
})

test('parseTlv counts characters for non-ASCII values', () => {
  expect(parseTlv('5902Đà0002AB')).toEqual([
    { tag: '59', value: 'Đà' },
    { tag: '00', value: 'AB' },
  ])
})

test('encodeFields(parseTlv(s)) round-trips a published VietQR sample', () => {
  const fields = parseTlv(SAMPLE)
  expect(fields.map((f) => f.tag)).toEqual(['00', '01', '38', '53', '58', '63'])
  expect(encodeFields(fields)).toBe(SAMPLE)
})

test('parseTlv rejects a tag that is not two digits with BAD_TAG', () => {
  expect(thrownCode(() => parseTlv('AB02xx'))?.code).toBe('BAD_TAG')
  expect(thrownCode(() => parseTlv('😀😀02xx'))?.code).toBe('BAD_TAG')
})

test('parseTlv reports TRUNCATED for a cut-off field header', () => {
  expect(thrownCode(() => parseTlv('00'))?.code).toBe('TRUNCATED')
  expect(thrownCode(() => parseTlv('000'))?.code).toBe('TRUNCATED')
  expect(thrownCode(() => parseTlv('0002AB01'))?.code).toBe('TRUNCATED')
})

test('parseTlv accepts an empty field that ends exactly at the end of input', () => {
  expect(parseTlv('0000')).toEqual([{ tag: '00', value: '' }])
})
