import { readFileSync } from 'node:fs'
import { ERROR_CODES, TingQrError, WARNING_CODES } from '../src/index.js'

const codes = JSON.parse(
  readFileSync(new URL('../../../../conformance/errors.json', import.meta.url), 'utf8'),
) as { errors: { code: string }[]; warnings: { code: string }[] }

test('ERROR_CODES and WARNING_CODES equal conformance/errors.json', () => {
  expect([...ERROR_CODES].sort()).toEqual(codes.errors.map((e) => e.code).sort())
  expect([...WARNING_CODES].sort()).toEqual(codes.warnings.map((w) => w.code).sort())
  expect(ERROR_CODES.length).toBeGreaterThan(0)
})

test('TingQrError carries code and tag', () => {
  const e = new TingQrError('NON_ASCII', 'msg', '62')
  expect(e).toBeInstanceOf(Error)
  expect(e.name).toBe('TingQrError')
  expect(e.code).toBe('NON_ASCII')
  expect(e.tag).toBe('62')
  expect(e.message).toBe('msg')
})
