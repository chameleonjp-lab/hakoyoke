import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "production.spec.ts",
  timeout: 30_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", headless: true },
  webServer: {
    // Integration E2E keeps the ranking RPC contract covered with its local
    // mock. The production build intentionally omits this flag while the
    // publication is paused.
    command:
      "VITE_RANKING_ENABLED=true VITE_RANKING_E2E=true node_modules/.bin/vite --host 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
    {
      name: "webkit",
      use: { browserName: "webkit", hasTouch: true, isMobile: true },
    },
  ],
  reporter: [["list"]],
});
