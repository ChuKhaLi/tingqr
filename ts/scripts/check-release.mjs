// Release readiness of the six @tingqr packages: one shared version (equal to core's VERSION), the tag matches it, and
// the npm metadata every published package needs.
// Usage: node ts/scripts/check-release.mjs [--tag ts-vX.Y.Z]
import { readFileSync } from 'node:fs'
import { coreIndexPath, PACKAGES, readPackage, VERSION_LINE } from './release-common.mjs'

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
}

if (problems.length) {
  for (const p of problems) console.error(`check-release: ${p}`)
  process.exit(1)
}
console.log(`check-release: ok (${PACKAGES.length} packages at ${version})`)
