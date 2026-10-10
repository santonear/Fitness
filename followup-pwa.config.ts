import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'followup-pwa.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5318', viewport: { width: 390, height: 844 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5318 --strictPort', url: 'http://127.0.0.1:5318', reuseExistingServer: false },
});
