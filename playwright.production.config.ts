import { defineConfig } from "@playwright/test";

const productionServerCommand =
  process.env.GITHUB_ACTIONS === "true"
    ? "PORT=4175 pnpm start"
    : "npm run build && PORT=4175 npm start";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production.spec.ts",
  timeout: 45_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4175", headless: true },
  webServer: {
    command: productionServerCommand,
    url: "http://127.0.0.1:4175",
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium-production",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
});
