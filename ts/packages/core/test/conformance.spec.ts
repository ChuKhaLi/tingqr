// Shared conformance runner: every file in conformance/vectors/ becomes one test here.
// The .NET runner (Plan 8) applies exactly the same rules. To support a new scheme, add a row to SCHEMES.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import {
  TingQrError,
  decodeKhqr,
  detect,
  decodePromptPayQr,
  encodeKhqr,
  encodePromptPayQr,
  decodeVietQr,
  decodeVnpayQr,
  encodeVietQr,
  isKhqrExpired,
  removeVietnameseAccents,
  type ParseMode,
  type Result,
} from '../src/index.js'
import { appsForBank, bankAppLink, findBank } from '../src/banks.js'

interface SchemeRunner {
  encode?: (input: any) => unknown
  decode: (payload: string, options?: { mode?: ParseMode }) => Result<unknown>
  /** `expiry` vectors: the result of a check on the decoded (lenient) payload. */
  expiry?: (data: any, input: any) => unknown
}

const noDecode = (scheme: string) => () => {
  throw new Error(`${scheme} vectors have no payload to decode`)
}

const SCHEMES: Record<string, SchemeRunner> = {
  vietqr: { encode: encodeVietQr, decode: decodeVietQr },
  vnpay: { decode: decodeVnpayQr },
  promptpay: { encode: encodePromptPayQr, decode: decodePromptPayQr },
  khqr: { encode: encodeKhqr, decode: decodeKhqr },
  // detect vectors pin only the scheme and the secondary matches; each scheme's data has its own vectors.
  detect: {
    decode: (payload) => {
      const r = detect(payload)
      return r.ok ? { ...r, value: { scheme: r.value.scheme, alsoMatches: r.value.alsoMatches } } : r
    },
  },
  // Not a QR scheme: `link` vectors build a link from input, `encode-invalid` ones expect bankAppLink to throw.
  'bank-app-link': {
    encode: (i) => bankAppLink(i.appId, i.platform, i.fallbackUrl === undefined ? undefined : { fallbackUrl: i.fallbackUrl }),
    decode: () => {
      throw new Error('bank-app-link vectors have no payload to decode')
    },
  },
  // `lookup` vectors: findBank(query) → its bin or null; appsForBank(bin) → app ids in order.
  'bank-lookup': {
    encode: (i) => findBank(i.query)?.bin ?? null,
    decode: () => {
      throw new Error('bank-lookup vectors have no payload to decode')
    },
  },
  'bank-apps-for-bank': {
    encode: (i) => appsForBank(i.bin).map((a) => a.id),
    decode: () => {
      throw new Error('bank-apps-for-bank vectors have no payload to decode')
    },
  },
  // `expiry` vectors: decodeKhqr(payload) (lenient), then isKhqrExpired(data, nowMs); undefined is written null.
  'khqr-expiry': { decode: decodeKhqr, expiry: (data, i) => isKhqrExpired(data, i.nowMs) ?? null },
  // `text` vectors: removeVietnameseAccents(text).
  'vietnamese-text': { encode: (i) => removeVietnameseAccents(i.text), decode: noDecode('vietnamese-text') },
}

interface Vector {
  id: string
  scheme: string
  kind: 'valid' | 'invalid' | 'lenient' | 'encode-invalid' | 'link' | 'lookup' | 'expiry' | 'text'
  payload: string
  input?: unknown
  roundTrip?: boolean
  expected?: unknown
  warnings?: string[]
  warningTags?: (string | null)[]
  error?: string
  errorTag?: string
  errorFields?: { tag: string; value: string }[]
}

const VECTORS = join(CONFORMANCE_DIR, 'vectors')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : name.endsWith('.json') ? [p] : []
  })
}

// Matrix vectors (scheme "render") run in @tingqr/render's own runner: render depends on core, so core cannot import it.
const allVectors: Vector[] = files(VECTORS).map((f) => JSON.parse(readFileSync(f, 'utf8')))
const vectors: Vector[] = allVectors.filter((v) => v.scheme !== 'render')

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

/** The tag of each warning (null when it has none), in order; a vector without warnings expects none. */
function warningTags(r: Result<unknown>): (string | null)[] {
  return r.ok ? r.warnings.map((w) => w.tag ?? null) : []
}

test('render vectors live only in vectors/render/ (run by @tingqr/render); this runner sees all others', () => {
  const renderDir = join(VECTORS, 'render')
  const renderFiles = files(renderDir).length
  expect(allVectors.length).toBe(files(VECTORS).length)
  expect(allVectors.filter((v) => v.scheme === 'render').length).toBe(renderFiles)
  expect(vectors.length).toBe(files(VECTORS).length - renderFiles)
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
      expect(warningTags(r)).toEqual(v.warningTags ?? [])
    })
    test('decodes to the same expected in lenient mode, with the same warnings', () => {
      const r = runner(v).decode(v.payload, { mode: 'lenient' })
      expect(errorCode(r)).toBeUndefined()
      if (!r.ok) return
      expect(r.value).toStrictEqual(v.expected)
      expect(r.warnings.map((w) => w.code)).toEqual(v.warnings ?? [])
      expect(warningTags(r)).toEqual(v.warningTags ?? [])
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
    if (v.errorFields !== undefined) {
      test.each(['strict', 'lenient'] as const)('error carries the expected top-level fields in %s mode', (mode) => {
        const r = runner(v).decode(v.payload, { mode })
        expect(r.ok ? undefined : r.error.fields).toStrictEqual(v.errorFields)
      })
    }
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
      expect(warningTags(r)).toEqual(v.warningTags ?? [])
    })
  }
  if (v.kind === 'link') {
    test('builds exactly the expected link from input', () => {
      expect(runner(v).encode!(v.input)).toBe((v.expected as { link: string }).link)
    })
  }
  if (v.kind === 'expiry') {
    test('decodes the payload (lenient) and checks expiry at input.nowMs', () => {
      const r = runner(v).decode(v.payload)
      expect(errorCode(r)).toBeUndefined()
      if (!r.ok) return
      expect(runner(v).expiry!(r.value, v.input)).toBe((v.expected as { result: unknown }).result)
    })
  }
  if (v.kind === 'text') {
    test('transforms input.text into exactly expected.result', () => {
      expect(runner(v).encode!(v.input)).toBe((v.expected as { result: string }).result)
    })
  }
  if (v.kind === 'lookup') {
    test('looks up exactly the expected result', () => {
      expect(runner(v).encode!(v.input)).toEqual((v.expected as { result: unknown }).result)
    })
  }
})
