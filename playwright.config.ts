/**
 * E2E tests for the Next.js app. Run: `npx playwright test` from repo root (after `npm i` and `npx playwright install`).
 * Playwright MCP in Cursor expects a local Chromium/Chrome install (e.g. `npx playwright install chrome`) on the host running the MCP.
 */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "tablet", use: { ...devices["Galaxy Tab S4"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: "npm run build -w web && npm run start -w web -- -p 3002",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      }),
});
