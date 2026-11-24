// Runner for the SVG vectors of conformance/vectors/render/ (conformance/README.md "Mẫu SVG"). They are golden output of
// toSvg itself, so this proves the files are current and the errors are the expected ones, not that the SVG is right;
// the encoder is checked against Nayuki on the matrix vectors (matrix-conformance.spec.ts), but the matrices inside these
// SVGs come from the port.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { TingQrError } from '@tingqr/core'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { checkSvgOptions, toSvg, type SvgOptions } from '../src/index.js'

interface Vector {
  id: string
  kind: 'matrix' | 'encode-invalid' | 'svg'
  render?: 'svg'
  input: { text: string } & SvgOptions
  expected?: { svg: string }
  error?: string
  textDependent?: boolean
}

const DIR = join(CONFORMANCE_DIR, 'vectors', 'render')
const vectors: Vector[] = readdirSync(DIR)
  .filter((n) => n.endsWith('.json'))
  .map((n) => JSON.parse(readFileSync(join(DIR, n), 'utf8')) as Vector)
  .filter((v) => v.kind === 'svg' || v.render === 'svg')

test('the runner sees every SVG vector: one per render-svg-* file, at least 25 that render and at least 20 that throw', () => {
  expect(vectors.length).toBe(readdirSync(DIR).filter((n) => n.startsWith('render-svg-') && n.endsWith('.json')).length)
  expect(vectors.filter((v) => v.kind === 'svg').length).toBeGreaterThanOrEqual(25)
  expect(vectors.filter((v) => v.kind === 'encode-invalid').length).toBeGreaterThanOrEqual(20)
})

describe.each(vectors.map((v) => [v.id, v] as const))('%s', (_id, v) => {
  const { text, ...options } = v.input
  if (v.kind === 'svg') {
    test('renders exactly the expected SVG', () => {
      expect(toSvg(text, options)).toBe(v.expected!.svg)
    })
    test('passes checkSvgOptions', () => {
      expect(() => checkSvgOptions(options)).not.toThrow()
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
    // textDependent: the error needs the text (too long, logo too big), so checkSvgOptions cannot know it.
    test(v.textDependent ? 'checkSvgOptions accepts it (textDependent)' : 'checkSvgOptions throws the same code', () => {
      if (v.textDependent) return expect(() => checkSvgOptions(options)).not.toThrow()
      expect(() => checkSvgOptions(options)).toThrow(expect.objectContaining({ code: v.error }))
    })
  }
})
