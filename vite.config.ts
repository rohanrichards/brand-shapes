import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
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
