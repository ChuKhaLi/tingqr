import { writeFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

/** Subpath entries. ESM shares code through chunks; CJS cannot split, so each subpath would carry its own copy. */
const SUBPATHS = ['vietqr', 'vnpay', 'promptpay', 'khqr']

/**
 * Subpaths that are not part of the root API. Their CJS file stays a real bundle (index.cjs does not contain them);
 * it carries its own copy of TingQrError, which `instanceof` tolerates (see errors.ts).
 */
const STANDALONE = ['banks']

export default defineConfig({
  entry: ['src/index.ts', ...[...SUBPATHS, ...STANDALONE].map((s) => `src/${s}.ts`)],
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  clean: true,
  sourcemap: false,
  // Replace each CJS subpath bundle with a one-line re-export of index.cjs, so the package ships the core once.
  // Types (.d.cts) stay per subpath; at run time a CJS subpath exposes the whole API.
  async onSuccess() {
    await Promise.all(
      SUBPATHS.map((s) => writeFile(`dist/${s}.cjs`, `'use strict'\nmodule.exports = require('./index.cjs')\n`)),
    )
  },
})
