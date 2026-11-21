// Logos and icons for conformance/banks/logos/: SVG safety, Commons licence tags, manifest entries.
import { createHash } from 'node:crypto'

/** Static drawing elements only: no script, style, animation, foreignObject, image or link targets. */
const ALLOWED_ELEMENTS = new Set(
  'svg g defs path rect circle ellipse line polyline polygon text tspan use linearGradient radialGradient stop clipPath mask symbol pattern title desc metadata'.split(
    ' ',
  ),
)
/** Editor metadata that browsers ignore (Inkscape, Sodipodi, RDF, Creative Commons, Dublin Core). */
const METADATA_PREFIXES = ['sodipodi:', 'inkscape:', 'rdf:', 'cc:', 'dc:']
const SVG_NS = 'http://www.w3.org/2000/svg'
/**
 * The only namespace each prefix may be bound to. Without this check `<dc:script xmlns:dc="…/svg">` would pass the
 * prefix allowlist yet be a real SVG script element.
 */
const NAMESPACES = {
  sodipodi: 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd',
  inkscape: 'http://www.inkscape.org/namespaces/inkscape',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  cc: 'http://creativecommons.org/ns#',
  dc: 'http://purl.org/dc/elements/1.1/',
  xlink: 'http://www.w3.org/1999/xlink',
  svg: SVG_NS,
}

/**
 * Reasons an SVG is unsafe to embed in a web page, or [] when it is fine. Deliberately strict (a regex scan, not a
 * parser): anything outside an allowlist of static drawing elements, any event attribute, any declaration that could
 * define entities, any `attributeName`, and any `href` or `url()` that does not point inside the file count as
 * problems. tingqr then rejects the file and falls back to the PNG; it never rewrites an SVG. False positives only
 * cost an SVG.
 */
export function svgProblems(svg) {
  const problems = []
  for (const m of svg.matchAll(/<\s*([A-Za-z][\w:.-]*)/g)) {
    const name = m[1]
    if (!ALLOWED_ELEMENTS.has(name) && !METADATA_PREFIXES.some((p) => name.startsWith(p))) problems.push(`<${name}>`)
  }
  for (const m of svg.matchAll(/\bxmlns(?::([\w.-]+))?\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi)) {
    const prefix = m[1]
    const uri = m[2] ?? m[3] ?? m[4]
    const allowed = prefix === undefined ? SVG_NS : NAMESPACES[prefix]
    if (uri !== allowed) problems.push(`xmlns${prefix ? `:${prefix}` : ''}="${uri.slice(0, 40)}"`)
  }
  if (/<!(?!--)/.test(svg)) problems.push('<! declaration (DOCTYPE, ENTITY or CDATA)')
  if (/(?:^|[\s/"'])on[a-z]+\s*=/i.test(svg)) problems.push('on* event attribute')
  if (/\battributeName\s*=/i.test(svg)) problems.push('attributeName')
  for (const m of svg.matchAll(/\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi)) {
    const value = m[1] ?? m[2] ?? m[3]
    if (!/^#[\w.-]*$/.test(value)) problems.push(`href to ${value.slice(0, 40)}`)
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
