// gen-svg.mjs: the vector files built from the cases, and --check on the committed vectors (needs the render build).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVectors, sourceOf, stampCommit, staleFiles, unreachableStamps } from '../gen-svg.mjs'
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

test('every rendering case has its own SVG, so no option can be dropped unnoticed', async () => {
  const { toSvg } = await import('../../../../ts/packages/render/dist/index.js')
  // Pairs that must render the same SVG: ecc H is forced by a logo; a digit string is written like the number.
  const same = [
    ['render-svg-logo-default', 'render-svg-logo-ecc-h'],
    ['render-svg-size-integer', 'render-svg-size-string-integer'],
  ]
  const allowed = (a, b) => same.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
  const seen = new Map()
  const svgOf = new Map()
  for (const c of CASES.filter((c) => c.error === undefined)) {
    const { text, ...options } = c.input
    const svg = toSvg(text, options)
    svgOf.set(c.id, svg)
    const other = seen.get(svg)
    if (other !== undefined && !allowed(other, c.id)) assert.fail(`${c.id} renders the same SVG as ${other}`)
    seen.set(svg, c.id)
  }
  for (const [a, b] of same) assert.equal(svgOf.get(a), svgOf.get(b), `${a} and ${b}`)
})

test('textDependent only on error cases', () => {
  for (const c of CASES) if (c.textDependent) assert.ok(c.error)
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

test('--check exits 1 when a stamped source commit is not an ancestor of HEAD', () => {
  const tmp = scratchDir((d) => {
    const p = join(d, 'render-svg-default.json')
    writeFileSync(p, readFileSync(p, 'utf8').replace(/\) at [0-9a-f]+; golden/, ') at 0000000; golden'))
  })
  try {
    const r = spawnSync(process.execPath, [GEN, '--check', '--dir', tmp], { encoding: 'utf8' })
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stderr, /render-svg-default\.json: source commit 0000000 is not an ancestor of HEAD/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('unreachableStamps reports each file whose commit fails isAncestor, and a file without a commit', () => {
  const files = buildVectors(cases, fakeToSvg, 'abc1234')
  const tmp = mkdtempSync(join(tmpdir(), 'tingqr-gen-svg-'))
  try {
    for (const f of files) writeFileSync(join(tmp, f.file), f.text)
    writeFileSync(join(tmp, 'render-mask-0.json'), '{}') // not an SVG vector: ignored
    assert.deepEqual(unreachableStamps(tmp, () => true), [])
    const asked = []
    const problems = unreachableStamps(tmp, (c) => (asked.push(c), false))
    assert.deepEqual(asked, ['abc1234', 'abc1234'])
    assert.deepEqual(problems, [
      'render-svg-a.json: source commit abc1234 is not an ancestor of HEAD',
      'render-svg-invalid-b.json: source commit abc1234 is not an ancestor of HEAD',
    ])
    writeFileSync(join(tmp, 'render-svg-a.json'), '{"source":"hand-written"}')
    assert.deepEqual(unreachableStamps(tmp, () => true), ['render-svg-a.json: no source commit'])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

/** A throwaway git repo with gen-svg.mjs and svg-cases.mjs at their real paths (no render build, so no dist). */
function scratchRepo() {
  const tmp = mkdtempSync(join(tmpdir(), 'tingqr-gen-svg-repo-'))
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: tmp, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  const tools = join(tmp, 'conformance', 'tools', 'render')
  mkdirSync(tools, { recursive: true })
  mkdirSync(join(tmp, 'ts', 'packages', 'render', 'src'), { recursive: true })
  mkdirSync(join(tmp, 'conformance', 'vectors', 'render'), { recursive: true })
  cpSync(GEN, join(tools, 'gen-svg.mjs'))
  cpSync(fileURLToPath(new URL('../svg-cases.mjs', import.meta.url)), join(tools, 'svg-cases.mjs'))
  writeFileSync(join(tmp, 'ts', 'packages', 'render', 'src', 'svg.ts'), 'export {}')
  git('init', '-q')
  return { tmp, git, gen: join(tools, 'gen-svg.mjs') }
}

test('the stamp is the last commit that touched the render source or tools, not HEAD', () => {
  const { tmp, git } = scratchRepo()
  try {
    git('add', '-A')
    git('commit', '-q', '-m', 'render')
    const render = git('log', '-1', '--format=%h')
    writeFileSync(join(tmp, 'README.md'), 'other')
    git('add', '-A')
    git('commit', '-q', '-m', 'other')
    assert.notEqual(git('log', '-1', '--format=%h'), render)
    assert.equal(stampCommit(tmp), render)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

for (const [name, edit] of [
  ['a changed render source file', (tmp) => writeFileSync(join(tmp, 'ts', 'packages', 'render', 'src', 'svg.ts'), 'export const x = 1')],
  ['an uncommitted new case file', (tmp) => writeFileSync(join(tmp, 'conformance', 'tools', 'render', 'more-cases.mjs'), 'export {}')],
]) {
  test(`writing refuses to stamp vectors when there is ${name}`, () => {
    const { tmp, git, gen } = scratchRepo()
    try {
      git('add', '-A')
      git('commit', '-q', '-m', 'render')
      // Clean: it gets past the git check and stops only at the missing render build.
      const clean = spawnSync(process.execPath, [gen], { cwd: tmp, encoding: 'utf8' })
      assert.equal(clean.status, 2, clean.stderr)
      assert.match(clean.stderr, /dist is missing/)
      edit(tmp)
      const r = spawnSync(process.execPath, [gen], { cwd: tmp, encoding: 'utf8' })
      assert.equal(r.status, 1, r.stderr)
      assert.match(r.stderr, /uncommitted changes/)
      assert.deepEqual(readdirSync(join(tmp, 'conformance', 'vectors', 'render')), [])
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
}
