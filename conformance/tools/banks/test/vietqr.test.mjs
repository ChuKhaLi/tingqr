import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyOverrides, parseBanksResponse } from '../lib/vietqr.mjs'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/vietqr-banks.json', import.meta.url), 'utf8'))

test('parseBanksResponse maps the vietqr.io fields and sorts by bin', () => {
  const banks = parseBanksResponse(fixture)
  assert.deepEqual(
    banks.map((b) => b.bin),
    ['970406', '970407', '970415', '970422', '970436', '970441'],
  )
  assert.deepEqual(banks.find((b) => b.bin === '970415'), {
    bin: '970415',
    code: 'ICB',
    shortName: 'VietinBank',
    name: 'Ngân hàng TMCP Công thương Việt Nam',
    swift: 'ICBVVNVX',
    logoUrl: 'https://cdn.vietqr.io/img/ICB.png',
  })
})

test('parseBanksResponse turns an empty swift_code into null', () => {
  const banks = parseBanksResponse({
    code: '00',
    data: [{ bin: '970400', code: 'X', shortName: 'X', name: 'X bank', logo: 'https://cdn.vietqr.io/img/X.png', swift_code: null }],
  })
  assert.equal(banks[0].swift, null)
})

test('parseBanksResponse rejects a response without data', () => {
  assert.throws(() => parseBanksResponse({ code: '00', desc: 'x' }), /data/)
})

test('parseBanksResponse rejects an empty list', () => {
  assert.throws(() => parseBanksResponse({ code: '00', data: [] }), /empty/)
})

test('parseBanksResponse rejects a bank with a malformed bin', () => {
  const bad = structuredClone(fixture)
  bad.data[0].bin = '97042'
  assert.throws(() => parseBanksResponse(bad), /bin/)
})

test('parseBanksResponse rejects a list with the same bin twice', () => {
  const dup = structuredClone(fixture)
  dup.data.push({ ...dup.data[0], code: 'OTHER' })
  assert.throws(() => parseBanksResponse(dup), new RegExp(`${dup.data[0].bin}.*twice`))
})

test('applyOverrides replaces the named field of the named bank', () => {
  const banks = parseBanksResponse(fixture)
  const out = applyOverrides(banks, [{ bin: '970422', field: 'shortName', value: 'MB Bank', reason: 'r', source: 's' }])
  assert.equal(out.find((b) => b.bin === '970422').shortName, 'MB Bank')
  assert.equal(banks.find((b) => b.bin === '970422').shortName, 'MBBank')
})

test('applyOverrides rejects an override for an unknown bin', () => {
  const banks = parseBanksResponse(fixture)
  assert.throws(() => applyOverrides(banks, [{ bin: '999999', field: 'name', value: 'x', reason: 'r', source: 's' }]), /999999/)
})
