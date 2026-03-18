import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    useDefineForClassFields: false,
  },
  base: '/brand-shapes/',
  build: {
    outDir: 'dist-demo',
  },
})
