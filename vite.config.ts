import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Python backend (npm run dev:api). On Vercel, vercel.json routes /api instead.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
