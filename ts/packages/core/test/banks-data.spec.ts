// conformance/banks/: the bank list, the bank apps and the Google Play checks are well-formed and consistent.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { CONFORMANCE_DIR } from './conformance-root.js'

const DIR = join(CONFORMANCE_DIR, 'banks')
const read = (name: string): any => JSON.parse(readFileSync(join(DIR, name), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false })
const compiled = new Map<string, ReturnType<typeof ajv.compile>>()
const validator = (name: string) => compiled.get(name) ?? compiled.set(name, ajv.compile(read(name))).get(name)!

const banks = read('banks.json')
const apps = read('bank-apps.json')
const play = read('play-checks.json')
const overrides = read('overrides.json')

const NOEL_TREE_IDS = ['mb', 'vcb', 'tcb', 'bidv', 'icb', 'acb', 'vpb', 'tpb', 'vba', 'cake', 'ocb', 'shb', 'hdb', 'vib', 'timo']

describe('schemas', () => {
  const cases: [string, unknown][] = [
    ['banks.schema.json', banks],
    ['bank-apps.schema.json', apps],
    ['play-checks.schema.json', play],
    ['overrides.schema.json', overrides],
    ['logos/manifest.schema.json', read('logos/manifest.json')],
  ]
  test.each(cases)('%s accepts the committed file', (schema, data) => {
    const validate = validator(schema)
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true)
  })

  test('bank-apps schema rejects an app without sources', () => {
    const bad = structuredClone(apps)
    delete bad.apps[0].sources
    expect(validator('bank-apps.schema.json')(bad)).toBe(false)
  })

  test('bank-apps schema rejects an unknown confidence', () => {
    const bad = structuredClone(apps)
    bad.apps[0].confidence = 'verified'
    expect(validator('bank-apps.schema.json')(bad)).toBe(false)
  })

  test('manifest schema rejects a PNG logo, a short BIN, and processed without sourceSha256', () => {
    const entry = read('logos/manifest.json').files.find((f: any) => f.processed)
    const check = (e: object) => validator('logos/manifest.schema.json')({ files: [e] })
    expect(check(entry)).toBe(true)
    expect(check({ ...entry, file: 'logo/970422.png' })).toBe(false)
    expect(check({ ...entry, file: 'logo/97042.webp' })).toBe(false)
    expect(check({ ...entry, file: 'logo/970422xwebp' })).toBe(false)
    const { sourceSha256: _s, ...noSource } = entry
    expect(check(noSource)).toBe(false)
  })

  test('banks schema rejects a 5-digit bin', () => {
    const bad = structuredClone(banks)
    bad.banks[0].bin = '97042'
    expect(validator('banks.schema.json')(bad)).toBe(false)
  })
})

describe('banks.json', () => {
  test('bins are unique', () => {
    const bins = banks.banks.map((b: any) => b.bin)
    expect(new Set(bins).size).toBe(bins.length)
  })

  test('codes are unique ignoring case', () => {
    const codes = banks.banks.map((b: any) => b.code.toLowerCase())
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('bank-apps.json', () => {
  const list: any[] = apps.apps
  const bins = new Set(banks.banks.map((b: any) => b.bin))

  test('apps are sorted by id, ordinal (the API keeps file order)', () => {
    const ids = list.map((a) => a.id)
    expect(ids).toEqual([...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)))
  })

  test('banks are sorted by bin, ordinal', () => {
    const bins = banks.banks.map((b: any) => b.bin)
    expect(bins).toEqual([...bins].sort())
  })

  test('ids are unique', () => {
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
  })

  test('every bin of an app is in banks.json', () => {
    expect(list.filter((a) => a.bin !== null && !bins.has(a.bin)).map((a) => a.id)).toEqual([])
  })

  test('every app opens on at least one platform', () => {
    expect(list.filter((a) => !a.ios && !a.android).map((a) => a.id)).toEqual([])
  })

  test('multi-source means two distinct independent sources that agree with the emitted scheme and package', () => {
    for (const a of list) {
      const agreeing = new Set(a.sources.filter((s: any) => s.independent && s.agrees).map((s: any) => s.name))
      expect([a.id, a.confidence]).toEqual([a.id, agreeing.size >= 2 ? 'multi-source' : 'single-source'])
    }
  })

  test('a source is listed once per app', () => {
    for (const a of list) {
      const names = a.sources.map((s: any) => s.name)
      expect([a.id, names.length]).toEqual([a.id, new Set(names).size])
    }
  })

  test('every source that disagrees with the emitted values is explained in disagreements', () => {
    for (const a of list) {
      const disagreeing = a.sources.filter((s: any) => !s.agrees).map((s: any) => s.name)
      for (const name of disagreeing) expect(a.disagreements.join(' '), `${a.id}: ${name}`).toContain(name)
    }
  })

  test('has every app id Noel tree already stores', () => {
    const ids = new Set(list.map((a) => a.id))
    expect(NOEL_TREE_IDS.filter((id) => !ids.has(id))).toEqual([])
  })

  test('every Android package has a Google Play check', () => {
    expect(list.filter((a) => a.android && !play[a.android.package]).map((a) => a.id)).toEqual([])
  })

  test('only MB Bank and MyVIB were opened on a real device, on Android, by the owner', () => {
    const verified = list.filter((a) => a.deviceVerified.length > 0)
    expect(verified.map((a) => a.id).sort()).toEqual(['mb', 'vib'])
    for (const a of verified) expect(a.deviceVerified.map((d: any) => d.os)).toEqual(['Android'])
  })
})
