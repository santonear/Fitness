import { defineConfig } from '@playwright/test';
const port = process.env.V8_MANUAL_PORT ?? '5297';
export default defineConfig({
  testDir: '.', testMatch: 'v8-manual.spec.ts', workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 375, height: 812 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }], outputDir: '../../.cache/manual-results',
  webServer: { command: `node node_modules/vite/bin/vite.js --config tests/e2e/helpers/v8-mainline-vite.config.ts --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`, cwd: '../..', url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
