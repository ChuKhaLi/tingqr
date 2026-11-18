import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/vietqr.ts', 'src/vnpay.ts', 'src/promptpay.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  clean: true,
  sourcemap: false,
})
