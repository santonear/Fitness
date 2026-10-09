import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'v8-common.spec.ts', workers: 2,
  outputDir: '../../test-results/v8-common',
  use: { baseURL: 'http://127.0.0.1:5187', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5187 --strictPort', url: 'http://127.0.0.1:5187', cwd: '../..', reuseExistingServer: false },
});
