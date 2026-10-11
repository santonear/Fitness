import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'quality.e2e.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5394', browserName: 'chromium' },
  webServer: { cwd: fileURLToPath(new URL('../../', import.meta.url)), command: 'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5394 --strictPort', url: 'http://127.0.0.1:5394', reuseExistingServer: false },
});
