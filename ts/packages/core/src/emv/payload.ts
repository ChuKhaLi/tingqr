import { TingQrError, type Result, type Warning } from '../errors.js'
import { crc16 } from './crc.js'
import { assertUniqueTags, encodeFields, parseTlv, type TlvField, type TlvNode } from './tlv.js'

export type ParseMode = 'strict' | 'lenient'

export interface EmvPayload {
  fields: TlvNode[]
  crc: string
  /** The payload after surrounding whitespace was removed. */
  raw: string
}

/** Encode `fields` (without tag 63), then append `6304` and the CRC over everything before it. */
export function buildPayload(fields: readonly TlvField[]): string {
  const body = encodeFields(fields) + '6304'
  return body + crc16(body)
}

export function getField(p: EmvPayload, tag: string): TlvNode | undefined {
  return p.fields.find((f) => f.tag === tag)
}

/** ASCII whitespace plus a UTF-8 BOM (files saved by Windows tools) and no-break spaces. */
const EDGE_WHITESPACE = /^[ \t\r\n﻿ ]+|[ \t\r\n﻿ ]+$/g

/**
 * Parse an EMV merchant-presented payload and verify its CRC. Scheme-agnostic: required tags and
 * strict/lenient rules belong to each scheme. Never throws.
 */
export function parsePayload(input: string): Result<EmvPayload> {
  const warnings: Warning[] = []
  const raw = input.replace(EDGE_WHITESPACE, '')
  if (raw !== input) {
    warnings.push({ code: 'TRIMMED_WHITESPACE', message: 'Whitespace around the payload was removed.' })
  }

  let fields: TlvNode[]
  try {
    fields = parseTlv(raw)
  } catch (e) {
    if (e instanceof TingQrError) return { ok: false, error: e }
    throw e
  }

  const last = fields[fields.length - 1]
  if (!last || last.tag !== '63' || last.value.length !== 4) {
    return {
      ok: false,
      error: new TingQrError('CRC_MISSING', 'The payload must end with tag 63 holding a 4-digit CRC.', '63'),
    }
  }

  const expected = crc16(raw.slice(0, raw.length - 4))
  if (last.value.toUpperCase() !== expected) {
    return {
      ok: false,
      error: new TingQrError('CRC_MISMATCH', `CRC is ${last.value}, expected ${expected}.`, '63'),
    }
  }
  try {
    assertUniqueTags(fields)
  } catch (e) {
    if (e instanceof TingQrError) return { ok: false, error: e }
    throw e
  }
  if (last.value !== last.value.toUpperCase()) {
    warnings.push({ code: 'LOWERCASE_CRC', message: 'The CRC is written in lowercase hex.', tag: '63' })
  }

  return { ok: true, value: { fields, crc: last.value.toUpperCase(), raw }, warnings }
}
