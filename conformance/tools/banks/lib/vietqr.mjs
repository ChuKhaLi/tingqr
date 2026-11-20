// Parse https://api.vietqr.io/v2/banks into the shape of conformance/banks/banks.json, and apply hand overrides.

/** @typedef {{ bin: string, code: string, shortName: string, name: string, swift: string|null, logoUrl: string }} Bank */
/** @typedef {{ bin: string, field: keyof Bank, value: unknown, reason: string, source: string }} Override */

const str = (v) => typeof v === 'string' && v.length > 0

/** @returns {Bank[]} sorted by bin. Throws when the response is not the shape we know. */
export function parseBanksResponse(json) {
  if (!json || !Array.isArray(json.data)) throw new Error('vietqr.io banks: response has no data array')
  if (json.data.length === 0) throw new Error('vietqr.io banks: empty list')
  const banks = json.data.map((b, i) => {
    if (!/^\d{6}$/.test(String(b?.bin))) throw new Error(`vietqr.io banks: entry ${i} has bin ${JSON.stringify(b?.bin)}`)
    for (const f of ['code', 'shortName', 'name', 'logo']) {
      if (!str(b[f])) throw new Error(`vietqr.io banks: bin ${b.bin} has no ${f}`)
    }
    return {
      bin: b.bin,
      code: b.code,
      shortName: b.shortName,
      name: b.name,
      swift: str(b.swift_code) ? b.swift_code : null,
      logoUrl: b.logo,
    }
  })
  return banks.sort((a, b) => a.bin.localeCompare(b.bin))
}

/** Returns a new list with each override applied; an override for a bin that is not in the list is an error. */
export function applyOverrides(banks, overrides) {
  const out = banks.map((b) => ({ ...b }))
  for (const o of overrides) {
    const bank = out.find((b) => b.bin === o.bin)
    if (!bank) throw new Error(`overrides.json: bin ${o.bin} is not in the vietqr.io list`)
    bank[o.field] = o.value
  }
  return out
}
