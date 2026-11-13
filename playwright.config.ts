import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke suite for the Akshara web studio.
 *
 * Runs against `next dev` (the data/core workspaces must be built first:
 * `npm run build --workspace=@akshara/data --workspace=@akshara/core`).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Tall viewport keeps the whole Pati slate above the fold — page.mouse
    // coordinates outside the viewport never reach the canvas.
    viewport: { width: 1280, height: 1600 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev --workspace=@akshara/web',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
