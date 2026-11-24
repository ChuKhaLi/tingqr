// Release readiness of the four TingQR NuGet packages: the one version in Directory.Build.props equals
// TingQrVersion.Value, and with --tag the tag matches it and no README still says "not released".
// Usage (from the repo root): node dotnet/scripts/check-release.mjs [--tag dotnet-vX.Y.Z]
// Package metadata (license, README, NOTICE, dependencies) is checked on the packed .nupkg by the release drill
// (.claude/skills/release-drill-dotnet), not here.
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { PACKAGES, readDotnetVersion, readTingQrVersionConst, ROOT, SEMVER } from './release-common.mjs'

const REPO = join(ROOT, '..')
const problems = []

let version
try {
  version = readDotnetVersion()
  const constant = readTingQrVersionConst()
  if (constant !== version) {
    problems.push(`TingQrVersion.Value is ${constant}, Directory.Build.props has ${version}: run node dotnet/scripts/set-version.mjs`)
  }
} catch (e) {
  problems.push(e instanceof Error ? e.message : String(e))
}

const tagIndex = process.argv.indexOf('--tag')
if (tagIndex !== -1 && version !== undefined) {
  const tag = process.argv[tagIndex + 1] ?? ''
  if (tag !== `dotnet-v${version}`) problems.push(`tag ${JSON.stringify(tag)} must be exactly dotnet-v${version}`)
  if (version === '0.0.0') problems.push('version 0.0.0 is the in-repo placeholder: run set-version first')
  // The only prerelease guard (same reason as ts/scripts/check-release.mjs): a tag is checked here, not matched in shell.
  if (!SEMVER.test(version)) problems.push(`version ${version} is not a plain x.y.z: prerelease publishing is not supported`)
  // nuget.org shows each package's README as packed, and a published version never changes: a release must not ship
  // the pre-release status. Markdown wraps lines and quotes blocks, so line breaks and "> " prefixes are flattened.
  // Package READMEs are NuGet-only: the whole file counts. The root READMEs also speak for npm, so only the paragraph
  // after the `<!-- status:nuget -->` marker counts there.
  const UNRELEASED = /not\s+released|not\s+on\s+nuget|chưa\s+phát\s+hành|chưa\s+có\s+trên\s+nuget/i
  const flat = (text) => text.replace(/\r?\n[ \t]*(>[ \t]*)*/g, ' ')
  for (const p of PACKAGES) {
    const file = join(ROOT, 'src', p, 'README.md')
    if (!existsSync(file)) problems.push(`${relative(REPO, file)} is missing (every package ships its README)`)
    else if (UNRELEASED.test(flat(readFileSync(file, 'utf8')))) {
      problems.push(`${relative(REPO, file)} still says it is not released: update its status before a release`)
    }
  }
  const MARKER = '<!-- status:nuget -->'
  for (const name of ['README.md', 'README.vi.md']) {
    const file = join(REPO, name)
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    const at = text.indexOf(MARKER)
    if (at === -1) {
      problems.push(`${name} has no ${MARKER} marker before its .NET status paragraph`)
      continue
    }
    // The paragraph starts on the marker's own line; an empty status cannot be checked, so it is refused.
    const paragraph = text.slice(at + MARKER.length).split(/\r?\n[ \t]*\r?\n/)[0].trim()
    if (paragraph === '') problems.push(`${name}: the .NET status paragraph must follow ${MARKER} with no blank line`)
    else if (UNRELEASED.test(flat(paragraph))) problems.push(`${name}: the .NET status still says it is not released`)
  }
}

if (problems.length) {
  for (const p of problems) console.error(`check-release: ${p}`)
  process.exit(1)
}
console.log(`check-release: ok (${PACKAGES.length} packages at ${version})`)
