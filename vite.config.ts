import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Version shown on screen (src/shared/version.ts): package.json version + git commit + build time.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

function gitCommit(): string {
  // Cloudflare Workers Builds and Vercel also expose the commit as an env variable.
  const fromEnv = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
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
