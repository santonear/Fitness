import { defineConfig } from '@playwright/test';
// Playwright enables color in child processes; avoid conflicting inherited flags.
delete process.env.NO_COLOR;
const port=process.env.V8_TEST_PORT??'5291';
export default defineConfig({
  testDir: './tests/e2e',
  // HTTP qualification tests require the production transport, not the local demo.
  testIgnore: ['v8-final-matrix.spec.ts', 'trial-access.spec.ts', 'v8-mainline.spec.ts', 'v8-plan-review.spec.ts', 'v8-coach-panel.spec.ts'],
  workers: 4,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 320, height: 700 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`,
    env: { VITE_GUIDED_DEMO: '0' },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
