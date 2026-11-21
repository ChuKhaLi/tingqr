import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The repository's `conformance/` directory, found by walking up from this file. A fixed relative path breaks
 * when tools (e.g. Stryker) copy the package into a deeper sandbox inside the repo.
 */
export const CONFORMANCE_DIR: string = (() => {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = join(dir, 'conformance')
    if (existsSync(join(candidate, 'errors.json'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) throw new Error('conformance/ not found above ' + fileURLToPath(import.meta.url))
    dir = parent
  }
})()
