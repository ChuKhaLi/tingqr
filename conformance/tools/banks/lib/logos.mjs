// Logos and icons for conformance/banks/logos/: SVG safety, Commons licence tags, manifest entries.
import { createHash } from 'node:crypto'

/**
 * Reasons an SVG is unsafe to embed in a web page, or [] when it is fine. tingqr rejects such a file (and falls back
 * to the PNG) instead of rewriting it.
 */
export function svgProblems(svg) {
  const problems = []
  if (/<\s*script\b/i.test(svg)) problems.push('<script>')
  if (/<\s*foreignObject\b/i.test(svg)) problems.push('<foreignObject>')
  if (/\son[a-z]+\s*=/i.test(svg)) problems.push('on* event attribute')
  for (const m of svg.matchAll(/\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) {
    if (!m[2].startsWith('#')) problems.push(`href to ${m[2].slice(0, 40)}`)
  }
  for (const m of svg.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    if (!m[2].startsWith('#')) problems.push(`url(${m[2].slice(0, 40)})`)
  }
  return problems
}

/** 'PD-textlogo' or 'PD-simple' from the page's Commons categories, or null (any other licence, or no page). */
export function commonsLicense(apiJson) {
  const page = Object.values(apiJson?.query?.pages ?? {})[0]
  if (!page || 'missing' in page) return null
  const cats = new Set((page.categories ?? []).map((c) => c.title))
  if (cats.has('Category:PD textlogo')) return 'PD-textlogo'
  if (cats.has('Category:PD simple')) return 'PD-simple'
  return null
}

/** One manifest.json entry; `bytes` is the file content. */
export function manifestEntry({ file, kind, key, sourceUrl, pageUrl, license, fetched, bytes }) {
  return {
    file,
    kind,
    key,
    sourceUrl,
    pageUrl,
    license,
    fetched,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  }
}

/**
 * Square icon of an app: the `appLogo` that the vietqr.io app lists give for its vietqr.io id, iOS list first, else
 * Android. null for an app vietqr.io does not list.
 */
export function iconUrl(app, lists) {
  const ref = app.sources?.find((s) => s.name === 'vietqr.io')?.ref
  if (!ref) return null
  for (const p of ['ios', 'android']) {
    const logo = lists?.[p]?.apps?.find((a) => a.appId === ref)?.appLogo
    if (logo) return logo
  }
  return null
}
