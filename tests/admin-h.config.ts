import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: ['admin-h.spec.ts', 'admin-account-actions.spec.ts'],
  outputDir: '../test-results/admin-h', workers: 2,
  use: { baseURL: 'http://127.0.0.1:5188', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { cwd: fileURLToPath(new URL('../', import.meta.url)), command: 'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5188 --strictPort', url: 'http://127.0.0.1:5188', reuseExistingServer: false, env: { VITE_GUIDED_DEMO: '0' } },
});

