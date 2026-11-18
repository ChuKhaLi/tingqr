import { getField, type EmvPayload } from './payload.js'
import { parseTemplate } from './tlv.js'

/** Every sub-tag of tag 62 (additional data), keyed by sub-tag; undefined when tag 62 is absent. Rejects duplicates. */
export function readAdditionalData(p: EmvPayload): Record<string, string> | undefined {
  const value = getField(p, '62')?.value
  if (value === undefined) return undefined
  return Object.fromEntries(parseTemplate(value, '62').map((n) => [n.tag, n.value]))
}

/** Top-level tags not in `interpreted`, keyed by tag with verbatim values; undefined when there are none. */
export function readExtraFields(p: EmvPayload, interpreted: ReadonlySet<string>): Record<string, string> | undefined {
  const extra = p.fields.filter((f) => !interpreted.has(f.tag))
  return extra.length > 0 ? Object.fromEntries(extra.map((f) => [f.tag, f.value])) : undefined
}
