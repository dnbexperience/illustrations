import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:8767", browserName: "chromium" },
  webServer: {
    command: "npm run dev -- --port 8767 --strictPort",
    url: "http://127.0.0.1:8767",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
