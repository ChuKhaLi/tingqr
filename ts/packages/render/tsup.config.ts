import { defineConfig } from 'tsup'

// @tingqr/render/canvas is ESM only: `pnpm build` runs scripts/esm-only-canvas.mjs after tsup to delete the CJS canvas
// files (tsup's onSuccess runs before the .d.cts build finishes, so it cannot do this).
export default defineConfig({
  entry: { index: 'src/index.ts', canvas: 'src/canvas.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  clean: true,
  sourcemap: false,
})
