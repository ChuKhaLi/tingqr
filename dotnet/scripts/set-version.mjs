// Set the one NuGet version: <Version> in dotnet/Directory.Build.props and TingQrVersion.Value.
// Usage (from the repo root): node dotnet/scripts/set-version.mjs 0.1.0
import { readFileSync, writeFileSync } from 'node:fs'
import { CONST_VERSION, PROPS_VERSION, propsPath, SEMVER, versionConstPath } from './release-common.mjs'

const version = process.argv[2] ?? ''
if (!SEMVER.test(version)) {
  console.error(`set-version: ${JSON.stringify(version)} is not a plain x.y.z version (no "v", no prerelease).`)
  process.exit(1)
}
const props = readFileSync(propsPath(), 'utf8')
const source = readFileSync(versionConstPath(), 'utf8')
if (!PROPS_VERSION.test(props) || !CONST_VERSION.test(source)) {
  console.error('set-version: Directory.Build.props or TingQrVersion.cs has no version to replace.')
  process.exit(1)
}
// Everything is read and checked before anything is written.
writeFileSync(propsPath(), props.replace(PROPS_VERSION, `<Version>${version}</Version>`))
writeFileSync(versionConstPath(), source.replace(CONST_VERSION, (_m, a, _v, c) => `${a}${version}${c}`))
console.log(`set-version: Directory.Build.props and TingQrVersion.Value set to ${version}`)
