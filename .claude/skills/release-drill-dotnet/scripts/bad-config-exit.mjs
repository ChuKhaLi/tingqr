// How the drill judges a web app started with a wrong bank (check 5 of drill.mjs). Pure, so it has unit tests
// (dotnet/scripts/test/drill-bad-config.test.mjs).

/**
 * The app must stop by itself because of the configuration: a non-zero exit code (Windows: 0xE0434352 for an unhandled
 * CLR exception) or a signal (Linux/macOS: an unhandled .NET exception aborts the process, SIGABRT), and its output must
 * name the TingQR configuration error, so an unrelated crash does not pass.
 * @param {{ timedOut: boolean, code: number | null, signal: string | null, output: string }} r
 *   `timedOut`: the app was still running at the deadline (and the drill then killed it).
 * @returns {{ ok: boolean, reason: string }}
 */
export function judgeBadConfigExit({ timedOut, code, signal, output }) {
  if (timedOut) return { ok: false, reason: 'the app was still running at the deadline: a wrong bank did not stop it' }
  if (code === 0) return { ok: false, reason: 'the app exited with code 0: a wrong bank did not stop it' }
  if (code === null && !signal) return { ok: false, reason: 'the app exited with neither a code nor a signal' }
  const how = code !== null ? `exit code ${code}` : `signal ${signal}`
  if (!/TingQrException|INVALID_VALUE|InvalidValue/.test(output)) {
    return { ok: false, reason: `the app stopped (${how}) but its output names no TingQrException or INVALID_VALUE:\n${output}` }
  }
  return { ok: true, reason: `stopped at startup (${how}) with a TingQR configuration error` }
}
