import { defineConfig } from "@playwright/test";

/**
 * Smoke tests in a real browser (plan §13): the main flows at phone and desktop width, with an axe
 * accessibility check on every page they visit. They run against a running app with the demo seed:
 *
 *   EMS_BASE_URL=http://localhost:3000 SEED_PASSWORD=… npx playwright test
 *
 * They use the Chrome installed on the machine (`channel: 'chrome'`), so no browser is downloaded.
 * The flows change data (a check-in, a leave request and its approval), so run them on a demo database.
 */
export default defineConfig({
  testDir: "./e2e",
  // The flows share one database and build on each other
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.EMS_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
