// conformance/banks/logos/: manifest.json lists exactly the files on disk, with their real SHA-256, and every SVG is safe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { svgProblems } from '../lib/logos.mjs'

const LOGOS = fileURLToPath(new URL('../../../banks/logos/', import.meta.url))
const BANKS = fileURLToPath(new URL('../../../banks/', import.meta.url))
const manifest = JSON.parse(readFileSync(join(LOGOS, 'manifest.json'), 'utf8')).files
const onDisk = ['logo', 'icon'].flatMap((d) => readdirSync(join(LOGOS, d)).map((f) => `${d}/${f}`)).sort()

test('manifest lists exactly the files on disk', () => {
  assert.deepEqual(manifest.map((e) => e.file).sort(), onDisk)
})

test('each file matches its SHA-256 and size', () => {
  for (const e of manifest) {
    const bytes = readFileSync(join(LOGOS, e.file))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), e.sha256, e.file)
    assert.equal(bytes.length, e.bytes, e.file)
  }
})

test('every SVG passes svgProblems and comes from a PD-tagged Commons page', () => {
  for (const e of manifest.filter((x) => x.file.endsWith('.svg'))) {
    assert.deepEqual(svgProblems(readFileSync(join(LOGOS, e.file), 'utf8')), [], e.file)
    assert.ok(['PD-textlogo', 'PD-simple'].includes(e.license), e.file)
    assert.match(e.pageUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
  }
})

test('logos are keyed by a BIN of banks.json and icons by an id of bank-apps.json', () => {
  const bins = new Set(JSON.parse(readFileSync(join(BANKS, 'banks.json'), 'utf8')).banks.map((b) => b.bin))
  const ids = new Set(JSON.parse(readFileSync(join(BANKS, 'bank-apps.json'), 'utf8')).apps.map((a) => a.id))
  for (const e of manifest) assert.ok(e.kind === 'logo' ? bins.has(e.key) : ids.has(e.key), e.file)
})
