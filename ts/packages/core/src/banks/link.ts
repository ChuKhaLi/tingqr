import { TingQrError } from '../errors.js'
import type { AppPlatform, BankApp } from './types.js'

// WHATWG URL exists in every runtime core supports (browsers, Node, Workers); core's lib settings carry no DOM or
// Node types, so declare the members used here.
declare const URL: new (url: string) => { readonly protocol: string; readonly href: string }

/**
 * Parsed with the WHATWG URL Standard; the scheme must be http: or https:. The *serialised* URL (`href`) is what gets
 * percent-encoded, so surrounding spaces, letter case of scheme and host, and lone surrogates are normalised first
 * and the result is always ASCII (rules and vectors: conformance/README.md, "Mẫu link mở app").
 */
function fallbackOf(url: string): string {
  let parsed: { protocol: string; href: string }
  try {
    parsed = new URL(url)
  } catch {
    throw new TingQrError('INVALID_VALUE', `fallbackUrl must be an absolute http(s) URL, got ${JSON.stringify(url)}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TingQrError('INVALID_VALUE', `fallbackUrl must use https: or http:, got ${parsed.protocol}`)
  }
  return encodeURIComponent(parsed.href)
}

/**
 * Android: `intent://<host>#Intent;scheme=..;package=..;[S.browser_fallback_url=..;]end`. iOS: `<scheme>://`
 * (`fallbackUrl` has no iOS equivalent and is ignored there, but still validated). Opens the app only: no amount or
 * message is pre-filled.
 */
export function linkFor(app: BankApp | undefined, appId: string, platform: AppPlatform, fallbackUrl?: string): string {
  if (!app) throw new TingQrError('INVALID_VALUE', `unknown bank app ${JSON.stringify(appId)}`)
  if (platform !== 'android' && platform !== 'ios') {
    throw new TingQrError('INVALID_VALUE', `platform must be 'android' or 'ios', got ${JSON.stringify(platform)}`)
  }
  const fallback = fallbackUrl === undefined ? undefined : fallbackOf(fallbackUrl)
  if (platform === 'ios') {
    if (!app.ios) throw new TingQrError('INVALID_VALUE', `${app.id} has no known ios scheme`)
    return `${app.ios.scheme}://`
  }
  const a = app.android
  if (!a) throw new TingQrError('INVALID_VALUE', `${app.id} has no known android scheme`)
  const tail = fallback === undefined ? '' : `S.browser_fallback_url=${fallback};`
  return `intent://${a.host}#Intent;scheme=${a.scheme};package=${a.package};${tail}end`
}
