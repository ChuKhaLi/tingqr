import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { toSvg } from '../src/index.js'
// @ts-expect-error -- plain .mjs script without type declarations
import { loadEntries, renderSheet } from '../scripts/scan-sheet.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'scan-sheet.mjs')
const REAL_ACCOUNT = '9999888877'

const fakeCount = readdirSync(join(CONFORMANCE_DIR, 'vectors', 'vietqr'))
  .map((n) => JSON.parse(readFileSync(join(CONFORMANCE_DIR, 'vectors', 'vietqr', n), 'utf8')))
  .filter((v) => v.kind === 'valid' && v.input !== undefined).length

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'tingqr-scan-'))
})
afterEach(() => rmSync(tmp, { recursive: true, force: true }))

function realInputs(): string {
  const file = join(tmp, 'scan-inputs.json')
  writeFileSync(file, JSON.stringify([{ id: 'own-mb', input: { bankBin: '970422', accountNumber: REAL_ACCOUNT, amount: 2000 } }]))
  return file
}

test('without a real-inputs file there are only the fake VietQR vectors', () => {
  const entries = loadEntries({ conformanceDir: CONFORMANCE_DIR, scanInputsPath: join(tmp, 'missing.json') })
  expect(fakeCount).toBeGreaterThan(0)
  expect(entries).toHaveLength(fakeCount)
  expect(entries.every((e: { real: boolean }) => e.real === false)).toBe(true)
})

test('a real-inputs file adds real entries with what the app should show', () => {
  const entries = loadEntries({ conformanceDir: CONFORMANCE_DIR, scanInputsPath: realInputs() })
  const own = entries.find((e: { id: string }) => e.id === 'own-mb')
  expect(own).toMatchObject({ real: true, expect: { bankBin: '970422', accountNumber: REAL_ACCOUNT, amount: '2000' } })
  expect(own.payload).toMatch(/^000201/)
})

test('a malformed real-inputs file is an error, not silently skipped', () => {
  const file = join(tmp, 'bad.json')
  writeFileSync(file, '{ not json')
  expect(() => loadEntries({ conformanceDir: CONFORMANCE_DIR, scanInputsPath: file })).toThrow()
})

test('the sheet has the safety notice, two codes per entry, fake labels and 40mm codes', () => {
  const entries = loadEntries({ conformanceDir: CONFORMANCE_DIR, scanInputsPath: realInputs() })
  const html = renderSheet(entries, { toSvg })
  expect(html).toContain('Dừng ở màn hình xác nhận')
  expect(html.match(/<svg /g)).toHaveLength(entries.length * 2)
  expect(html.match(/Tài khoản giả/g)).toHaveLength(fakeCount)
  expect(html).toContain('width="40mm"')
  expect(html).toContain('<image href="data:image/svg+xml')
  expect(html).toContain('@media print')
})

test('the script writes the HTML and never prints a payload or account number', () => {
  const out = join(tmp, 'out')
  const stdout = execFileSync(process.execPath, [SCRIPT], {
    env: { ...process.env, TINGQR_SCAN_INPUTS: realInputs(), TINGQR_SCAN_SHEET_OUT: out },
    encoding: 'utf8',
  })
  expect(stdout).not.toContain(REAL_ACCOUNT)
  expect(stdout).not.toContain('000201')
  expect(stdout).toContain(String(fakeCount + 1))
  expect(existsSync(join(out, 'index.html'))).toBe(true)
  expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain(REAL_ACCOUNT)
})

test('an invalid real entry is reported by id and error code only, never with its account number', () => {
  const file = join(tmp, 'bad-account.json')
  writeFileSync(file, JSON.stringify([{ id: 'own-bad', input: { bankBin: '970422', accountNumber: '99-99888877' } }]))
  let message = ''
  try {
    loadEntries({ conformanceDir: CONFORMANCE_DIR, scanInputsPath: file })
  } catch (e) {
    message = (e as Error).message
  }
  expect(message).toContain('own-bad')
  expect(message).toContain('INVALID_VALUE')
  expect(message).not.toContain('99888877')
})
