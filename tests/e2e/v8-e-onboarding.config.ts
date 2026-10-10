import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'v8-e-onboarding.spec.ts', workers: 2,
  outputDir: '../../test-results/v8-e-onboarding',
  use: { baseURL: 'http://127.0.0.1:5195', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --config tests/e2e/helpers/v8-e-vite.config.ts --configLoader runner --host 127.0.0.1 --port 5195 --strictPort', url: 'http://127.0.0.1:5195', cwd: '../..', reuseExistingServer: true },
});
