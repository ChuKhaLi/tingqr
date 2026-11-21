// Runs on the built dist/ (`pnpm test` at ts/ builds first).
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('render/canvas is a separate, ESM-only subpath', () => {
  // An app directory whose node_modules/@tingqr/render links to this package, so esbuild resolves through the
  // package.json exports map exactly as for an installed copy.
  const app = mkdtempSync(join(tmpdir(), 'tingqr-render-app-'))
  mkdirSync(join(app, 'node_modules', '@tingqr'), { recursive: true })
  symlinkSync(PKG, join(app, 'node_modules', '@tingqr', 'render'), 'junction')
  afterAll(() => rmSync(app, { recursive: true, force: true }))
  const bundle = async (code: string) =>
    (
      await build({
        stdin: { contents: code, resolveDir: app, loader: 'js' },
        bundle: true,
        write: false,
        format: 'esm',
        minify: true,
      })
    ).outputFiles[0]!.text
  const count = (js: string, word: string) => js.split(word).length - 1

  test('importing toSvg from the root bundles no canvas code', async () => {
    const js = await bundle("import { toSvg } from '@tingqr/render'; console.log(toSvg('x'))")
    expect(js).not.toContain('getContext')
    expect(count(js, 'encodeSegments')).toBeGreaterThan(0)
  })

  test('importing toPngBlob bundles the canvas code and one copy of the encoder', async () => {
    const js = await bundle("import { toPngBlob } from '@tingqr/render/canvas'; console.log(toPngBlob)")
    expect(js).toContain('getContext')
    const plain = await bundle("import { toMatrix } from '@tingqr/render'; console.log(toMatrix)")
    expect(count(js, 'encodeSegments')).toBe(count(plain, 'encodeSegments'))
  })

  test('both entries in one app share the encoder', async () => {
    const js = await bundle(
      "import { toSvg } from '@tingqr/render'; import { toPngBlob } from '@tingqr/render/canvas'; console.log(toSvg, toPngBlob)",
    )
    const plain = await bundle("import { toMatrix } from '@tingqr/render'; console.log(toMatrix)")
    expect(count(js, 'encodeSegments')).toBe(count(plain, 'encodeSegments'))
  })

  test('there is no CJS build of the canvas subpath', () => {
    expect(existsSync(join(PKG, 'dist', 'canvas.js'))).toBe(true)
    expect(existsSync(join(PKG, 'dist', 'canvas.cjs'))).toBe(false)
    expect(existsSync(join(PKG, 'dist', 'canvas.d.cts'))).toBe(false)
  })
})
