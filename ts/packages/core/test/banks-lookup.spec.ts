import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { TingQrError } from '../src/index.js'
import { BANKS, BANK_APPS, appsForBank, findBank, findBankApp } from '../src/banks.js'
import { appsOf, findBankIn } from '../src/banks/lookup.js'
import type { Bank, BankApp } from '../src/banks.js'

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

test.each([970422, null, undefined, { bin: '970422' }])('findBank(%j) throws INVALID_VALUE, not a TypeError or a silent miss', (q) => {
  let thrown: unknown
  try {
    findBank(q as never)
  } catch (e) {
    thrown = e
  }
  expect(thrown).toBeInstanceOf(TingQrError)
  expect((thrown as TingQrError).code).toBe('INVALID_VALUE')
  expect((thrown as TingQrError).message).toMatch(/^findBank needs a string/)
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

test.each([null, undefined, 42])('appsForBank(%j) throws INVALID_VALUE, not a silent match on apps without a BIN', (bin) => {
  let thrown: unknown
  try {
    appsForBank(bin as never)
  } catch (e) {
    thrown = e
  }
  expect(thrown).toBeInstanceOf(TingQrError)
  expect((thrown as TingQrError).code).toBe('INVALID_VALUE')
  expect((thrown as TingQrError).message).toMatch(/^appsForBank needs a string/)
})

test('appsOf never matches an app without a BIN, and throws for a non-string query', () => {
  const apps = [
    { id: 'nobin', bin: null },
    { id: 'one', bin: '900001' },
  ] as unknown as BankApp[]
  expect(() => appsOf(apps, null as never)).toThrow(TingQrError)
  expect(appsOf(apps, '900001').map((a) => a.id)).toEqual(['one'])
  expect(appsOf(apps, '900002')).toEqual([])
})

// conformance/vectors/bank-lookup/non-ascii-dotted-i.json: only ASCII letters fold, in the query and in the data.
test('findBank folds ASCII letters only', () => {
  expect(findBank('V\u0130B')).toBeUndefined()
  const list: Bank[] = [{ bin: '900001', code: 'K\u00C9', shortName: 'VIB', name: 'accented code', swift: null, logoUrl: 'https://x/a.png' }]
  expect(findBankIn(list, 'vib')?.bin).toBe('900001')
  expect(findBankIn(list, 'k\u00C9')?.bin).toBe('900001')
  expect(findBankIn(list, 'k\u00E9')).toBeUndefined()
  expect(findBankIn(list, '\u212A\u00C9')).toBeUndefined()
  expect(findBankIn(list, 'v\u0131b')).toBeUndefined()
})

test('ASCII folding covers A to Z and nothing next to them', () => {
  const list: Bank[] = [{ bin: '900001', code: 'AZ', shortName: '@[', name: 'edges', swift: null, logoUrl: 'https://x/a.png' }]
  expect(findBankIn(list, 'az')?.bin).toBe('900001')
  expect(findBankIn(list, '`{')).toBeUndefined()
  expect(findBankIn(list, '@[')?.bin).toBe('900001')
})
