import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
}))
