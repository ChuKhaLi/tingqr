// Minimal EMV TLV reader/writer for the recipe tool (independent of tingqr). Lengths count characters.

export function parse(value) {
  const chars = [...value]
  const out = []
  let i = 0
  while (i < chars.length) {
    const tag = chars.slice(i, i + 2).join('')
    const len = Number(chars.slice(i + 2, i + 4).join(''))
    if (!/^\d{2}$/.test(tag) || Number.isNaN(len) || i + 4 + len > chars.length) throw new Error('malformed TLV')
    out.push({ tag, value: chars.slice(i + 4, i + 4 + len).join('') })
    i += 4 + len
  }
  return out
}

export function write(fields) {
  return fields.map((f) => f.tag + String([...f.value].length).padStart(2, '0') + f.value).join('')
}

/** Paths whose value is itself TLV: top-level 26–51 and 62, plus 38.01. */
export function isTemplate(path) {
  if (path === '62' || path === '38.01') return true
  return /^\d{2}$/.test(path) && Number(path) >= 26 && Number(path) <= 51
}
