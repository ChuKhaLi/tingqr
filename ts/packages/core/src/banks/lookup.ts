import { TingQrError } from '../errors.js'
import type { Bank, BankApp } from './types.js'

const BIN = /^\d{6}$/

/**
 * A 6-digit BIN matches `bin` exactly. Anything else matches `code`, then `shortName`, ignoring case; no trimming,
 * so `' MB'` finds nothing. A code beats another bank's short name that spells the same. A non-string (e.g. a BIN
 * kept as a number in plain JavaScript) is a programming error and throws `INVALID_VALUE`.
 */
export function findBankIn(banks: readonly Bank[], binOrCode: string): Bank | undefined {
  if (typeof binOrCode !== 'string') {
    throw new TingQrError('INVALID_VALUE', `findBank needs a string (BIN or code), got ${typeof binOrCode}`)
  }
  if (BIN.test(binOrCode)) return banks.find((b) => b.bin === binOrCode)
  const key = binOrCode.toLowerCase()
  return banks.find((b) => b.code.toLowerCase() === key) ?? banks.find((b) => b.shortName.toLowerCase() === key)
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

export function appsOf(apps: readonly BankApp[], bin: string): BankApp[] {
  return apps.filter((a) => a.bin === bin)
}
