// Generate conformance/vectors/render/render-svg-*.json from @tingqr/render's toSvg (golden vectors, not an oracle).
//   node conformance/tools/render/gen-svg.mjs           write the files (build first: pnpm -C ts/packages/render build)
//   node conformance/tools/render/gen-svg.mjs --check   exit 1 if a file is missing, stale or has no case
// The commit in each `source` is the HEAD at generation time. --check ignores it, so a new commit alone is not stale.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CASES } from './svg-cases.mjs'

const COMMIT = /\) at [0-9a-f]{7,40}; golden/

export const sourceOf = (commit) =>
  `@tingqr/render toSvg (TypeScript) at ${commit}; golden output so the two implementations agree, not an independent oracle ` +
  '(the matrix is pinned by the Nayuki matrix vectors)'

/**
 * The vectors for `cases` as { file, text }. `toSvg(text, options)` renders the cases without `error`; a case with
 * `error` must throw a TingQrError with that code, or the generator stops (a wrong case never becomes a vector).
 */
export function buildVectors(cases, toSvg, commit) {
  const seen = new Set()
  return cases.map((c) => {
    if (seen.has(c.id)) throw new Error(`duplicate case id ${c.id}`)
    seen.add(c.id)
    const { text, ...options } = c.input
    let vector
    if (c.error === undefined) {
      vector = { id: c.id, scheme: 'render', kind: 'svg', input: c.input, expected: { svg: toSvg(text, options) } }
    } else {
      let thrown
      try {
        toSvg(text, options)
      } catch (e) {
        thrown = e
      }
      if (thrown?.code !== c.error) {
        throw new Error(`${c.id}: expected ${c.error}, got ${thrown ? thrown.code ?? thrown : 'no error'}`)
      }
      vector = { id: c.id, scheme: 'render', kind: 'encode-invalid', render: 'svg', input: c.input, error: c.error }
    }
    vector.source = sourceOf(commit)
    if (c.note) vector.note = c.note
    return { file: `${c.id}.json`, text: JSON.stringify(vector, null, 2) + '\n' }
  })
}

/** Problems between the files in `dir` and `expected` ([] when current), ignoring the commit in `source`. */
export function staleFiles(dir, expected) {
  const norm = (t) => t.replace(COMMIT, ') at COMMIT; golden')
  const problems = []
  for (const { file, text } of expected) {
    const path = join(dir, file)
    if (!existsSync(path)) problems.push(`${file}: missing`)
    else if (norm(readFileSync(path, 'utf8')) !== norm(text)) problems.push(`${file}: differs`)
  }
  const names = new Set(expected.map((e) => e.file))
  for (const f of readdirSync(dir)) if (f.startsWith('render-svg-') && !names.has(f)) problems.push(`${f}: no case`)
  return problems
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1]
  const dir = process.argv.includes('--dir') ? resolve(arg('--dir')) : join(root, 'conformance', 'vectors', 'render')
  const dist = join(root, 'ts', 'packages', 'render', 'dist', 'index.js')
  if (!existsSync(dist)) {
    console.error('ts/packages/render/dist is missing: run pnpm -C ts/packages/render build')
    process.exit(2)
  }
  const { toSvg } = await import(pathToFileURL(dist).href)
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const files = buildVectors(CASES, toSvg, commit)
  if (process.argv.includes('--check')) {
    const problems = staleFiles(dir, files)
    if (problems.length > 0) {
      console.error(`SVG vectors are stale: run node conformance/tools/render/gen-svg.mjs\n  ${problems.join('\n  ')}`)
      process.exit(1)
    }
  } else {
    for (const { file, text } of files) writeFileSync(join(dir, file), text)
    console.log(`wrote ${files.length} files to ${dir} (source commit ${commit})`)
  }
}
