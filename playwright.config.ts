/**
 * E2E tests for the Next.js app. Run: `npx playwright test` from repo root (after `npm i` and `npx playwright install`).
 * Playwright MCP in Cursor expects a local Chromium/Chrome install (e.g. `npx playwright install chrome`) on the host running the MCP.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -w web -- -p 3002",
    url: "http://127.0.0.1:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
