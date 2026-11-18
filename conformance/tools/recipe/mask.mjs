// Replace sensitive values in a real QR payload while keeping its structure: tag order, lengths, character classes,
// GUIDs, BINs, service codes and letter prefixes (PSP, MOMOW2W, 99ZP…). The CRC is recomputed. Deterministic.
import { crc16 } from './crc.mjs'
import { isTemplate, parse, write } from './tlv.mjs'

const KEEP = new Set(['00', '01', '52', '53', '54', '58', '60', '38.01.00', '38.02'])
// Numbers that identify a person or account; their letters are kept because they carry the structure (prefixes).
const DIGITS = new Set(['38.01.01', '26.01', '62.01', '62.02', '62.04', '62.05', '62.07', '80'])

function rule(path) {
  if (KEEP.has(path)) return 'keep'
  // Sub-tag 00 of a template 26–51 is the scheme GUID or reverse-domain identifier.
  if (/^(2[6-9]|3\d|4\d|5[01])\.00$/.test(path)) return 'keep'
  if (DIGITS.has(path)) return 'digits'
  return 'all'
}

function fakeDigit(position) {
  return String((position * 7 + 3) % 10)
}

// Prefixes that identify a wallet format (vietnam-qr-pay README; see conformance/schemes/vietqr-wallets.md). Kept
// verbatim, digits included. Any other digit is masked: an unknown prefix loses its digits, which is the safe default.
const KNOWN_PREFIXES = ['MOMOW2W', 'PSP', '99ZP', '99MM']

function maskValue(value, how) {
  const prefix = how === 'digits' ? (KNOWN_PREFIXES.find((p) => value.startsWith(p)) ?? '') : ''
  return prefix + maskRest([...value].slice(prefix.length).join(''), how, prefix.length)
}

function maskRest(value, how, offset) {
  return [...value]
    .map((ch, i) => {
      if (/\d/.test(ch)) return fakeDigit(i + offset)
      if (how === 'all' && /\p{L}/u.test(ch)) return 'X'
      return ch
    })
    .join('')
}

function maskFields(fields, prefix, masked) {
  return fields.map(({ tag, value }) => {
    const path = prefix ? `${prefix}.${tag}` : tag
    if (isTemplate(path)) {
      let inner
      try {
        inner = parse(value)
      } catch {
        inner = undefined // not TLV after all (e.g. an undocumented wallet template): mask the whole value below
      }
      if (inner) return { tag, value: write(maskFields(inner, path, masked)) }
    }
    const how = rule(path)
    if (how === 'keep') return { tag, value }
    masked.push(path)
    return { tag, value: maskValue(value, how) }
  })
}

/** @returns {{ payload: string, masked: string[] }} masked lists the paths a masking rule was applied to, never values. */
export function maskPayload(payload) {
  const fields = parse(payload).filter((f) => f.tag !== '63')
  const masked = []
  const body = write(maskFields(fields, '', masked)) + '6304'
  return { payload: body + crc16(body), masked }
}
