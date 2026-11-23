// Runner for the SVG vectors of conformance/vectors/render/ (conformance/README.md "Mẫu SVG"). They are golden output of
// toSvg itself, so this proves the files are current and the errors are the expected ones, not that the SVG is right;
// the matrix under them is pinned by the Nayuki vectors (matrix-conformance.spec.ts).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { TingQrError } from '@tingqr/core'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { toSvg, type SvgOptions } from '../src/index.js'

interface Vector {
  id: string
  kind: 'matrix' | 'encode-invalid' | 'svg'
  render?: 'svg'
  input: { text: string } & SvgOptions
  expected?: { svg: string }
  error?: string
}

const DIR = join(CONFORMANCE_DIR, 'vectors', 'render')
const vectors: Vector[] = readdirSync(DIR)
  .filter((n) => n.endsWith('.json'))
  .map((n) => JSON.parse(readFileSync(join(DIR, n), 'utf8')) as Vector)
  .filter((v) => v.kind === 'svg' || v.render === 'svg')

test('the runner sees every SVG vector: at least 25 that render and at least 20 that throw', () => {
  expect(vectors.filter((v) => v.kind === 'svg').length).toBeGreaterThanOrEqual(25)
  expect(vectors.filter((v) => v.kind === 'encode-invalid').length).toBeGreaterThanOrEqual(20)
})

describe.each(vectors.map((v) => [v.id, v] as const))('%s', (_id, v) => {
  const { text, ...options } = v.input
  if (v.kind === 'svg') {
    test('renders exactly the expected SVG', () => {
      expect(toSvg(text, options)).toBe(v.expected!.svg)
    })
  } else {
    test('throws the expected TingQrError', () => {
      let thrown: unknown
      try {
        toSvg(text, options)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(TingQrError)
      expect((thrown as TingQrError).code).toBe(v.error)
    })
  }
})
