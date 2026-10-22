import { defineConfig } from '@playwright/test';
/** Screenshots for the 暖阳柔木 + month-calendar PR: outputs/vivid-d-calendars at 390×844 (Asia/Shanghai). */
const port = '5362';
export default defineConfig({
  testDir: '.',
  testMatch: 'capture.spec.ts',
  workers: 1,
  timeout: 300_000,
  outputDir: '../../../.cache/vivid-d-calendars-results',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    timezoneId: 'Asia/Shanghai',
    locale: 'zh-CN',
    browserName: 'chromium',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    env: { VITE_GUIDED_DEMO: '0' },
    cwd: '../../..',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
