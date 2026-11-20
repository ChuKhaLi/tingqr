// src/banks/data.ts is generated from conformance/banks/ by sync-ts.mjs and must not drift from it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CONFORMANCE_DIR } from './conformance-root.js'

test('src/banks/data.ts matches conformance/banks/ (run: node conformance/tools/banks/sync-ts.mjs)', async () => {
  const { renderDataTs } = await import(pathToFileURL(join(CONFORMANCE_DIR, 'tools', 'banks', 'sync-ts.mjs')).href)
  const read = (name: string) => JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'banks', name), 'utf8'))
  const expected: string = renderDataTs(read('banks.json').banks, read('bank-apps.json').apps)
  const actual = readFileSync(new URL('../src/banks/data.ts', import.meta.url), 'utf8')
  expect(actual === expected, 'src/banks/data.ts is stale: run node conformance/tools/banks/sync-ts.mjs').toBe(true)
})
