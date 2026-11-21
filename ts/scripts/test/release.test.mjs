// Tests for set-version.mjs and check-release.mjs, run against a fake repository in a temp directory.
// Run: node --test ts/scripts/test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = ['core', 'render', 'bank-logos', 'hono', 'angular', 'nestjs']

function goodPackage(name, version) {
  return {
    name: `@tingqr/${name}`,
    version,
    license: name === 'bank-logos' ? 'SEE LICENSE IN LOGOS-NOTICE.md' : 'MIT',
    author: 'Chung Nguyen',
    repository: { type: 'git', url: 'git+https://github.com/ChuKhaLi/tingqr.git', directory: `ts/packages/${name}` },
    homepage: `https://github.com/ChuKhaLi/tingqr/tree/main/ts/packages/${name}#readme`,
    bugs: { url: 'https://github.com/ChuKhaLi/tingqr/issues' },
    keywords: ['qr'],
    publishConfig: { access: 'public' },
  }
}

/** A fake repo with six packages at `version` and core's VERSION constant. `edit(pkgs)` may change them first. */
function fakeRepo(version = '0.0.0', edit = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'tingqr-release-'))
  const pkgs = Object.fromEntries(PACKAGES.map((p) => [p, goodPackage(p, version)]))
  edit(pkgs)
  for (const p of PACKAGES) {
    mkdirSync(join(root, 'ts', 'packages', p, 'src'), { recursive: true })
    writeFileSync(join(root, 'ts', 'packages', p, 'package.json'), JSON.stringify(pkgs[p], null, 2) + '\n')
  }
  writeFileSync(join(root, 'ts', 'packages', 'core', 'src', 'index.ts'), `export const VERSION = '${version}'\nexport { x } from './x.js'\n`)
  return root
}

function run(script, args, root) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    env: { ...process.env, TINGQR_REPO_ROOT: root },
    encoding: 'utf8',
  })
  return { code: r.status, out: r.stdout + r.stderr }
}
const pkgOf = (root, p) => JSON.parse(readFileSync(join(root, 'ts', 'packages', p, 'package.json'), 'utf8'))

test('set-version writes the version to all six packages and to core VERSION', () => {
  const root = fakeRepo()
  try {
    assert.equal(run('set-version.mjs', ['1.2.3'], root).code, 0)
    for (const p of PACKAGES) assert.equal(pkgOf(root, p).version, '1.2.3', p)
    const index = readFileSync(join(root, 'ts', 'packages', 'core', 'src', 'index.ts'), 'utf8')
    assert.match(index, /^export const VERSION = '1\.2\.3'$/m)
    assert.match(index, /export \{ x \} from/) // the rest of the file is kept
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

for (const bad of ['1.2', '1.2.3-rc.1', 'v1.2.3', '01.2.3', '']) {
  test(`set-version refuses ${JSON.stringify(bad)} and writes nothing`, () => {
    const root = fakeRepo()
    try {
      assert.equal(run('set-version.mjs', [bad], root).code, 1)
      for (const p of PACKAGES) assert.equal(pkgOf(root, p).version, '0.0.0', p)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}

test('check-release passes on a good repo, with and without a matching tag', () => {
  const root = fakeRepo('1.2.3')
  try {
    assert.equal(run('check-release.mjs', [], root).code, 0)
    assert.equal(run('check-release.mjs', ['--tag', 'ts-v1.2.3'], root).code, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('check-release fails when a package has another version, naming it', () => {
  const root = fakeRepo('1.2.3', (pkgs) => (pkgs.hono.version = '1.2.4'))
  try {
    const r = run('check-release.mjs', [], root)
    assert.equal(r.code, 1)
    assert.match(r.out, /@tingqr\/hono/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('check-release fails when core VERSION differs from package.json', () => {
  const root = fakeRepo('1.2.3')
  try {
    writeFileSync(join(root, 'ts', 'packages', 'core', 'src', 'index.ts'), "export const VERSION = '1.0.0'\n")
    assert.equal(run('check-release.mjs', [], root).code, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('check-release fails when the tag does not match the version', () => {
  const root = fakeRepo('1.2.3')
  try {
    for (const tag of ['ts-v1.2.4', 'v1.2.3', 'ts-v1.2.3-rc.1']) assert.equal(run('check-release.mjs', ['--tag', tag], root).code, 1, tag)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

for (const [field, edit] of [
  ['author', (p) => delete p.author],
  ['publishConfig.access', (p) => (p.publishConfig = {})],
  ['repository.directory', (p) => (p.repository = { ...p.repository, directory: 'ts/packages/other' })],
  ['keywords', (p) => (p.keywords = [])],
  ['license', (p) => (p.license = 'ISC')],
  ['homepage', (p) => delete p.homepage],
  ['bugs', (p) => delete p.bugs],
]) {
  test(`check-release fails when ${field} is missing or wrong`, () => {
    const root = fakeRepo('1.2.3', (pkgs) => edit(pkgs.render))
    try {
      const r = run('check-release.mjs', [], root)
      assert.equal(r.code, 1)
      assert.match(r.out, /@tingqr\/render/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}

test('bank-logos must not claim MIT (its images are trademarks)', () => {
  const root = fakeRepo('1.2.3', (pkgs) => (pkgs['bank-logos'].license = 'MIT'))
  try {
    const r = run('check-release.mjs', [], root)
    assert.equal(r.code, 1)
    assert.match(r.out, /@tingqr\/bank-logos/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a release tag is refused while a README still says "Not released yet"', () => {
  const root = fakeRepo('1.2.3')
  try {
    writeFileSync(join(root, 'README.md'), '# tingqr\n\n<!-- status:npm -->\n**Status: not released yet.**\n')
    writeFileSync(join(root, 'ts', 'packages', 'hono', 'README.md'), '> **Not released yet.** See the repository README.\n')
    const r = run('check-release.mjs', ['--tag', 'ts-v1.2.3'], root)
    assert.equal(r.code, 1)
    assert.match(r.out, /README\.md/)
    assert.match(r.out, /hono/)
    // Without --tag (CI on every push) the status line is expected and fine.
    assert.equal(run('check-release.mjs', [], root).code, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('in the root READMEs only the npm status line counts, so another language may say "not released yet"', () => {
  const root = fakeRepo('1.2.3')
  try {
    writeFileSync(join(root, 'README.md'), '# tingqr\n\n<!-- status:npm -->\n**npm: 1.2.3.**\n\n.NET: not released yet.\n')
    writeFileSync(join(root, 'README.vi.md'), '# tingqr\n\n<!-- status:npm -->\n**npm: 1.2.3.**\n\nBản .NET chưa phát hành.\n')
    assert.equal(run('check-release.mjs', ['--tag', 'ts-v1.2.3'], root).code, 0)
    // A root README without the marker cannot be checked: refuse rather than guess.
    writeFileSync(join(root, 'README.md'), '# tingqr\n')
    const r = run('check-release.mjs', ['--tag', 'ts-v1.2.3'], root)
    assert.equal(r.code, 1)
    assert.match(r.out, /status:npm/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a release tag for 0.0.0 is refused (the in-repo placeholder version)', () => {
  const root = fakeRepo('0.0.0')
  try {
    const r = run('check-release.mjs', ['--tag', 'ts-v0.0.0'], root)
    assert.equal(r.code, 1)
    assert.match(r.out, /0\.0\.0/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the Vietnamese status line is checked too', () => {
  const root = fakeRepo('1.2.3')
  try {
    writeFileSync(join(root, 'README.md'), '# tingqr\n\n<!-- status:npm -->\n**npm: 1.2.3.**\n')
    writeFileSync(join(root, 'README.vi.md'), '# tingqr\n\n<!-- status:npm -->\n**Trạng thái: chưa phát hành.**\n')
    const r = run('check-release.mjs', ['--tag', 'ts-v1.2.3'], root)
    assert.equal(r.code, 1)
    assert.match(r.out, /README\.vi\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
