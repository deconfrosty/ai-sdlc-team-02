import { defineConfig, devices } from "@playwright/test";

const testSessionSecret = "playwright-test-session-secret-32-bytes-minimum";
process.env.DATABASE_PATH = ":memory:";
process.env.SESSION_SECRET = testSessionSecret;
process.env.WEBAUTHN_RP_ID = "localhost";
process.env.WEBAUTHN_ORIGIN = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    timezoneId: "Asia/Singapore",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname localhost",
    url: "http://localhost:3000",
    env: {
      DATABASE_PATH: ":memory:",
      SESSION_SECRET: testSessionSecret,
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_ORIGIN: "http://localhost:3000",
      NODE_ENV: "development",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
