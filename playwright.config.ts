import { defineConfig, devices } from "@playwright/test";

const testSessionSecret = "playwright-test-session-secret-32-bytes-minimum";
const testOrigin = "http://localhost:31984";
process.env.DATABASE_PATH = ":memory:";
process.env.SESSION_SECRET = testSessionSecret;
process.env.WEBAUTHN_RP_ID = "localhost";
process.env.WEBAUTHN_ORIGIN = testOrigin;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: testOrigin,
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
    command: "npm run dev -- --hostname localhost --port 31984",
    url: testOrigin,
    env: {
      DATABASE_PATH: ":memory:",
      SESSION_SECRET: testSessionSecret,
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_ORIGIN: testOrigin,
      NODE_ENV: "development",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
