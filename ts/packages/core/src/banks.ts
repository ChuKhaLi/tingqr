// @tingqr/core/banks: Vietnamese banks and the apps that open by URL scheme. Data: conformance/banks/.
import { BANK_APP_DATA, BANK_DATA } from './banks/data.js'
import { appsOf, deepFreeze, findBankIn } from './banks/lookup.js'
import type { Bank, BankApp } from './banks/types.js'

export type { AppPlatform, Bank, BankApp, BankAppAndroid } from './banks/types.js'

/** Every bank of api.vietqr.io/v2/banks, sorted by BIN. */
export const BANKS: readonly Bank[] = deepFreeze(BANK_DATA)

/** Every app tingqr can open, sorted by id. */
export const BANK_APPS: readonly BankApp[] = deepFreeze(BANK_APP_DATA)

/** By 6-digit BIN, or by vietqr.io code or short name ignoring case. `undefined` when nothing matches. */
export function findBank(binOrCode: string): Bank | undefined {
  return findBankIn(BANKS, binOrCode)
}

/** By app id (exact, lower case), e.g. `'mb'`, `'tcb'`. */
export function findBankApp(id: string): BankApp | undefined {
  return BANK_APPS.find((a) => a.id === id)
}

/** Every app of the bank with this BIN; `[]` when it has none. */
export function appsForBank(bin: string): BankApp[] {
  return appsOf(BANK_APPS, bin)
}
