// Shared helpers for set-version.mjs.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The dotnet/ directory; TINGQR_DOTNET_ROOT overrides it (tests use a temp copy). */
export const ROOT = process.env.TINGQR_DOTNET_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..')

/** The four NuGet packages, in the publish order of release-dotnet.yml (a package is published after everything it depends on). */
export const PACKAGES = ['TingQR.Core', 'TingQR.Rendering', 'TingQR.BankLogos', 'TingQR.AspNetCore']

/** Plain x.y.z, no leading zeros, no prerelease or build part. */
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
export const PROPS_VERSION = /<Version>([^<]*)<\/Version>/
export const CONST_VERSION = /(public const string Value = ")([^"]*)(";)/

export const propsPath = () => join(ROOT, 'Directory.Build.props')
export const versionConstPath = () => join(ROOT, 'src', 'TingQR.Core', 'TingQrVersion.cs')

export function readDotnetVersion() {
  const m = PROPS_VERSION.exec(readFileSync(propsPath(), 'utf8'))
  if (!m) throw new Error('Directory.Build.props has no <Version> element.')
  return m[1]
}

export function readTingQrVersionConst() {
  const m = CONST_VERSION.exec(readFileSync(versionConstPath(), 'utf8'))
  if (!m) throw new Error('TingQrVersion.cs has no `public const string Value = "…";` line.')
  return m[2]
}
