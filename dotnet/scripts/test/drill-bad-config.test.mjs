// Tests for judgeBadConfigExit of the NuGet release drill (.claude/skills/release-drill-dotnet).
// Run: node --test dotnet/scripts/test/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeBadConfigExit } from '../../../.claude/skills/release-drill-dotnet/scripts/bad-config-exit.mjs'

const ERROR = "Unhandled exception. TingQR.TingQrException: Unknown bank 'NOT-A-BANK'."
const judge = (r) => judgeBadConfigExit({ timedOut: false, code: null, signal: null, output: ERROR, ...r })

test('code 0 fails', () => assert.equal(judge({ code: 0 }).ok, false))
test('code 1 with the TingQR error passes', () => assert.equal(judge({ code: 1 }).ok, true))
test('Windows unhandled CLR exception code passes', () => assert.equal(judge({ code: 3762504530 }).ok, true))
test('code null + SIGABRT (Linux unhandled exception) passes', () => assert.equal(judge({ signal: 'SIGABRT' }).ok, true))
test('still running at the deadline fails, whatever happened after the kill', () => {
  assert.equal(judge({ timedOut: true }).ok, false)
  assert.equal(judge({ timedOut: true, signal: 'SIGTERM' }).ok, false)
})
test('a crash without the TingQR error fails (code or signal)', () => {
  const other = 'Unhandled exception. System.IO.IOException: Failed to bind to address.'
  assert.equal(judge({ code: 1, output: other }).ok, false)
  assert.equal(judge({ signal: 'SIGABRT', output: other }).ok, false)
})
test('INVALID_VALUE in the output also counts as the configuration error', () => {
  assert.equal(judge({ code: 1, output: 'error: INVALID_VALUE' }).ok, true)
})
test('neither code nor signal fails', () => assert.equal(judge({}).ok, false))
