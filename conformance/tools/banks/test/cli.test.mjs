// update.mjs as the monthly Action runs it: `--check --report <file> --root <dir>`, exit code 0 / 2 / 1, no writes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBanksResponse } from '../lib/vietqr.mjs'
import { BANKS, makeRoot, snapshot } from './helpers.mjs'

const UPDATE = fileURLToPath(new URL('../update.mjs', import.meta.url))
const MOCK = new URL('./mock-fetch.mjs', import.meta.url).href

function cli(root, env = {}) {
  const report = join(mkdtempSync(join(tmpdir(), 'tingqr-report-')), 'report.md')
  const r = spawnSync(process.execPath, ['--import', MOCK, UPDATE, '--check', '--report', report, '--root', root, '--delay-ms', '0'], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { status: r.status, stderr: r.stderr, report: existsSync(report) ? readFileSync(report, 'utf8') : null }
}

test('--check exits 0 when nothing changed and writes nothing', () => {
  const { root, dir } = makeRoot()
  const before = snapshot(dir)
  assert.equal(cli(root).status, 0)
  assert.deepEqual(snapshot(dir), before)
})

test('--check exits 2 and writes the report when something changed, still writing nothing in the repo', () => {
  const { root, dir } = makeRoot({ banks: parseBanksResponse(BANKS).slice(1) })
  const before = snapshot(dir)
  const r = cli(root)
  assert.equal(r.status, 2)
  assert.match(r.report, /970406/)
  assert.deepEqual(snapshot(dir), before)
})

test('--check exits 1 on a malformed upstream response', () => {
  const { root, dir } = makeRoot()
  const before = snapshot(dir)
  const r = cli(root, { TINGQR_FAKE: 'malformed' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /data/)
  assert.deepEqual(snapshot(dir), before)
})
