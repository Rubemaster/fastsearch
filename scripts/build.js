import { build } from 'vite'
import { rmSync, cpSync, existsSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')

// Clean dist
if (existsSync(dist)) rmSync(dist, { recursive: true })
mkdirSync(dist, { recursive: true })

// Build JS with Vite
console.log('Building JS…')
await build({
  root,
  configFile: resolve(root, 'vite.config.js'),
  build: {
    outDir: resolve(dist, 'assets'),
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'src/main.js'),
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
})

// Copy PHP plugin file
console.log('Copying plugin files…')
cpSync(resolve(root, 'fastsearch.php'), resolve(dist, 'fastsearch.php'))

// Copy blocks
cpSync(resolve(root, 'blocks'), resolve(dist, 'blocks'), { recursive: true })

// Copy data.json
cpSync(resolve(root, 'src/data.json'), resolve(dist, 'assets/data.json'))

// Zip it
console.log('Zipping…')
execSync('cd dist && zip -r ../FastSearch.zip .', { cwd: root, stdio: 'pipe' })

console.log('Done → FastSearch.zip')
