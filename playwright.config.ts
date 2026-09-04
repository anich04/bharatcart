import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Assumes the dev server and the local Postgres
 * (`node scripts/pg-dev.mjs`) are running, and the database has been seeded.
 */
export default defineConfig({
  testDir: "./e2e",
  // Generous timeouts: against `next dev` the first hit on a route pays an
  // on-demand compile, which is slow under device emulation.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Majority of traffic is Android mobile — check the happy path there too.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
