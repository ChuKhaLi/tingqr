// Refresh or check conformance/banks/ against vietqr.io and Google Play. Calls the network.
//
//   node conformance/tools/banks/update.mjs                 fetch and write banks.json and play-checks.json
//   node conformance/tools/banks/update.mjs --check         fetch and compare only; writes nothing in the repo
//   node conformance/tools/banks/update.mjs --seed --out D  first run: write everything into D, not the repo
//   --fetch-logos     also download logos and icons (write mode) or compare them (check mode)
//   --report <file>   also write the Markdown report to <file>
//
// Exit code: 0 = nothing changed, 2 = something changed (or a write was refused), 1 = error.
// bank-apps.json and overrides.json are curated by hand; this script never writes them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { diffApps, parseDlRedirects } from './lib/apps.mjs'
import { fetchVietqr, sleep } from './lib/fetch-vietqr.mjs'
import { collectLogos } from './lib/fetch-logos.mjs'
import { classifyPlay, playUrl, updatePlayChecks } from './lib/play.mjs'
import { renderReport } from './lib/report.mjs'
import { applyOverrides, parseBanksResponse } from './lib/vietqr.mjs'

/** Refuse to write a bank list that loses more than this many banks in one go. */
export const MAX_REMOVED = 5
const PLAY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback)
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))

function diffBanks(before, after) {
  const old = new Map(before.map((b) => [b.bin, b]))
  const now = new Map(after.map((b) => [b.bin, b]))
  return {
    added: after.filter((b) => !old.has(b.bin)).map((b) => `${b.bin} ${b.code}`),
    removed: before.filter((b) => !now.has(b.bin)).map((b) => `${b.bin} ${b.code}`),
    changed: after
      .filter((b) => old.has(b.bin) && JSON.stringify(old.get(b.bin)) !== JSON.stringify(b))
      .map((b) => `${b.bin} ${b.code}`),
  }
}

/**
 * @param {{ mode: 'seed'|'check'|'write', root: string, fetch: typeof fetch, today: string, outDir?: string, delayMs?: number }} o
 * @returns {Promise<{ changed: boolean, report: string }>}
 */
export async function run({ mode, root, fetch, today, outDir, delayMs = 500, fetchLogos = false }) {
  const dir = join(root, 'conformance', 'banks')
  const { banksJson, lists, redirects } = await fetchVietqr(fetch, delayMs)
  const banks = applyOverrides(parseBanksResponse(banksJson), readJson(join(dir, 'overrides.json'), []))
  const current = readJson(join(dir, 'banks.json'), { banks: [] }).banks
  const bankDiff = diffBanks(current, banks)
  const refused = mode !== 'seed' && bankDiff.removed.length > MAX_REMOVED

  const sourceApps = parseDlRedirects(redirects)
  const appsFile = readJson(join(dir, 'bank-apps.json'), { apps: [] })
  const curated = appsFile.apps
  const ignored = Object.keys(appsFile.ignoredVietqrApps ?? {})
  const appDiffs = mode === 'seed' ? [] : diffApps(curated, sourceApps, { ignored })

  const packages = [...new Set((mode === 'seed' ? sourceApps : curated).flatMap((a) => (a.android ? [a.android.package] : [])))].sort()
  let checks = mode === 'seed' ? {} : readJson(join(dir, 'play-checks.json'), {})
  const gone = []
  const unknown = []
  for (const pkg of packages) {
    const url = playUrl(pkg)
    const res = await fetch(url, { headers: { 'user-agent': PLAY_UA, 'accept-language': 'en' } })
    const result = classifyPlay({ status: res.status, url: res.url || url, body: await res.text() }, pkg)
    if (result === 'gone') gone.push(pkg)
    if (result === 'unknown') unknown.push(pkg)
    checks = updatePlayChecks(checks, pkg, result, today)
    await sleep(delayMs)
  }

  const logos =
    fetchLogos && mode !== 'seed'
      ? await collectLogos({ dir, fetch, today, delayMs, write: mode === 'write', banks: refused ? current : banks, apps: curated, lists })
      : undefined

  const report = renderReport({
    today,
    banks: { ...bankDiff, refused },
    apps: appDiffs,
    play: { gone, unknown, checked: packages.length },
    logos: logos && [...logos.changes, ...logos.notes],
  })
  const changed =
    refused ||
    bankDiff.added.length + bankDiff.removed.length + bankDiff.changed.length > 0 ||
    appDiffs.length > 0 ||
    gone.length > 0 ||
    (logos?.changes.length ?? 0) > 0

  const bankFile = { source: 'https://api.vietqr.io/v2/banks', fetchedAt: today, banks }
  if (mode === 'write') {
    if (!refused) writeJson(join(dir, 'banks.json'), bankFile)
    writeJson(join(dir, 'play-checks.json'), sortKeys(checks))
  } else if (mode === 'seed') {
    mkdirSync(outDir, { recursive: true })
    writeJson(join(outDir, 'banks.json'), bankFile)
    writeJson(join(outDir, 'play-checks.json'), sortKeys(checks))
    writeJson(join(outDir, 'vietqr-apps.json'), sourceApps)
  }
  return { changed, report }
}

async function main(argv) {
  const has = (f) => argv.includes(f)
  const arg = (f) => (argv.indexOf(f) >= 0 ? argv[argv.indexOf(f) + 1] : undefined)
  const mode = has('--seed') ? 'seed' : has('--check') ? 'check' : 'write'
  if (mode === 'seed' && !arg('--out')) throw new Error('--seed needs --out <dir>')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const today = new Date().toISOString().slice(0, 10)
  const r = await run({ mode, root, fetch, today, outDir: arg('--out') && resolve(arg('--out')), fetchLogos: has('--fetch-logos') })
  if (arg('--report')) writeFileSync(arg('--report'), r.report)
  process.stdout.write(r.report)
  return r.changed ? 2 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message)
      process.exit(1)
    },
  )
}
