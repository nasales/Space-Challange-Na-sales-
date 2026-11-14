import { defineConfig, devices } from '@playwright/test'

// End-to-end tests for the demo path. Run: npx playwright test (or ./scripts/check.sh --e2e)
export default defineConfig({
  testDir: './tests/e2e',
  // The 3D map is heavy to build in a headless browser
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Starts the dev server, or reuses the one already running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
