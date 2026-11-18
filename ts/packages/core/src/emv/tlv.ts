import { TingQrError } from '../errors.js'

export interface TlvField {
  tag: string
  value: string
}

export interface TlvNode extends TlvField {
  children?: TlvNode[]
}

/** EMV lengths count characters (Unicode code points), not bytes or UTF-16 code units. */
function charLength(s: string): number {
  return [...s].length
}

/** One TLV field: tag + two-digit length + value. Throws FIELD_TOO_LONG above 99 characters. */
export function field(tag: string, value: string): string {
  const length = charLength(value)
  if (length > 99) {
    throw new TingQrError('FIELD_TOO_LONG', `Tag ${tag} is ${length} characters long; the maximum is 99.`, tag)
  }
  return tag + String(length).padStart(2, '0') + value
}

export function encodeFields(fields: readonly TlvField[]): string {
  return fields.map((f) => field(f.tag, f.value)).join('')
}

/** Split a TLV string into top-level fields. Does not descend into templates. */
export function parseTlv(input: string): TlvNode[] {
  const chars = [...input]
  const out: TlvNode[] = []
  let i = 0
  while (i < chars.length) {
    if (i + 4 > chars.length) {
      throw new TingQrError('TRUNCATED', `Field header at position ${i} is cut off.`)
    }
    const tag = chars.slice(i, i + 2).join('')
    const lengthText = chars.slice(i + 2, i + 4).join('')
    if (!/^\d{2}$/.test(lengthText)) {
      throw new TingQrError('BAD_LENGTH', `Tag ${tag} has length "${lengthText}", expected two digits.`, tag)
    }
    const length = Number(lengthText)
    const start = i + 4
    if (start + length > chars.length) {
      throw new TingQrError('TRUNCATED', `Tag ${tag} declares ${length} characters but the payload ends first.`, tag)
    }
    out.push({ tag, value: chars.slice(start, start + length).join('') })
    i = start + length
  }
  return out
}

/** Parse the value of a template tag (e.g. 38, 62) into its sub-fields. */
export function parseTemplate(value: string): TlvNode[] {
  return parseTlv(value)
}
