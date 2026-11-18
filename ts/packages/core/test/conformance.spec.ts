// Shared conformance runner: every file in conformance/vectors/ becomes one test here.
// The .NET runner (Plan 8) applies exactly the same rules. To support a new scheme, add a row to SCHEMES.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { TingQrError, decodeVietQr, decodeVnpayQr, encodeVietQr, type ParseMode, type Result } from '../src/index.js'

interface SchemeRunner {
  encode?: (input: any) => string
  decode: (payload: string, options?: { mode?: ParseMode }) => Result<unknown>
}

const SCHEMES: Record<string, SchemeRunner> = {
  vietqr: { encode: encodeVietQr, decode: decodeVietQr },
  vnpay: { decode: decodeVnpayQr },
}

interface Vector {
  id: string
  scheme: string
  kind: 'valid' | 'invalid' | 'lenient' | 'encode-invalid'
  payload: string
  input?: unknown
  roundTrip?: boolean
  expected?: unknown
  warnings?: string[]
  error?: string
  errorTag?: string
}

const VECTORS = join(CONFORMANCE_DIR, 'vectors')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : name.endsWith('.json') ? [p] : []
  })
}

const vectors: Vector[] = files(VECTORS).map((f) => JSON.parse(readFileSync(f, 'utf8')))

function runner(v: Vector): SchemeRunner {
  const r = SCHEMES[v.scheme]
  if (!r) throw new Error(`No runner for scheme "${v.scheme}" (vector ${v.id}); add it to SCHEMES.`)
  return r
}

function errorCode(r: Result<unknown>): string | undefined {
  return r.ok ? undefined : r.error.code
}

/** Error code plus, when the vector pins one, the tag the error refers to. */
function errorOf(r: Result<unknown>, v: Vector): [string | undefined, string | undefined] {
  return [errorCode(r), v.errorTag === undefined || r.ok ? undefined : r.error.tag]
}

test('the runner sees every vector file, and there are at least 8', () => {
  expect(vectors.length).toBe(files(VECTORS).length)
  expect(vectors.length).toBeGreaterThanOrEqual(8)
})

describe.each(vectors.map((v) => [v.id, v] as const))('%s', (_id, v) => {
  if (v.kind === 'valid') {
    test('decodes to expected in strict mode', () => {
      const r = runner(v).decode(v.payload, { mode: 'strict' })
      expect(errorCode(r)).toBeUndefined()
      if (!r.ok) return
      expect(r.value).toStrictEqual(v.expected)
      expect(r.warnings.map((w) => w.code)).toEqual(v.warnings ?? [])
    })
    test('decodes to the same expected in lenient mode, with the same warnings', () => {
      const r = runner(v).decode(v.payload, { mode: 'lenient' })
      expect(errorCode(r)).toBeUndefined()
      if (!r.ok) return
      expect(r.value).toStrictEqual(v.expected)
      expect(r.warnings.map((w) => w.code)).toEqual(v.warnings ?? [])
    })
    if (v.input !== undefined && v.roundTrip !== false) {
      test('encodes input to payload byte for byte', () => {
        const encode = runner(v).encode
        expect(encode, `scheme ${v.scheme} has no encoder`).toBeDefined()
        expect(encode!(v.input)).toBe(v.payload)
      })
    }
  }
  if (v.kind === 'invalid') {
    test.each(['strict', 'lenient'] as const)('fails with the expected error in %s mode', (mode) => {
      expect(errorOf(runner(v).decode(v.payload, { mode }), v)).toEqual([v.error, v.errorTag])
    })
  }
  if (v.kind === 'encode-invalid') {
    test('encode throws the expected TingQrError code and tag', () => {
      const encode = runner(v).encode
      expect(encode, `scheme ${v.scheme} has no encoder`).toBeDefined()
      let thrown: unknown
      try {
        encode!(v.input)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(TingQrError)
      expect((thrown as TingQrError).code).toBe(v.error)
      if (v.errorTag !== undefined) expect((thrown as TingQrError).tag).toBe(v.errorTag)
    })
  }
  if (v.kind === 'lenient') {
    test('fails in strict mode with the expected error', () => {
      expect(errorOf(runner(v).decode(v.payload, { mode: 'strict' }), v)).toEqual([v.error, v.errorTag])
    })
    test('decodes to expected in lenient mode with the expected warnings', () => {
      const r = runner(v).decode(v.payload, { mode: 'lenient' })
      expect(errorCode(r)).toBeUndefined()
      if (!r.ok) return
      expect(r.value).toStrictEqual(v.expected)
      expect(r.warnings.map((w) => w.code)).toEqual(v.warnings)
    })
  }
})
