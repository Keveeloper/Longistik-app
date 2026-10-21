/// <reference types="vitest" />

import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacy()
  ],
  server: {
    // The panel's CORS only allows its own web: proxy the public directory in dev
    proxy: {
      '/panel-api': {
        target: 'https://api.panel.longistik.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/panel-api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
