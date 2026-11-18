import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { ERROR_CODES, TingQrError, WARNING_CODES } from '../src/index.js'

const codes = JSON.parse(
  readFileSync(join(CONFORMANCE_DIR, 'errors.json'), 'utf8'),
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

test('TingQrError without a tag has no tag property', () => {
  expect('tag' in new TingQrError('CRC_MISMATCH', 'msg')).toBe(false)
})

test('TingQrError carries the top-level fields it was given', () => {
  const fields = [{ tag: '00', value: '01' }]
  expect(new TingQrError('UNKNOWN_SCHEME', 'm', undefined, fields).fields).toEqual(fields)
})

test('TingQrError without fields has no fields property', () => {
  expect('fields' in new TingQrError('UNKNOWN_SCHEME', 'm')).toBe(false)
  expect('fields' in new TingQrError('UNKNOWN_SCHEME', 'm', '29')).toBe(false)
})
