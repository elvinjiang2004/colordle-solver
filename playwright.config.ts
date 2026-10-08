import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1050 },
    launchOptions: {
      executablePath: process.env.BROWSER_PATH ?? (existsSync(chrome) ? chrome : undefined),
      args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
