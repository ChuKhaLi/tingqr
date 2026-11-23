// gen-svg.mjs: the vector files built from the cases, and --check on the committed vectors (needs the render build).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVectors, sourceOf, staleFiles } from '../gen-svg.mjs'
import { CASES } from '../svg-cases.mjs'

const GEN = fileURLToPath(new URL('../gen-svg.mjs', import.meta.url))
const VECTORS = fileURLToPath(new URL('../../../vectors/render/', import.meta.url))

class Boom extends Error {
  code = 'INVALID_VALUE'
}
const fakeToSvg = (text, options) => {
  if (options.margin < 0) throw new Boom('margin')
  return `<svg>${text}|${JSON.stringify(options)}</svg>`
}
const cases = [
  { id: 'render-svg-a', input: { text: 'hi', margin: 2 }, note: 'first' },
  { id: 'render-svg-invalid-b', input: { text: 'hi', margin: -1 }, error: 'INVALID_VALUE' },
]

test('builds one file per case: an svg vector, and an encode-invalid vector with render "svg"', () => {
  const files = buildVectors(cases, fakeToSvg, 'abc1234')
  assert.deepEqual(files.map((f) => f.file), ['render-svg-a.json', 'render-svg-invalid-b.json'])
  assert.equal(
    files[0].text,
    JSON.stringify(
      {
        id: 'render-svg-a',
        scheme: 'render',
        kind: 'svg',
        input: { text: 'hi', margin: 2 },
        expected: { svg: '<svg>hi|{"margin":2}</svg>' },
        source: sourceOf('abc1234'),
        note: 'first',
      },
      null,
      2,
    ) + '\n',
  )
  assert.deepEqual(JSON.parse(files[1].text), {
    id: 'render-svg-invalid-b',
    scheme: 'render',
    kind: 'encode-invalid',
    render: 'svg',
    input: { text: 'hi', margin: -1 },
    error: 'INVALID_VALUE',
    source: sourceOf('abc1234'),
  })
  assert.match(files[0].text, /at abc1234; golden output/)
})

test('a case whose error does not happen, or is another one, or a duplicate id, stops the generator', () => {
  assert.throws(() => buildVectors([{ id: 'x', input: { text: 'hi' }, error: 'INVALID_VALUE' }], fakeToSvg, 'c'), /expected INVALID_VALUE, got no error/)
  assert.throws(() => buildVectors([{ id: 'x', input: { text: 'hi', margin: -1 }, error: 'NON_ASCII' }], fakeToSvg, 'c'), /expected NON_ASCII, got INVALID_VALUE/)
  assert.throws(() => buildVectors([cases[0], cases[0]], fakeToSvg, 'c'), /duplicate case id/)
})

test('the real cases are valid ids and cover both kinds', () => {
  for (const c of CASES) assert.match(c.id, /^render-svg-[a-z0-9-]+$/)
  assert.ok(CASES.some((c) => c.error === undefined) && CASES.some((c) => c.error !== undefined))
  for (const c of CASES) assert.equal(c.error !== undefined, c.id.startsWith('render-svg-invalid-'), c.id)
})

function scratchDir(edit) {
  const tmp = mkdtempSync(join(tmpdir(), 'tingqr-gen-svg-'))
  cpSync(VECTORS, tmp, { recursive: true })
  edit?.(tmp)
  return tmp
}

test('staleFiles ignores the commit in source but reports changed, missing and uncased files', () => {
  const files = buildVectors(cases, fakeToSvg, 'abc1234')
  const tmp = mkdtempSync(join(tmpdir(), 'tingqr-gen-svg-'))
  try {
    for (const f of files) writeFileSync(join(tmp, f.file), f.text)
    assert.deepEqual(staleFiles(tmp, buildVectors(cases, fakeToSvg, 'fedcba9876')), [])
    writeFileSync(join(tmp, files[0].file), files[0].text.replace('"margin": 2', '"margin": 3'))
    rmSync(join(tmp, files[1].file))
    writeFileSync(join(tmp, 'render-svg-old.json'), '{}')
    writeFileSync(join(tmp, 'render-mask-0.json'), '{}')
    assert.deepEqual(staleFiles(tmp, files).sort(), ['render-svg-a.json: differs', 'render-svg-invalid-b.json: missing', 'render-svg-old.json: no case'])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

for (const [name, edit, status] of [
  ['the committed vectors', () => {}, 0],
  ['a copy with one SVG character changed', (d) => {
    const p = join(d, 'render-svg-default.json')
    writeFileSync(p, readFileSync(p, 'utf8').replace('crispEdges', 'crispEdgez'))
  }, 1],
  ['a copy with a vector deleted', (d) => rmSync(join(d, 'render-svg-margin-0.json')), 1],
  ['a copy with an extra render-svg file', (d) => writeFileSync(join(d, 'render-svg-extra.json'), '{}'), 1],
]) {
  test(`--check exits ${status} for ${name}`, () => {
    const tmp = scratchDir(edit)
    try {
      const r = spawnSync(process.execPath, [GEN, '--check', '--dir', tmp], { encoding: 'utf8' })
      assert.equal(r.status, status, r.stderr)
      if (status === 1) assert.match(r.stderr, /stale/)
      assert.ok(readdirSync(tmp).length > 0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
}
