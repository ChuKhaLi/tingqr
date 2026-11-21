import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests run against the built package (ng-packagr, partial compilation): `@angular/compiler` in test/setup.ts JIT-compiles
// its partial declarations at runtime, so what is tested is what is published. `pnpm test` at ts/ builds first.
export default defineConfig({
  resolve: { alias: { '@tingqr/angular': fileURLToPath(new URL('./dist/fesm2022/tingqr-angular.mjs', import.meta.url)) } },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
  },
})
