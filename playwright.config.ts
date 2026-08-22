import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "production.spec.ts",
  timeout: 30_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", headless: true },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] } } },
    { name: "webkit", use: { browserName: "webkit", hasTouch: true, isMobile: true } },
  ],
  reporter: [["list"]],
});
