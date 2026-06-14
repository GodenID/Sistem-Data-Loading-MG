import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'

// Get build timestamp for versioning
const buildTimestamp = Date.now()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Add cache busting comment and version meta tag
        return html.replace(
          '</head>',
          `  <!-- Build Version: ${buildTimestamp} -->\n  <meta name="app-version" content="${buildTimestamp}" />\n</head>`
        )
      }
    }
  ],
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    // Generate hashed filenames for cache busting
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash]-' + buildTimestamp + '.js',
        chunkFileNames: 'assets/[name]-[hash]-' + buildTimestamp + '.js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.css$/i.test(assetInfo.name)) {
            return `assets/[name]-[hash]-${buildTimestamp}[extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      }
    }
  }
})
