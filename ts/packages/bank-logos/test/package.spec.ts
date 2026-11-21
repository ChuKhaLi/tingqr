// @tingqr/bank-logos as built (dist/, files/, LOGOS-NOTICE.md) against conformance/banks/logos/. Run after `pnpm build`.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { toSvg } from '@tingqr/render'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFORMANCE = (() => {
  let dir = PKG
  while (!existsSync(join(dir, 'conformance', 'errors.json'))) dir = dirname(dir)
  return join(dir, 'conformance')
})()
const LOGOS = join(CONFORMANCE, 'banks', 'logos')
type Entry = { file: string; kind: 'logo' | 'icon'; key: string; sourceUrl: string; pageUrl: string | null; license: string }
const manifest: Entry[] = JSON.parse(readFileSync(join(LOGOS, 'manifest.json'), 'utf8')).files
const MIME: Record<string, string> = { svg: 'image/svg+xml', webp: 'image/webp' }
const subpath = (e: Entry) => `${e.kind}/${e.key}`
const require = createRequire(join(PKG, 'package.json'))

test.each(manifest.map((e) => [e.file, e] as const))('%s: the ESM module is a data URI of the exact bytes', async (_f, e) => {
  const uri: string = (await import(pathToFileURL(join(PKG, 'dist', `${subpath(e)}.js`)).href)).default
  const [head, b64] = uri.split(',') as [string, string]
  expect(head).toBe(`data:${MIME[e.file.split('.').pop()!]};base64`)
  expect(Buffer.from(b64, 'base64').equals(readFileSync(join(LOGOS, e.file)))).toBe(true)
})

test('the CJS module of each image is the absolute path of the original file shipped in the package', () => {
  for (const e of manifest) {
    const path: string = require(`@tingqr/bank-logos/${subpath(e)}`)
    expect(path, e.file).toBe(join(PKG, 'files', e.file))
    expect(readFileSync(path).equals(readFileSync(join(LOGOS, e.file))), e.file).toBe(true)
  }
})

test('the package exports map resolves an ESM image by name (Node self-reference)', () => {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', "import x from '@tingqr/bank-logos/icon/mb'; console.log(x.slice(0, 22))"], {
    cwd: PKG,
    encoding: 'utf8',
  })
  expect(out.trim()).toBe('data:image/webp;base64')
})

test('LOGO_BINS and ICON_IDS list the manifest, and point into banks.json and bank-apps.json', async () => {
  const index = await import(pathToFileURL(join(PKG, 'dist', 'index.js')).href)
  expect([...index.LOGO_BINS]).toEqual(manifest.filter((e) => e.kind === 'logo').map((e) => e.key).sort())
  expect([...index.ICON_IDS]).toEqual(manifest.filter((e) => e.kind === 'icon').map((e) => e.key).sort())
  expect(Object.isFrozen(index.LOGO_BINS)).toBe(true)
  const bins = new Set(JSON.parse(readFileSync(join(CONFORMANCE, 'banks', 'banks.json'), 'utf8')).banks.map((b: { bin: string }) => b.bin))
  const ids = new Set(JSON.parse(readFileSync(join(CONFORMANCE, 'banks', 'bank-apps.json'), 'utf8')).apps.map((a: { id: string }) => a.id))
  expect(index.LOGO_BINS.filter((b: string) => !bins.has(b))).toEqual([])
  expect(index.ICON_IDS.filter((i: string) => !ids.has(i))).toEqual([])
  expect(require('@tingqr/bank-logos').ICON_IDS).toEqual(index.ICON_IDS)
})

test('LOGOS-NOTICE.md is generated from the manifest and says the images are not MIT', async () => {
  const { renderNotice } = await import(pathToFileURL(join(PKG, 'scripts', 'gen.mjs')).href)
  const notice = readFileSync(join(PKG, 'LOGOS-NOTICE.md'), 'utf8')
  expect(notice).toBe(renderNotice(manifest))
  expect(notice).toMatch(/không.*MIT/i)
  expect(notice).toContain('NAPAS')
  for (const e of manifest) expect(notice).toContain(e.sourceUrl)
})

describe('tree-shaking: a bundle carries only the images it imports', () => {
  // An app directory whose node_modules/@tingqr/bank-logos links to this package, so esbuild resolves through the
  // package.json exports map exactly as for an installed copy.
  const app = mkdtempSync(join(tmpdir(), 'tingqr-bank-logos-app-'))
  mkdirSync(join(app, 'node_modules', '@tingqr'), { recursive: true })
  symlinkSync(PKG, join(app, 'node_modules', '@tingqr', 'bank-logos'), 'junction')
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
  const dataUris = (js: string) => js.match(/data:image\/[a-z+]+;base64,/g) ?? []

  test('one static import bundles exactly one image', async () => {
    const js = await bundle("import mb from '@tingqr/bank-logos/icon/mb'; console.log(mb)")
    expect(dataUris(js)).toHaveLength(1)
    expect(js.length).toBeLessThan(readFileSync(join(LOGOS, 'icon', 'mb.webp')).length * 1.4 + 2048)
  })

  test('two static imports bundle exactly two images', async () => {
    const js = await bundle("import a from '@tingqr/bank-logos/icon/mb'; import b from '@tingqr/bank-logos/logo/970418'; console.log(a, b)")
    expect(dataUris(js)).toHaveLength(2)
  })

  test('the package root (LOGO_BINS, ICON_IDS) bundles no image', async () => {
    const js = await bundle("import { LOGO_BINS, ICON_IDS } from '@tingqr/bank-logos'; console.log(LOGO_BINS, ICON_IDS)")
    expect(dataUris(js)).toHaveLength(0)
    expect(js.length).toBeLessThan(4096)
  })
})

test('an icon works as the centre logo of a QR from @tingqr/render (technical check only; not scanned)', async () => {
  const mb: string = (await import(pathToFileURL(join(PKG, 'dist', 'icon', 'mb.js')).href)).default
  const payload = '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'
  const svg = toSvg(payload, { logo: { href: mb } })
  expect(svg).toContain(mb)
})
