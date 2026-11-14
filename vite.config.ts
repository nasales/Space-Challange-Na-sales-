import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Python backend (npm run dev:api). On Vercel, vercel.json routes /api instead.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Dev preview of the featured case levels (src/levels/, Ivan); the game does not use it.
        levels: fileURLToPath(new URL('./levels.html', import.meta.url)),
      },
    },
  },
})
