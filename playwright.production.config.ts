import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production.spec.ts",
  timeout: 45_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4175", headless: true },
  webServer: {
    command: "pnpm build && PORT=4175 pnpm start",
    url: "http://127.0.0.1:4175",
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium-production", use: { browserName: "chromium", launchOptions: { executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] } } }],
});
