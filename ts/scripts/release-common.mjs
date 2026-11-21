// Shared helpers for set-version.mjs and check-release.mjs.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repository root; TINGQR_REPO_ROOT overrides it (tests use a fake repo). */
export const ROOT = process.env.TINGQR_REPO_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The six npm packages, in publish order (a package is published after everything it depends on). */
export const PACKAGES = ['core', 'render', 'bank-logos', 'hono', 'nestjs', 'angular']

export const packageJsonPath = (name) => join(ROOT, 'ts', 'packages', name, 'package.json')
export const coreIndexPath = () => join(ROOT, 'ts', 'packages', 'core', 'src', 'index.ts')
export const readPackage = (name) => JSON.parse(readFileSync(packageJsonPath(name), 'utf8'))

/** Plain x.y.z, no leading zeros, no prerelease or build part (prereleases are refused until a dist-tag flow exists). */
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
export const VERSION_LINE = /^export const VERSION = '([^']*)'$/m
