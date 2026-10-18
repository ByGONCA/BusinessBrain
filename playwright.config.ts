import { defineConfig, devices } from "@playwright/test";

/**
 * BusinessBrain — Playwright E2E Configuration
 * 
 * Configured for isolated local testing against Next.js app server.
 * Requires: npm install -D @playwright/test && npx playwright install chromium
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false, // Run sequentially for predictable session state
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    trace: "on-first-retry",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
