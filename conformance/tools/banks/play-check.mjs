// Check Android packages on Google Play and print one line each (ok / gone / unknown). Calls the network.
// Usage: node conformance/tools/banks/play-check.mjs <package> [<package> ...]
import { classifyPlay, playUrl } from './lib/play.mjs'
import { sleep } from './lib/fetch-vietqr.mjs'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
for (const pkg of process.argv.slice(2)) {
  const url = playUrl(pkg)
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' } })
  const body = await res.text()
  const title = /<title>([^<]*)<\/title>/.exec(body)?.[1] ?? ''
  console.log(`${pkg}\t${classifyPlay({ status: res.status, url: res.url || url, body }, pkg)}\t${title}`)
  await sleep(500)
}
