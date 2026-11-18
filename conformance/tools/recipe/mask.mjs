// Replace sensitive values in a real QR payload while keeping its structure: tag order, lengths, character classes,
// scheme identifiers, BINs, service codes and known wallet prefixes (PSP, MOMOW2W, 99ZP, 99MM). The CRC is recomputed.
//
// Fake digits: for each distance k from the end of a value, a secret permutation P_k of 0–9 (derived with HMAC-SHA256
// from a seed) maps digit d to P_k(d). Equal digits at equal distance from the end stay equal across fields, unequal
// ones stay unequal — so relations such as "62.05 ends with the account's last 8 digits" survive — but, unlike a shift
// cipher, differences between digits are not preserved, so knowing one field does not reveal another. extract.mjs
// uses a fresh random seed per run and never stores it; tests pass a fixed seed.
import { createHmac, randomBytes } from 'node:crypto'
import { crc16 } from './crc.mjs'
import { isTemplate, parse, write } from './tlv.mjs'

const KEEP = new Set(['00', '01', '52', '53', '54', '58', '60', '38.01.00', '38.02', '64.00'])
// Identifiers of a person or account: masked, except a known wallet prefix or wallet shape.
const DIGITS = new Set(['38.01.01', '26.01', '62.01', '62.02', '62.04', '62.05', '62.07', '80'])

// Prefixes that identify a wallet format (vietnam-qr-pay README; conformance/schemes/vietqr-wallets.md).
const KNOWN_PREFIXES = ['MOMOW2W', 'PSP', '99ZP', '99MM']
// Whole-value shapes whose letters are structural (ZaloPay / old MoMo account numbers): letters kept, digits masked.
const KNOWN_SHAPES = [/^99(ZP|MM)\d+M\d+$/]

// A scheme identifier in sub-tag 00 of a template: an AID (hex) or a reverse-domain name.
const SCHEME_ID = [/^[A-F0-9]{10,32}$/i, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i]

function rule(path, value) {
  if (KEEP.has(path)) return 'keep'
  if (/^(2[6-9]|3\d|4\d|5[01])\.00$/.test(path)) return SCHEME_ID.some((r) => r.test(value)) ? 'keep' : 'all'
  if (DIGITS.has(path)) return 'id'
  return 'all'
}

/** digitMapper(seed)(digit, distanceFromEnd) → fake digit; a keyed permutation of 0–9 per distance. Exported for tests. */
export function digitMapper(seed) {
  const perms = new Map()
  return (digit, distance) => {
    let perm = perms.get(distance)
    if (!perm) {
      const bytes = createHmac('sha256', String(seed)).update(`digits:${distance}`).digest()
      perm = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
      for (let i = 9; i > 0; i--) {
        const j = bytes[9 - i] % (i + 1)
        ;[perm[i], perm[j]] = [perm[j], perm[i]]
      }
      perms.set(distance, perm)
    }
    return perm[Number(digit)]
  }
}

function maskValue(value, how, key) {
  const chars = [...value]
  const shaped = how === 'id' && KNOWN_SHAPES.some((r) => r.test(value))
  const prefix = how === 'id' ? (KNOWN_PREFIXES.find((p) => value.startsWith(p)) ?? '') : ''
  return chars
    .map((ch, i) => {
      if (i < prefix.length) return ch
      if (/\d/.test(ch)) return key(ch, chars.length - 1 - i)
      if (/\p{L}/u.test(ch) && !shaped) return /\p{Ll}/u.test(ch) ? 'x' : 'X'
      // In free text, spaces and combining marks would reveal word lengths and diacritics of names.
      if (how === 'all' && /[\s\p{M}]/u.test(ch)) return 'X'
      return ch
    })
    .join('')
}

function maskFields(fields, prefix, masked, key) {
  return fields.map(({ tag, value }) => {
    const path = prefix ? `${prefix}.${tag}` : tag
    if (isTemplate(path)) {
      let inner
      try {
        inner = parse(value)
      } catch {
        inner = undefined // not TLV after all (e.g. an undocumented wallet template): mask the whole value below
      }
      if (inner) return { tag, value: write(maskFields(inner, path, masked, key)) }
    }
    const how = rule(path, value)
    if (how === 'keep') return { tag, value }
    masked.push(path)
    return { tag, value: maskValue(value, how, key) }
  })
}

/**
 * @param {string} payload
 * @param {{ seed?: string }} [options] fixed seed for tests; default is a fresh random seed (never stored)
 * @returns {{ payload: string, masked: string[] }} masked lists the paths a masking rule was applied to, never values.
 */
export function maskPayload(payload, options = {}) {
  const key = digitMapper(options.seed ?? randomBytes(32).toString('hex'))
  const fields = parse(payload).filter((f) => f.tag !== '63')
  const masked = []
  const body = write(maskFields(fields, '', masked, key)) + '6304'
  return { payload: body + crc16(body), masked }
}
