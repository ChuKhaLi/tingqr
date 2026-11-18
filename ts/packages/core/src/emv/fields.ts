import { getField, type EmvPayload } from './payload.js'
import { assertUniqueTags, parseTemplate, parseTlv, type TlvNode } from './tlv.js'

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

/**
 * The sub-fields of a scheme's merchant-account template (e.g. tag 26 for VNPAY, 38 for VietQR), or undefined when the
 * tag is absent, is not clean TLV, or its sub-tag 00 is not `guid` (compared case-insensitively). Only once the GUID
 * matches are duplicate sub-tags reported (DUPLICATE_TAG): a malformed template of another scheme means "not ours".
 */
export function readSchemeTemplate(p: EmvPayload, tag: string, guid: string): TlvNode[] | undefined {
  const value = getField(p, tag)?.value
  if (value === undefined) return undefined
  let nodes: TlvNode[]
  try {
    nodes = parseTlv(value)
  } catch {
    return undefined
  }
  if (nodes.find((n) => n.tag === '00')?.value.toUpperCase() !== guid) return undefined
  assertUniqueTags(nodes, tag)
  return nodes
}
