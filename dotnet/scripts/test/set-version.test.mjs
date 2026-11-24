// Tests for set-version.mjs, run on temp copies of the two files.
// Run: node --test dotnet/scripts/test/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DOTNET = join(HERE, '..', '..')
const SCRIPT = join(HERE, '..', 'set-version.mjs')
const FILES = ['Directory.Build.props', join('src', 'TingQR.Core', 'TingQrVersion.cs')]

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'tingqr-dotnet-'))
  for (const f of FILES) {
    mkdirSync(dirname(join(root, f)), { recursive: true })
    copyFileSync(join(DOTNET, f), join(root, f))
  }
  return root
}
const run = (root, arg) =>
  spawnSync(process.execPath, [SCRIPT, ...(arg === undefined ? [] : [arg])], { env: { ...process.env, TINGQR_DOTNET_ROOT: root }, encoding: 'utf8' })
const read = (root) => FILES.map((f) => readFileSync(join(root, f), 'utf8'))

test('0.1.0 is written to both files', () => {
  const root = tempRoot()
  try {
    const r = run(root, '0.1.0')
    assert.equal(r.status, 0, r.stderr)
    const [props, cs] = read(root)
    assert.match(props, /<Version>0\.1\.0<\/Version>/)
    assert.match(cs, /public const string Value = "0\.1\.0";/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

for (const bad of ['v0.1.0', '0.1', '0.1.0-rc.1', '']) {
  test(`${JSON.stringify(bad)} is refused and nothing changes`, () => {
    const root = tempRoot()
    try {
      const before = read(root)
      const r = run(root, bad)
      assert.equal(r.status, 1)
      assert.deepEqual(read(root), before)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
}

test('no argument is refused', () => {
  const root = tempRoot()
  try { assert.equal(run(root).status, 1) } finally { rmSync(root, { recursive: true, force: true }) }
})
