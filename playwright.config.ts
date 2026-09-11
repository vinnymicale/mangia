import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // The screenshot capture is a separate, on-demand run (npm run screenshots).
  testIgnore: process.env.SCREENSHOTS ? [] : ['**/screenshots.spec.ts'],
  testMatch: process.env.SCREENSHOTS ? ['**/screenshots.spec.ts'] : undefined,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A dedicated DB file so e2e runs never disturb the dev database, and a
    // dedicated build directory so Next's one-dev-server-per-distDir lock does
    // not make an already-running `npm run dev` block the whole suite.
    command: `DATABASE_URL="file:./e2e.db" NEXT_DIST_DIR=.next-e2e npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
