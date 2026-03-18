import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  esbuild: {
    // Required for Lit: prevents native class fields from shadowing
    // Lit's reactive property accessors
    useDefineForClassFields: false,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BrandShapes',
      fileName: 'brand-shapes',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [],
    },
  },
})
