import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests run against the built package (`pnpm test` at ts/ builds first), so what is tested is what is published —
// including that DI works without decorator metadata (tsup/esbuild does not emit it).
export default defineConfig({
  resolve: { alias: { '@tingqr/nestjs': fileURLToPath(new URL('./dist/index.js', import.meta.url)) } },
  test: { include: ['test/**/*.spec.ts'], globals: true, setupFiles: ['test/setup.ts'] },
})
