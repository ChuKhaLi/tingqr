// Generate conformance/vectors/render/render-svg-*.json from @tingqr/render's toSvg (golden vectors, not an oracle).
//   node conformance/tools/render/gen-svg.mjs           write the files (build first: pnpm -C ts/packages/render build)
//   node conformance/tools/render/gen-svg.mjs --check   exit 1 if a file is missing, stale, has no case, or cites a
//                                                       commit that is not an ancestor of HEAD
// The commit in each `source` is the last commit that touched STAMP_PATHS (the render source and these tools), so it is
// a real commit that stays reachable once the branch is merged. Writing refuses while those paths have uncommitted
// changes: commit the generator or source change first, then regenerate. --check compares the files without the commit,
// so a later commit alone does not make them stale.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CASES } from './svg-cases.mjs'

const COMMIT = /\) at ([0-9a-f]{7,40}); golden/

/** Paths (from the repo root) whose last commit stamps the vectors. */
export const STAMP_PATHS = ['ts/packages/render/src', 'conformance/tools/render']

export const sourceOf = (commit) =>
  `@tingqr/render toSvg (TypeScript) at ${commit}; golden output so the two implementations agree, not an independent oracle ` +
  '(the encoder is checked against the original Nayuki on the matrix vectors; the matrices inside these SVGs come from the port)'

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

/** The short hash of the last commit that touched STAMP_PATHS in the repo at `root`. */
export function stampCommit(root) {
  return git(root, ['log', '-1', '--format=%h', '--', ...STAMP_PATHS])
}

/** `git status --porcelain` lines for STAMP_PATHS ([] when they are committed). */
export function uncommittedStampPaths(root) {
  return git(root, ['status', '--porcelain', '--', ...STAMP_PATHS]).split('\n').filter((l) => l !== '')
}

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
      if (c.textDependent) vector.textDependent = true
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

/** Problems with the commit each render-svg-* file in `dir` cites: none, or one for which `isAncestor(commit)` is false. */
export function unreachableStamps(dir, isAncestor) {
  const problems = []
  for (const f of readdirSync(dir).filter((n) => n.startsWith('render-svg-')).sort()) {
    const commit = COMMIT.exec(readFileSync(join(dir, f), 'utf8'))?.[1]
    if (commit === undefined) problems.push(`${f}: no source commit`)
    else if (!isAncestor(commit)) problems.push(`${f}: source commit ${commit} is not an ancestor of HEAD`)
  }
  return problems
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1]
  const check = process.argv.includes('--check')
  const dir = process.argv.includes('--dir') ? resolve(arg('--dir')) : join(root, 'conformance', 'vectors', 'render')
  if (!check) {
    const dirty = uncommittedStampPaths(root)
    if (dirty.length > 0) {
      console.error(`${STAMP_PATHS.join(' and ')} have uncommitted changes; commit them first so the vectors cite a real commit:\n  ${dirty.join('\n  ')}`)
      process.exit(1)
    }
  }
  const dist = join(root, 'ts', 'packages', 'render', 'dist', 'index.js')
  if (!existsSync(dist)) {
    console.error('ts/packages/render/dist is missing: run pnpm -C ts/packages/render build')
    process.exit(2)
  }
  const { toSvg } = await import(pathToFileURL(dist).href)
  const commit = stampCommit(root)
  const files = buildVectors(CASES, toSvg, commit)
  if (check) {
    const ancestors = new Map()
    const isAncestor = (c) => {
      if (!ancestors.has(c)) ancestors.set(c, spawnSync('git', ['merge-base', '--is-ancestor', c, 'HEAD'], { cwd: root }).status === 0)
      return ancestors.get(c)
    }
    const problems = [...staleFiles(dir, files), ...unreachableStamps(dir, isAncestor)]
    if (problems.length > 0) {
      console.error(`SVG vectors are stale: run node conformance/tools/render/gen-svg.mjs\n  ${problems.join('\n  ')}`)
      process.exit(1)
    }
  } else {
    for (const { file, text } of files) writeFileSync(join(dir, file), text)
    console.log(`wrote ${files.length} files to ${dir} (source commit ${commit})`)
  }
}
