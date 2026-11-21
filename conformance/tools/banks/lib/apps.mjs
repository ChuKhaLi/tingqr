// Read the dl.vietqr.io redirects (see capture-sources.mjs) and compare them with conformance/banks/bank-apps.json.

/** @typedef {{ host: string, scheme: string, package: string }} AndroidLink */
/** @typedef {{ id: string, ios?: { scheme: string }, android?: AndroidLink }} SourceApp */
/** @typedef {{ appId: string, kind: 'new'|'missing'|'scheme'|'package'|'host', detail: string }} AppDiff */

/** `intent://<host>#Intent;scheme=..;package=..;...;end` → parts, or null if it is not an intent URL. */
export function parseIntent(url) {
  const m = /^intent:\/\/([^#]*)#Intent;(.*)end$/.exec(url ?? '')
  if (!m) return null
  const params = Object.fromEntries(
    m[2]
      .split(';')
      .filter(Boolean)
      .map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]),
  )
  if (!params.scheme || !params.package) return null
  return { host: m[1], scheme: params.scheme, package: params.package }
}

/** `scheme://...` → scheme, or null. */
function schemeOf(href) {
  return /^([A-Za-z][A-Za-z0-9.+-]*):\/\//.exec(href ?? '')?.[1] ?? null
}

/** @returns {SourceApp[]} one entry per vietqr.io app id, sorted by id. */
export function parseDlRedirects(json) {
  const apps = new Map()
  const get = (id) => apps.get(id) ?? apps.set(id, { id }).get(id)
  for (const [id, r] of Object.entries(json.android ?? {})) {
    const link = parseIntent(r.location)
    if (link) get(id).android = link
  }
  for (const [id, r] of Object.entries(json.ios ?? {})) {
    const scheme = schemeOf(r.openHref)
    if (scheme && scheme !== 'http' && scheme !== 'https') get(id).ios = { scheme }
  }
  return [...apps.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Compare curated apps (each linked to vietqr.io by `sources[].ref` where `name === 'vietqr.io'`) with the source.
 * `ignored`: vietqr.io app ids left out on purpose (bank-apps.json `ignoredVietqrApps`). An app's `vietqrDiffers`
 * lists the kinds ('scheme', 'package', 'host') where it differs from vietqr.io on purpose.
 * @returns {AppDiff[]}
 */
export function diffApps(curated, source, { ignored = [] } = {}) {
  const diffs = []
  const byRef = new Map()
  for (const app of curated) {
    const ref = app.sources?.find((s) => s.name === 'vietqr.io')?.ref
    if (ref) byRef.set(ref, app)
  }
  const seen = new Set()
  for (const s of source) {
    if (ignored.includes(s.id)) continue
    const app = byRef.get(s.id)
    if (!app) {
      diffs.push({ appId: s.id, kind: 'new', detail: `vietqr.io có app ${s.id}, bank-apps.json chưa có` })
      continue
    }
    seen.add(s.id)
    const skip = new Set(app.vietqrDiffers ?? [])
    const before = diffs.length
    for (const p of ['ios', 'android']) {
      const a = app[p]?.scheme
      const b = s[p]?.scheme
      if (a !== b) diffs.push({ appId: app.id, kind: 'scheme', detail: `${p}: ${a ?? '(không có)'} → ${b ?? '(không có)'}` })
    }
    if (app.android?.package !== s.android?.package) {
      diffs.push({ appId: app.id, kind: 'package', detail: `${app.android?.package ?? '(không có)'} → ${s.android?.package ?? '(không có)'}` })
    }
    if (app.android && s.android && app.android.host !== s.android.host) {
      diffs.push({ appId: app.id, kind: 'host', detail: `${JSON.stringify(app.android.host)} → ${JSON.stringify(s.android.host)}` })
    }
    diffs.splice(before, diffs.length - before, ...diffs.slice(before).filter((d) => !skip.has(d.kind)))
  }
  for (const [ref, app] of byRef) {
    if (!seen.has(ref)) diffs.push({ appId: app.id, kind: 'missing', detail: `vietqr.io không còn app ${ref}` })
  }
  return diffs
}
