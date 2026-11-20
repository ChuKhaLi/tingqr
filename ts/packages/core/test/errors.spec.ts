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

test('instanceof TingQrError holds across separate copies of the class (CJS subpath bundles)', async () => {
  vi.resetModules()
  const other = (await import('../src/errors.js')).TingQrError
  expect(other).not.toBe(TingQrError)
  expect(new other('INVALID_VALUE', 'x')).toBeInstanceOf(TingQrError)
  expect(new TingQrError('INVALID_VALUE', 'x')).toBeInstanceOf(other)
})

test('instanceof TingQrError is false for a plain Error or a look-alike', () => {
  expect(new Error('x') instanceof TingQrError).toBe(false)
  expect({ name: 'TingQrError', code: 'INVALID_VALUE' } instanceof TingQrError).toBe(false)
  expect((null as unknown as object) instanceof TingQrError).toBe(false)
})

test('a subclass of TingQrError keeps ordinary instanceof', () => {
  class Sub extends TingQrError {}
  expect(new Sub('INVALID_VALUE', 'x')).toBeInstanceOf(TingQrError)
  expect(new Sub('INVALID_VALUE', 'x')).toBeInstanceOf(Sub)
  expect(new TingQrError('INVALID_VALUE', 'x') instanceof Sub).toBe(false)
})

test('the brand that makes cross-copy instanceof work is not an own enumerable key', () => {
  const e = new TingQrError('INVALID_VALUE', 'x')
  expect(Object.keys(e).sort()).toEqual(['code', 'name'])
  expect(Object.getOwnPropertySymbols(e).every((s) => !Object.getOwnPropertyDescriptor(e, s)!.enumerable)).toBe(true)
})
