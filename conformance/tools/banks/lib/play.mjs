// Classify a Google Play details-page response and keep conformance/banks/play-checks.json.

/** @typedef {'ok'|'gone'|'unknown'} PlayResult */

export const playUrl = (pkg) => `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=en`

/**
 * ok only when the final page is still on play.google.com and names the package; 404 is gone; anything else
 * (rate limit, consent or sign-in redirect, server error) is unknown and must not be read as "gone".
 * @returns {PlayResult}
 */
export function classifyPlay(res, pkg) {
  if (res.status === 404) return 'gone'
  if (res.status !== 200) return 'unknown'
  let host
  try {
    host = new URL(res.url).hostname
  } catch {
    return 'unknown'
  }
  if (host !== 'play.google.com') return 'unknown'
  return res.body.includes(pkg) ? 'ok' : 'unknown'
}

/** Returns a new record; only an `ok` moves `lastOk`. */
export function updatePlayChecks(prev, pkg, result, date) {
  return {
    ...prev,
    [pkg]: { lastOk: result === 'ok' ? date : (prev[pkg]?.lastOk ?? null), last: result, checked: date },
  }
}
