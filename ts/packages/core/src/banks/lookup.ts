import { TingQrError } from '../errors.js'
import type { Bank, BankApp } from './types.js'

const BIN = /^\d{6}$/

function needString(fn: string, value: unknown): void {
  if (typeof value !== 'string') throw new TingQrError('INVALID_VALUE', `${fn} needs a string, got ${typeof value}`)
}

// Codes and short names are ASCII; folding A-Z only keeps the lookup the same in every language.
const lower = (s: string): string => s.replace(/[A-Z]/g, (c) => c.toLowerCase())

/**
 * A 6-digit BIN matches `bin` exactly. Anything else matches `code`, then `shortName`, ignoring the case of ASCII
 * letters only; no trimming, so `' MB'` finds nothing. A code beats another bank's short name that spells the same.
 * A non-string (e.g. a BIN kept as a number in plain JavaScript) is a programming error and throws `INVALID_VALUE`.
 */
export function findBankIn(banks: readonly Bank[], binOrCode: string): Bank | undefined {
  needString('findBank', binOrCode)
  if (BIN.test(binOrCode)) return banks.find((b) => b.bin === binOrCode)
  const key = lower(binOrCode)
  return banks.find((b) => lower(b.code) === key) ?? banks.find((b) => lower(b.shortName) === key)
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

/** A non-string `bin` throws `INVALID_VALUE`, so `null` never matches an app without a BIN. */
export function appsOf(apps: readonly BankApp[], bin: string): BankApp[] {
  needString('appsForBank', bin)
  return apps.filter((a) => a.bin === bin)
}
