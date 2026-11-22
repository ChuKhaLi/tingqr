// Release readiness of the six @tingqr packages: one shared version (equal to core's VERSION), the tag matches it, and
// the npm metadata every published package needs.
// Usage: node ts/scripts/check-release.mjs [--tag ts-vX.Y.Z]
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { coreIndexPath, PACKAGES, readPackage, ROOT, SEMVER, VERSION_LINE } from './release-common.mjs'

const REPO_URL = 'git+https://github.com/ChuKhaLi/tingqr.git'
const AUTHOR = 'Chung Nguyen'

const problems = []
const pkgs = PACKAGES.map((name) => [name, readPackage(name)])
const version = pkgs[0][1].version

for (const [name, pkg] of pkgs) {
  const id = pkg.name ?? `@tingqr/${name}`
  if (pkg.version !== version) problems.push(`${id}: version ${pkg.version}, but ${pkgs[0][1].name} has ${version}`)
  // The bank logos are trademarks, not MIT: only their code is (LOGOS-NOTICE.md says which is which).
  const license = name === 'bank-logos' ? 'SEE LICENSE IN LOGOS-NOTICE.md' : 'MIT'
  if (pkg.license !== license) problems.push(`${id}: license must be "${license}"`)
  if (pkg.author !== AUTHOR) problems.push(`${id}: author must be "${AUTHOR}"`)
  const repo = pkg.repository ?? {}
  if (repo.type !== 'git' || repo.url !== REPO_URL || repo.directory !== `ts/packages/${name}`) {
    problems.push(`${id}: repository must be { type: "git", url: "${REPO_URL}", directory: "ts/packages/${name}" }`)
  }
  if (typeof pkg.homepage !== 'string' || !pkg.homepage.startsWith('https://github.com/ChuKhaLi/tingqr')) {
    problems.push(`${id}: homepage must point into https://github.com/ChuKhaLi/tingqr`)
  }
  if (typeof pkg.bugs?.url !== 'string' || !pkg.bugs.url.startsWith('https://github.com/ChuKhaLi/tingqr/issues')) {
    problems.push(`${id}: bugs.url must be the repository's issues page`)
  }
  if (!Array.isArray(pkg.keywords) || pkg.keywords.length === 0) problems.push(`${id}: keywords must not be empty`)
  if (pkg.publishConfig?.access !== 'public') problems.push(`${id}: publishConfig.access must be "public" (scoped packages default to private)`)
}

const coreVersion = VERSION_LINE.exec(readFileSync(coreIndexPath(), 'utf8'))?.[1]
if (coreVersion !== version) problems.push(`@tingqr/core: VERSION in src/index.ts is ${coreVersion}, package.json has ${version}`)

const tagIndex = process.argv.indexOf('--tag')
if (tagIndex !== -1) {
  const tag = process.argv[tagIndex + 1] ?? ''
  if (tag !== `ts-v${version}`) problems.push(`tag ${JSON.stringify(tag)} must be exactly ts-v${version}`)
  if (version === '0.0.0') problems.push('version 0.0.0 is the in-repo placeholder: run set-version first')
  // Prereleases need a dist-tag flow that does not exist yet (an rc published as `latest` is a real footgun). This is
  // the only prerelease guard: the workflow passes the tag here instead of matching it in shell, where the dash of the
  // "ts-" prefix once made every tag look like a prerelease.
  if (!SEMVER.test(version)) problems.push(`version ${version} is not a plain x.y.z: prerelease publishing is not supported`)
  // npm publishes each README verbatim and a published version's page never changes: a release must not ship the
  // pre-release status (docs/RELEASING.md says what to write instead). Markdown wraps lines and quotes blocks, so line
  // breaks and "> " prefixes are flattened before matching.
  // Package READMEs are npm-only: the whole file counts. The root READMEs also speak for other languages (.NET), so
  // only the first paragraph after the `<!-- status:npm -->` marker counts there.
  const UNRELEASED = /not\s+released\s+yet|not\s+on\s+npm\s+yet|chưa\s+phát\s+hành|chưa\s+có\s+trên\s+npm/i
  const flat = (text) => text.replace(/\r?\n[ \t]*(>[ \t]*)*/g, ' ')
  const packageReadmes = PACKAGES.map((p) => join(ROOT, 'ts', 'packages', p, 'README.md'))
  for (const file of packageReadmes) {
    if (existsSync(file) && UNRELEASED.test(flat(readFileSync(file, 'utf8')))) {
      problems.push(`${relative(ROOT, file)} still says it is not released: update its status before a release`)
    }
  }
  for (const file of [join(ROOT, 'README.md'), join(ROOT, 'README.vi.md')]) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    const at = text.indexOf('<!-- status:npm -->')
    if (at === -1) {
      problems.push(`${relative(ROOT, file)} has no <!-- status:npm --> marker before its npm status paragraph`)
      continue
    }
    // The paragraph starts on the marker's own line: a blank line right after the marker leaves it empty, and an
    // empty status cannot be checked, so it is refused rather than passed.
    const paragraph = text.slice(at + '<!-- status:npm -->'.length).split(/\r?\n[ \t]*\r?\n/)[0].trim()
    if (paragraph === '') {
      problems.push(`${relative(ROOT, file)}: the npm status paragraph must follow <!-- status:npm --> with no blank line`)
    } else if (UNRELEASED.test(flat(paragraph))) {
      problems.push(`${relative(ROOT, file)}: the npm status still says it is not released`)
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`check-release: ${p}`)
  process.exit(1)
}
console.log(`check-release: ok (${PACKAGES.length} packages at ${version})`)
