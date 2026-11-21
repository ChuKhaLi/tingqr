// Download bank logos and app icons into conformance/banks/logos/ and keep manifest.json. Calls the network.
//
// Logo per bank (by BIN): the Commons SVG named in logos/commons.json when Commons tags it PD-textlogo or PD-simple
// and svgProblems() finds nothing; otherwise the vietqr.io PNG (logoUrl). Icon per app: cdn.vietqr.io by the app's
// vietqr.io id. Nothing is edited: files are stored as downloaded.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { sleep } from './fetch-vietqr.mjs'
import { commonsLicense, iconUrl, manifestEntry, svgProblems } from './logos.mjs'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'tingqr-update-banks (https://github.com/ChuKhaLi/tingqr)'
const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback)

async function download(fetch, url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  return res.ok ? { bytes: Buffer.from(await res.arrayBuffer()) } : { status: res.status }
}

async function commonsSvg(fetch, title) {
  const params = new URLSearchParams({ format: 'json', action: 'query', titles: title, prop: 'imageinfo|categories', iiprop: 'url', cllimit: '100' })
  const res = await fetch(`${COMMONS_API}?${params}`, { headers: { 'user-agent': UA } })
  if (!res.ok) return { note: `${title}: Commons trả HTTP ${res.status}` }
  const info = await res.json()
  const license = commonsLicense(info)
  if (!license) return { note: `${title} không có nhãn PD-textlogo hay PD-simple` }
  const url = Object.values(info.query.pages)[0].imageinfo?.[0]?.url?.split('?')[0]
  if (!url) return { note: `${title}: Commons không cho link file` }
  const got = await download(fetch, url)
  if (!got.bytes) return { note: `${title}: không tải được (HTTP ${got.status})` }
  const problems = svgProblems(got.bytes.toString('utf8'))
  if (problems.length) return { note: `${title} bị loại: ${problems.join(', ')}` }
  const pageUrl = `https://commons.wikimedia.org/wiki/${encodeURI(title.replace(/ /g, '_'))}`
  return { found: { sourceUrl: url, pageUrl, license, bytes: got.bytes } }
}

/**
 * @returns {Promise<{ changes: string[], notes: string[] }>} `changes`: files added, changed or dropped (the run
 * counts as changed when there is any); `notes`: fallbacks and failed downloads.
 */
export async function collectLogos({ dir, fetch, today, delayMs = 500, write, banks, apps, lists, shrink }) {
  // Raster logos from vietqr.io are stored shrunk (lib/shrink.mjs); sharp loads only when a file must be written.
  const shrinkFn = shrink ?? (async (b) => (await import('./shrink.mjs')).shrinkLogo(b))
  const shrinkNote = shrink ? 'resized to 128 px high (never enlarged), lossless WebP, test stand-in' : undefined
  const logosDir = join(dir, 'logos')
  const commons = readJson(join(logosDir, 'commons.json'), { logos: {} }).logos ?? {}
  const old = readJson(join(logosDir, 'manifest.json'), { files: [] }).files
  const oldByKey = new Map(old.map((e) => [`${e.kind}:${e.key}`, e]))
  const fresh = []
  const notes = []

  for (const bank of banks) {
    let found
    if (commons[bank.bin]) {
      const c = await commonsSvg(fetch, commons[bank.bin])
      await sleep(delayMs)
      if (c.note) notes.push(`logo ${bank.bin}: ${c.note}; dùng PNG của vietqr.io`)
      if (c.found) found = { file: `logo/${bank.bin}.svg`, ...c.found }
    }
    if (!found) {
      const got = await download(fetch, bank.logoUrl)
      if (got.bytes) found = { file: `logo/${bank.bin}.webp`, sourceUrl: bank.logoUrl, pageUrl: null, license: 'trademark-no-license', bytes: got.bytes, shrink: true }
      else notes.push(`logo ${bank.bin}: không tải được ${bank.logoUrl} (HTTP ${got.status})`)
    }
    if (found) fresh.push({ kind: 'logo', key: bank.bin, ...found })
  }
  for (const app of apps) {
    const url = iconUrl(app, lists)
    if (!url) continue
    const got = await download(fetch, url)
    if (got.bytes) fresh.push({ kind: 'icon', key: app.id, file: `icon/${app.id}.webp`, sourceUrl: url, pageUrl: null, license: 'trademark-no-license', bytes: got.bytes })
    else notes.push(`icon ${app.id}: không tải được ${url} (HTTP ${got.status})`)
  }

  // A shrunk file is compared by the hash of what was downloaded, so a new sharp version alone is not a change.
  const changes = []
  const toWrite = []
  const entries = []
  for (const f of fresh) {
    const prev = oldByKey.get(`${f.kind}:${f.key}`)
    const source = manifestEntry({ ...f, fetched: today })
    const prevSource = prev?.sourceSha256 ?? prev?.sha256
    if (prev && prev.file === f.file && prev.sourceUrl === f.sourceUrl && prevSource === source.sha256) {
      entries.push(prev)
      continue
    }
    changes.push(`${f.file}: ${prev ? 'đổi' : 'mới'}`)
    if (!f.shrink) {
      entries.push(source)
      toWrite.push({ file: f.file, bytes: f.bytes })
    } else if (write) {
      const bytes = await shrinkFn(f.bytes)
      const note = shrinkNote ?? (await import('./shrink.mjs')).SHRINK_NOTE
      entries.push({ ...manifestEntry({ ...f, bytes, fetched: today }), sourceSha256: source.sha256, processed: note })
      toWrite.push({ file: f.file, bytes })
    }
  }
  const keep = new Set(entries.map((e) => e.file))
  const dropped = old.filter((e) => !keep.has(e.file))
  for (const e of dropped) if (!fresh.some((f) => `${f.kind}:${f.key}` === `${e.kind}:${e.key}`)) changes.push(`${e.file}: bỏ`)

  if (write) {
    for (const f of toWrite) {
      const path = join(logosDir, f.file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, f.bytes)
    }
    for (const e of dropped) rmSync(join(logosDir, e.file), { force: true })
    entries.sort((a, b) => a.file.localeCompare(b.file))
    writeFileSync(join(logosDir, 'manifest.json'), JSON.stringify({ files: entries }, null, 2) + '\n')
  }
  return { changes, notes }
}
