// Search Wikimedia Commons for bank logo files and print name, license and categories. Calls the network.
// Usage: node conformance/tools/banks/commons-search.mjs "<query>" [...]
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'tingqr-update-banks (https://github.com/ChuKhaLi/tingqr)'

async function api(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`commons: HTTP ${res.status}`)
  return res.json()
}

for (const q of process.argv.slice(2)) {
  // "File:<name>" looks the title up directly; anything else is a search.
  const found = q.startsWith('File:') ? null : await api({ action: 'query', list: 'search', srnamespace: '6', srsearch: q, srlimit: '8' })
  const titles = found ? found.query.search.map((s) => s.title).filter((t) => /\.svg$/i.test(t)) : [q]
  await new Promise((r) => setTimeout(r, 1000))
  if (!titles.length) {
    console.log(`${q}: no svg`)
    continue
  }
  const info = await api({ action: 'query', titles: titles.join('|'), prop: 'imageinfo|categories', iiprop: 'url|extmetadata|size', cllimit: '100' })
  for (const p of Object.values(info.query.pages)) {
    const meta = p.imageinfo?.[0]?.extmetadata ?? {}
    const cats = (p.categories ?? []).map((c) => c.title.replace('Category:', '')).filter((c) => /PD|CC|license|trademark/i.test(c))
    console.log(`${q}\t${p.title}\t${meta.LicenseShortName?.value ?? '?'}\t${cats.join('; ')}`)
  }
}
