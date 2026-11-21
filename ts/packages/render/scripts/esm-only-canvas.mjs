// @tingqr/render/canvas is ESM only. CJS cannot share chunks, so a CJS canvas bundle would carry a second copy of the
// QR encoder (over the size budget), and canvas only runs in browsers, where bundlers read ESM. Run after tsup.
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
for (const file of ['canvas.cjs', 'canvas.d.cts']) rmSync(join(dist, file), { force: true })
