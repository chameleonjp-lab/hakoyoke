import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "production.spec.ts",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3000", headless: true },
  projects: [
    { name: "chromium", use: { browserName: "chromium", launchOptions: { executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] } } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  reporter: [["list"]],
});
