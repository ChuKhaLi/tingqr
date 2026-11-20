// Network access to vietqr.io: the bank list, the two app lists, and the dl.vietqr.io redirect for each app.

export const VIETQR_SOURCES = {
  banks: 'https://api.vietqr.io/v2/banks',
  android: 'https://api.vietqr.io/v2/android-app-deeplinks',
  ios: 'https://api.vietqr.io/v2/ios-app-deeplinks',
}

export const USER_AGENTS = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
}

export const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve())

async function getJson(fetch, url) {
  const res = await fetch(url, { headers: { 'user-agent': 'tingqr-update-banks' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return JSON.parse(await res.text())
}

/**
 * The deeplink lists only carry dl.vietqr.io URLs. dl.vietqr.io answers an Android browser with a 302 to
 * `intent://` (scheme, package, host) and an iPhone browser with a page whose "open" button holds `scheme://`.
 * @returns {Promise<{ banksJson: unknown, lists: Record<'android'|'ios', any>, redirects: any }>}
 */
export async function fetchVietqr(fetch, delayMs = 300) {
  const banksJson = await getJson(fetch, VIETQR_SOURCES.banks)
  const lists = { android: await getJson(fetch, VIETQR_SOURCES.android), ios: await getJson(fetch, VIETQR_SOURCES.ios) }
  const redirects = { userAgents: USER_AGENTS, android: {}, ios: {} }
  for (const platform of ['android', 'ios']) {
    if (!Array.isArray(lists[platform]?.apps)) throw new Error(`vietqr.io ${platform} app list has no apps array`)
    for (const app of lists[platform].apps) {
      const res = await fetch(app.deeplink, { redirect: 'manual', headers: { 'user-agent': USER_AGENTS[platform] } })
      const body = res.status === 200 ? await res.text() : ''
      const openHref = /<a[^>]*id="open"[^>]*href="([^"]*)"/.exec(body)?.[1] ?? null
      redirects[platform][app.appId] = { status: res.status, location: res.headers.get('location'), openHref }
      await sleep(delayMs)
    }
  }
  return { banksJson, lists, redirects }
}
