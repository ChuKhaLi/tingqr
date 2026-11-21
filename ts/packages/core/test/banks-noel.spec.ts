// Noel tree (tingqr's first user) builds links for 15 apps with its own appLink (snapshot:
// conformance/banks/sources/2026-11-20/noel-tree-bank-apps.json). bankAppLink must give the same Android string, so
// switching Noel tree's appLink to tingqr changes nothing. Noel tree's autofill apps go through dl.vietqr.io/pay
// instead (payLink); tingqr does not pre-fill, so that path is out of scope here.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { bankAppLink } from '../src/banks.js'

type NoelApp = { id: string; scheme: string; android: string; androidHost: string }
const json = (p: string): any => JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'banks', p), 'utf8'))
const NOEL_TREE: NoelApp[] = json('sources/2026-11-20/noel-tree-bank-apps.json').apps

test('the snapshot has the 15 apps Noel tree stores ids of', () => {
  expect(NOEL_TREE.map((n) => n.id).sort()).toEqual(['acb', 'bidv', 'cake', 'hdb', 'icb', 'mb', 'ocb', 'shb', 'tcb', 'timo', 'tpb', 'vba', 'vcb', 'vib', 'vpb'])
})

test.each(NOEL_TREE)('$id: Android link equals Noel tree appLink', (n) => {
  expect(bankAppLink(n.id, 'android')).toBe(`intent://${n.androidHost}#Intent;scheme=${n.scheme};package=${n.android};end`)
})

test.each(NOEL_TREE)('$id: iOS link equals Noel tree appLink', (n) => {
  expect(bankAppLink(n.id, 'ios')).toBe(`${n.scheme}://`)
})

