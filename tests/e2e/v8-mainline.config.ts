import { defineConfig } from '@playwright/test';
const port = process.env.V8_PREVIEW_PORT ?? '5280';
export default defineConfig({
  testDir: '.', testMatch: 'v8-mainline.spec.ts', workers: 1, timeout: 45000,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }], outputDir: '../../.cache/mainline-results',
  webServer: { command: `node node_modules/vite/bin/vite.js --config tests/e2e/helpers/v8-mainline-vite.config.ts --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: '../..', url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
