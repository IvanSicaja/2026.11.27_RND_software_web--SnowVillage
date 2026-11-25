// E2E-Tests: echte Browser (Desktop + Handy) gegen den laufenden Node-Server.
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = 4173;
// Lokal installiertes Chrome nutzen, falls die Playwright-Browser nicht installiert sind
const chromePath = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const launchOptions = process.env.PW_USE_BUNDLED || !chromePath ? {} : { executablePath: chromePath };

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],
  webServer: {
    command: `node server.js`,
    cwd: '../main',
    env: { PORT: String(PORT), NODE_ENV: 'production' },
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
