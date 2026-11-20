import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { BANKS, BANK_APPS, appsForBank, findBank, findBankApp } from '../src/banks.js'
import { findBankIn } from '../src/banks/lookup.js'
import type { Bank } from '../src/banks.js'

const json = (name: string): any => JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'banks', name), 'utf8'))
const MB = json('banks.json').banks.find((b: Bank) => b.bin === '970422')

test('BANKS and BANK_APPS carry every entry of conformance/banks/', () => {
  expect(BANKS.length).toBe(json('banks.json').banks.length)
  expect(BANK_APPS.map((a) => a.id)).toEqual(json('bank-apps.json').apps.map((a: { id: string }) => a.id))
})

test('findBank by BIN', () => {
  expect(findBank('970422')).toEqual(MB)
})

test('findBank by code or short name ignores case', () => {
  expect(findBank('MB')).toEqual(MB)
  expect(findBank('mb')).toEqual(MB)
  expect(findBank(MB.shortName.toUpperCase())).toEqual(MB)
  expect(findBank(MB.shortName.toLowerCase())).toEqual(MB)
})

test('findBank does not trim and needs a whole BIN', () => {
  expect(findBank(' MB')).toBeUndefined()
  expect(findBank('MB ')).toBeUndefined()
  expect(findBank('')).toBeUndefined()
  expect(findBank('97042')).toBeUndefined()
  expect(findBank('9704220')).toBeUndefined()
})

test('a code wins over another bank short name that spells the same', () => {
  const list: Bank[] = [
    { bin: '900001', code: 'AAA', shortName: 'BBB', name: 'first', swift: null, logoUrl: 'https://x/a.png' },
    { bin: '900002', code: 'BBB', shortName: 'CCC', name: 'second', swift: null, logoUrl: 'https://x/b.png' },
  ]
  expect(findBankIn(list, 'bbb')?.bin).toBe('900002')
  expect(findBankIn(list, 'ccc')?.bin).toBe('900002')
  expect(findBankIn(list, '900001')?.bin).toBe('900001')
  expect(findBankIn(list, 'zzz')).toBeUndefined()
})

test('findBankApp returns the app with its Android host', () => {
  expect(findBankApp('tcb')?.android).toEqual({ package: 'vn.com.techcombank.bb.app', scheme: 'tcb', host: 'applink' })
  expect(findBankApp('nope')).toBeUndefined()
  expect(findBankApp('TCB')).toBeUndefined()
})

test('an iOS-only app has no android entry', () => {
  const momo = findBankApp('momo')
  expect(momo?.ios).toEqual({ scheme: 'momo' })
  expect(momo && 'android' in momo).toBe(false)
})

test('appsForBank returns every app of a BIN, and [] for a bank without apps', () => {
  expect(appsForBank('970416').map((a) => a.id).sort()).toEqual(['acb', 'acb-biz'])
  expect(appsForBank('970422').map((a) => a.id)).toEqual(['mb'])
  expect(appsForBank('999999')).toEqual([])
})

test('BankApp exposes only the fields the API promises', () => {
  expect(Object.keys(findBankApp('mb')!).sort()).toEqual(
    ['android', 'bin', 'confidence', 'id', 'ios', 'name', 'vietqrAutofill'].sort(),
  )
})

test('the lists and their entries are frozen', () => {
  expect(Object.isFrozen(BANKS)).toBe(true)
  expect(Object.isFrozen(BANK_APPS)).toBe(true)
  expect(BANKS.every((b) => Object.isFrozen(b))).toBe(true)
  expect(BANK_APPS.every((a) => Object.isFrozen(a) && (!a.android || Object.isFrozen(a.android)) && (!a.ios || Object.isFrozen(a.ios)))).toBe(true)
})
