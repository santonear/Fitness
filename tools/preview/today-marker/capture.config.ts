import { defineConfig } from '@playwright/test';
/** Preview only: today-marker candidates, outputs/today-marker/img at 390×844 (Asia/Shanghai). */
const port = '5363';
export default defineConfig({
  testDir: '.', testMatch: 'capture.spec.ts', workers: 1, timeout: 300_000,
  outputDir: '../../../.cache/today-marker-results',
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Shanghai', locale: 'zh-CN', browserName: 'chromium' },
  webServer: { command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`, env: { VITE_GUIDED_DEMO: '0' }, cwd: '../../..', url: `http://127.0.0.1:${port}`, reuseExistingServer: true },
});
