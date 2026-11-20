import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import Ajv2020 from 'ajv/dist/2020.js'

const ROOT = CONFORMANCE_DIR
const schema = JSON.parse(readFileSync(join(ROOT, 'vectors.schema.json'), 'utf8'))
const codes = JSON.parse(readFileSync(join(ROOT, 'errors.json'), 'utf8')) as {
  errors: { code: string }[]
  warnings: { code: string }[]
}
const errorCodes = new Set(codes.errors.map((e) => e.code))
const warningCodes = new Set(codes.warnings.map((w) => w.code))

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false })
const validate = ajv.compile(schema)

function vectorFiles(dir: string): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out = out.concat(vectorFiles(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

const VECTORS = join(ROOT, 'vectors')
const files = (() => {
  try {
    return vectorFiles(VECTORS)
  } catch {
    return []
  }
})()

const base = {
  id: 'x',
  scheme: 'vietqr',
  kind: 'valid',
  payload: '000201',
  expected: {},
  source: 'test fixture inside conformance-format.spec.ts',
}

test('schema accepts a well-formed valid vector', () => {
  expect(validate(base)).toBe(true)
})

test('schema rejects a vector without source', () => {
  const { source: _s, ...noSource } = base
  expect(validate(noSource)).toBe(false)
})

test('schema rejects an invalid vector without error', () => {
  expect(validate({ ...base, kind: 'invalid', expected: undefined })).toBe(false)
  const { expected: _e, ...invalid } = base
  expect(validate({ ...invalid, kind: 'invalid' })).toBe(false)
  expect(validate({ ...invalid, kind: 'invalid', error: 'CRC_MISMATCH' })).toBe(true)
})

test('every vector file matches vectors.schema.json and the shared codes', () => {
  for (const file of files) {
    const v = JSON.parse(readFileSync(file, 'utf8'))
    const ok = validate(v)
    expect(ok, `${file}: ${ajv.errorsText(validate.errors)}`).toBe(true)
    expect(v.id, file).toBe(basename(file, '.json'))
    if (v.error !== undefined) expect(errorCodes.has(v.error), `${file}: unknown error ${v.error}`).toBe(true)
    for (const w of v.warnings ?? []) expect(warningCodes.has(w), `${file}: unknown warning ${w}`).toBe(true)
    if (v.payload !== undefined) expect(v.payload.includes('\r'), `${file}: payload contains CR`).toBe(false)
  }
})

test('schema rejects an encode-invalid vector that carries a payload', () => {
  const v = { id: 'x', scheme: 'vietqr', kind: 'encode-invalid', input: {}, error: 'NON_ASCII', source: 'test fixture inside conformance-format.spec.ts' }
  expect(validate(v)).toBe(true)
  expect(validate({ ...v, payload: '000201' })).toBe(false)
})

test('vector set is not empty', () => {
  expect(files.length).toBeGreaterThanOrEqual(1)
})

const matrix = {
  id: 'x',
  scheme: 'render',
  kind: 'matrix',
  input: { text: 'A' },
  expected: { size: 21, version: 1, ecc: 'M', mask: 0, rows: [] },
  source: 'test fixture inside conformance-format.spec.ts',
}

test('schema accepts a matrix vector with input and expected and no payload', () => {
  expect(validate(matrix), ajv.errorsText(validate.errors)).toBe(true)
})

test('schema rejects a matrix vector without input or expected, or with a payload or error', () => {
  const { input: _i, ...noInput } = matrix
  const { expected: _e, ...noExpected } = matrix
  expect(validate(noInput)).toBe(false)
  expect(validate(noExpected)).toBe(false)
  expect(validate({ ...matrix, payload: '000201' })).toBe(false)
  expect(validate({ ...matrix, error: 'INVALID_VALUE' })).toBe(false)
})

test('schema requires the shape of a matrix vector expected', () => {
  const good = { ...matrix, expected: { size: 21, version: 1, ecc: 'M', mask: 0, rows: ['0101'] } }
  expect(validate(good), ajv.errorsText(validate.errors)).toBe(true)
  for (const bad of [
    { size: 21, version: 1, ecc: 'M', mask: 0 },
    { size: 21, version: 1, ecc: 'X', mask: 0, rows: [] },
    { size: 21, version: 0, ecc: 'M', mask: 0, rows: [] },
    { size: 21, version: 1, ecc: 'M', mask: 8, rows: [] },
    { size: 21, version: 1, ecc: 'M', mask: 0, rows: ['012'] },
    { size: 21, version: 1, ecc: 'M', mask: 0, rows: [], extra: 1 },
  ]) {
    expect(validate({ ...matrix, expected: bad }), JSON.stringify(bad)).toBe(false)
  }
})
