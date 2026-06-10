import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: '.',
  base: './',
  plugins: [wasm(), react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false,
    lib: {
      entry: 'src/main.js',
      name: 'FastSearch',
      formats: ['iife'],
      fileName: () => 'fastsearch.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'fastsearch.[ext]',
      },
    },
  },
  optimizeDeps: {
    exclude: ['parquet-wasm'],
  },
})
