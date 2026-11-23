import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 8082,
    watch: {
      usePolling: true,
    },
    proxy: {
      '^/(app|api|assets|files)': {
        target: 'http://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
