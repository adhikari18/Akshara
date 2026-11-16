import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright regression harness for the Akshara web studio.
 *
 * Two server modes:
 * - default (local): `next dev` on :3000 — fast iteration.
 * - `E2E_SERVER=static` (CI): serves the prebuilt static export (packages/web/out) on :4173 —
 *   deterministic, no on-demand compilation. Build it first with
 *   `npm run build --workspace=@akshara/web`.
 *
 * The data/core workspaces must be built first either way:
 * `npm run build --workspace=@akshara/data --workspace=@akshara/core`.
 */
const staticServer = process.env.E2E_SERVER === 'static';
const port = staticServer ? 4173 : 3000;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Keep everything needed to debug a canvas regression from a CI artifact.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Tall viewport keeps the whole Pati slate above the fold — pointer gestures
        // outside the viewport never reach the canvas. (Set after the device preset,
        // which would otherwise reset it to 1280×720.)
        viewport: { width: 1280, height: 1600 },
      },
    },
  ],
  webServer: staticServer
    ? {
        command: `node e2e/support/static-server.mjs packages/web/out ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      }
    : {
        command: 'npm run dev --workspace=@akshara/web',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
