import { defineConfig, devices } from '@playwright/test';

const port = 3407;
const baseURL = `http://127.0.0.1:${port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', launchOptions: executablePath ? { executablePath } : {} },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port ' + port,
    url: baseURL,
    timeout: 90_000,
    reuseExistingServer: false,
  },
});
