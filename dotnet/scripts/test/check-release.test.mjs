// Tests for check-release.mjs, run against a fake repository in a temp directory.
// Run: node --test dotnet/scripts/test/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-release.mjs')
const PACKAGES = ['TingQR.Core', 'TingQR.Rendering', 'TingQR.AspNetCore', 'TingQR.BankLogos']
const RELEASED_README = (p) => `# ${p}\n\nInstall with \`dotnet add package ${p}\`.\n`
const ROOT_README = (status) => `# tingqr\n\n<!-- status:npm -->\n**Status: not released yet.**\n\n## .NET\n\n<!-- status:nuget -->\n${status}\n\nMore text.\n`

/**
 * A fake repo: dotnet/Directory.Build.props, TingQrVersion.cs, four package READMEs and the two root READMEs, all
 * "released" at `version` unless `edit(root)` changes them.
 */
function fakeRepo(version = '1.2.3', { constVersion = version, edit = () => {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tingqr-dotnet-release-'))
  const dotnet = join(root, 'dotnet')
  mkdirSync(join(dotnet, 'src', 'TingQR.Core'), { recursive: true })
  writeFileSync(join(dotnet, 'Directory.Build.props'), `<Project>\n  <PropertyGroup>\n    <Version>${version}</Version>\n  </PropertyGroup>\n</Project>\n`)
  writeFileSync(
    join(dotnet, 'src', 'TingQR.Core', 'TingQrVersion.cs'),
    `namespace TingQR;\npublic static class TingQrVersion\n{\n    public const string Value = "${constVersion}";\n}\n`,
  )
  for (const p of PACKAGES) {
    mkdirSync(join(dotnet, 'src', p), { recursive: true })
    writeFileSync(join(dotnet, 'src', p, 'README.md'), RELEASED_README(p))
  }
  writeFileSync(join(root, 'README.md'), ROOT_README(`**Status:** on NuGet as version ${version}.`))
  writeFileSync(join(root, 'README.vi.md'), ROOT_README(`**Trạng thái:** đã có trên NuGet, bản ${version}.`))
  edit(root)
  return root
}

function run(root, args = []) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, TINGQR_DOTNET_ROOT: join(root, 'dotnet') },
    encoding: 'utf8',
  })
  return { code: r.status, out: r.stdout + r.stderr }
}

function withRepo(opts, fn) {
  const root = fakeRepo(opts.version, opts)
  try { fn(root) } finally { rmSync(root, { recursive: true, force: true }) }
}

test('a good repo passes, with and without a matching tag', () => {
  withRepo({}, (root) => {
    assert.equal(run(root).code, 0, run(root).out)
    const r = run(root, ['--tag', 'dotnet-v1.2.3'])
    assert.equal(r.code, 0, r.out)
  })
})

test('the in-repo 0.0.0 passes without a tag (both numbers agree)', () => {
  withRepo({ version: '0.0.0' }, (root) => assert.equal(run(root).code, 0))
})

test('TingQrVersion.Value different from Directory.Build.props fails, naming both', () => {
  withRepo({ constVersion: '1.2.4' }, (root) => {
    for (const args of [[], ['--tag', 'dotnet-v1.2.3']]) {
      const r = run(root, args)
      assert.equal(r.code, 1)
      assert.match(r.out, /1\.2\.4/)
      assert.match(r.out, /1\.2\.3/)
    }
  })
})

for (const tag of ['ts-v1.2.3', 'v1.2.3', 'dotnet-v1.2.4', 'dotnet-1.2.3', 'dotnet-v1.2.3-rc.1', '']) {
  test(`tag ${JSON.stringify(tag)} for version 1.2.3 fails`, () => {
    withRepo({}, (root) => {
      const r = run(root, ['--tag', tag])
      assert.equal(r.code, 1)
      assert.match(r.out, /dotnet-v1\.2\.3/)
    })
  })
}

test('--tag with no value fails', () => {
  withRepo({}, (root) => assert.equal(run(root, ['--tag']).code, 1))
})

test('0.0.0 is refused with a tag, even when the tag matches', () => {
  withRepo({ version: '0.0.0' }, (root) => {
    const r = run(root, ['--tag', 'dotnet-v0.0.0'])
    assert.equal(r.code, 1)
    assert.match(r.out, /0\.0\.0/)
    assert.match(r.out, /set-version/)
  })
})

test('a prerelease version is refused with a tag', () => {
  withRepo({ version: '1.2.3-rc.1' }, (root) => {
    const r = run(root, ['--tag', 'dotnet-v1.2.3-rc.1'])
    assert.equal(r.code, 1)
    assert.match(r.out, /x\.y\.z/)
  })
})

for (const p of PACKAGES) {
  for (const text of ['**Not released yet.**', '**Status: not released.** Version `0.0.0`, not on NuGet.', 'It is not\n> released yet.']) {
    test(`${p} README saying ${JSON.stringify(text)} fails with a tag, passes without`, () => {
      const edit = (root) => writeFileSync(join(root, 'dotnet', 'src', p, 'README.md'), `# ${p}\n\n> ${text}\n`)
      withRepo({ edit }, (root) => {
        assert.equal(run(root).code, 0)
        const r = run(root, ['--tag', 'dotnet-v1.2.3'])
        assert.equal(r.code, 1)
        assert.match(r.out, new RegExp(p.replace('.', '\\.') + '[\\\\/]README\\.md'))
      })
    })
  }
}

test('a missing package README fails with a tag', () => {
  const edit = (root) => rmSync(join(root, 'dotnet', 'src', 'TingQR.BankLogos', 'README.md'))
  withRepo({ edit }, (root) => assert.equal(run(root, ['--tag', 'dotnet-v1.2.3']).code, 1))
})

for (const [file, status] of [
  ['README.md', '**Status: not released yet.** The four packages are not on NuGet yet.'],
  ['README.vi.md', '**Trạng thái: chưa phát hành.**'],
]) {
  test(`${file} whose .NET status says it is not released fails with a tag`, () => {
    const edit = (root) => writeFileSync(join(root, file), ROOT_README(status))
    withRepo({ edit }, (root) => {
      const r = run(root, ['--tag', 'dotnet-v1.2.3'])
      assert.equal(r.code, 1)
      assert.match(r.out, new RegExp(file.replace(/\./g, '\\.')))
    })
  })
}

test('only the .NET status paragraph of a root README counts (the npm one may still say not released)', () => {
  withRepo({}, (root) => {
    assert.match(readFileSync(join(root, 'README.md'), 'utf8'), /status:npm -->\n\*\*Status: not released yet/)
    assert.equal(run(root, ['--tag', 'dotnet-v1.2.3']).code, 0)
  })
})

test('a root README without the <!-- status:nuget --> marker fails with a tag', () => {
  const edit = (root) => writeFileSync(join(root, 'README.md'), '# tingqr\n\nOn NuGet.\n')
  withRepo({ edit }, (root) => {
    const r = run(root, ['--tag', 'dotnet-v1.2.3'])
    assert.equal(r.code, 1)
    assert.match(r.out, /status:nuget/)
  })
})

test('a blank line right after the marker (empty status) fails with a tag', () => {
  const edit = (root) => writeFileSync(join(root, 'README.vi.md'), '# tingqr\n\n<!-- status:nuget -->\n\nĐã phát hành.\n')
  withRepo({ edit }, (root) => assert.equal(run(root, ['--tag', 'dotnet-v1.2.3']).code, 1))
})

test('the release workflow leaves tag checks to check-release and tests with the file-glob form', () => {
  const workflow = readFileSync(join(HERE, '..', '..', '..', '.github', 'workflows', 'release-dotnet.yml'), 'utf8')
  assert.match(workflow, /node dotnet\/scripts\/check-release\.mjs --tag "\$GITHUB_REF_NAME"/)
  assert.match(workflow, /node --test dotnet\/scripts\/test\/\*\.test\.mjs/)
  // Comments may explain why it is not used; no command may use it.
  const commands = workflow.split(/\r?\n/).filter((line) => !line.trimStart().startsWith('#'))
  assert.ok(!commands.some((line) => line.includes('--skip-duplicate')), 'a command uses --skip-duplicate')
})
