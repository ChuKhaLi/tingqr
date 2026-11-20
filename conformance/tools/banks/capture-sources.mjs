// Download the public vietqr.io lists and dl.vietqr.io redirects verbatim, for a dated snapshot in
// conformance/banks/sources/. Usage: node conformance/tools/banks/capture-sources.mjs <out-dir>   (calls the network)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchVietqr } from './lib/fetch-vietqr.mjs'

const out = process.argv[2]
if (!out) {
  console.error('usage: node capture-sources.mjs <out-dir>')
  process.exit(1)
}
mkdirSync(out, { recursive: true })
const { banksJson, lists, redirects } = await fetchVietqr(fetch)
const write = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n')
write('vietqr-banks.json', banksJson)
write('vietqr-android-app-deeplinks.json', lists.android)
write('vietqr-ios-app-deeplinks.json', lists.ios)
write('vietqr-dl-redirects.json', { capturedAt: new Date().toISOString(), ...redirects })
console.log(`banks: ${banksJson.data.length}, android: ${lists.android.apps.length}, ios: ${lists.ios.apps.length}`)
