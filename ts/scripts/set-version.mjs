// Set one version on all six @tingqr packages and on @tingqr/core's VERSION constant.
// Usage (from the repo root): node ts/scripts/set-version.mjs 0.1.0
// Leaves workspace:* ranges alone: pnpm pack replaces them with the published version.
import { readFileSync, writeFileSync } from 'node:fs'
import { coreIndexPath, PACKAGES, packageJsonPath, readPackage, SEMVER, VERSION_LINE } from './release-common.mjs'

const version = process.argv[2] ?? ''
if (!SEMVER.test(version)) {
  console.error(`set-version: ${JSON.stringify(version)} is not a plain x.y.z version (no "v", no prerelease).`)
  process.exit(1)
}
const index = readFileSync(coreIndexPath(), 'utf8')
if (!VERSION_LINE.test(index)) {
  console.error('set-version: ts/packages/core/src/index.ts has no `export const VERSION = \'…\'` line.')
  process.exit(1)
}
// Everything is read and checked before anything is written.
const updated = PACKAGES.map((name) => [name, { ...readPackage(name), version }])
for (const [name, pkg] of updated) writeFileSync(packageJsonPath(name), JSON.stringify(pkg, null, 2) + '\n')
writeFileSync(coreIndexPath(), index.replace(VERSION_LINE, `export const VERSION = '${version}'`))
console.log(`set-version: ${PACKAGES.length} packages and core VERSION set to ${version}`)
