import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CONFIG_DIR, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'apps', 'web');

export default defineConfig({
  rootDir: REPO_ROOT,
  testDir: path.join(REPO_ROOT, 'tests', 'e2e'),
  fullyParallel: true,
  reporter: 'list',
  webServer: {
    command: `node ${path.join(CONFIG_DIR, 'serve.js')} ${WEB_ROOT} 5173`,
    port: 5173,
    reuseExistingServer: false,
    timeout: 120000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['Pixel 5'] },
  ],
});
