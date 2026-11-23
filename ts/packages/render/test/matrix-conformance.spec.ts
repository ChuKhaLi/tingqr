// Runner for conformance/vectors/render/: every matrix must equal what the original Nayuki encoder produced.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { TingQrError } from '@tingqr/core'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { toMatrix, type MatrixOptions } from '../src/index.js'

interface Vector {
  id: string
  kind: 'matrix' | 'encode-invalid' | 'svg'
  render?: 'svg'
  input: { text: string } & MatrixOptions
  expected?: { size: number; version: number; ecc: string; mask: number; rows: string[] }
  error?: string
}

const DIR = join(CONFORMANCE_DIR, 'vectors', 'render')
const names = readdirSync(DIR).filter((n) => n.endsWith('.json'))
const all: Vector[] = names.map((n) => JSON.parse(readFileSync(join(DIR, n), 'utf8')))
// The SVG vectors (kind "svg", and encode-invalid with "render": "svg") belong to svg-conformance.spec.ts.
const vectors = all.filter((v) => v.kind === 'matrix' || (v.kind === 'encode-invalid' && v.render === undefined))

test('the runner sees every matrix vector, and there are at least 20', () => {
  expect(all.length).toBe(names.length)
  expect(vectors.length).toBe(all.filter((v) => v.kind !== 'svg' && v.render !== 'svg').length)
  expect(vectors.length).toBeGreaterThanOrEqual(20)
})

describe.each(vectors.map((v) => [v.id, v] as const))('%s', (_id, v) => {
  const { text, ...options } = v.input
  if (v.kind === 'matrix') {
    test('matches the Nayuki matrix', () => {
      const m = toMatrix(text, options)
      const e = v.expected!
      expect([m.size, m.version, m.ecc, m.mask]).toEqual([e.size, e.version, e.ecc, e.mask])
      expect(m.modules.map((row) => row.map((d) => (d ? '1' : '0')).join(''))).toEqual(e.rows)
    })
  } else {
    test('throws the expected TingQrError', () => {
      let thrown: unknown
      try {
        toMatrix(text, options)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(TingQrError)
      expect((thrown as TingQrError).code).toBe(v.error)
    })
  }
})
