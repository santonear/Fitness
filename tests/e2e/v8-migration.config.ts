import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'v8-database-migration.spec.ts', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5278', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  outputDir: '../../.cache/v8-migration-results',
  webServer: { command: 'node node_modules/vite/bin/vite.js --config tests/e2e/helpers/v8-migration-vite.config.ts --configLoader runner --host 127.0.0.1 --port 5278 --strictPort',
    url: 'http://127.0.0.1:5278', cwd: '../..', reuseExistingServer: false },
});
