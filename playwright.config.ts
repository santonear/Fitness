import { defineConfig } from '@playwright/test';
// Playwright enables color in child processes; avoid conflicting inherited flags.
delete process.env.NO_COLOR;
const port=process.env.V8_TEST_PORT??'5291';
export default defineConfig({
  testDir: './tests/e2e',
  // HTTP qualification tests require the production transport, not the local demo.
  // training-engine.spec.ts runs once, in its own config (browser-engine job).
  testIgnore: ['training-engine.spec.ts', 'mainline-polish.spec.ts', 'followup-finish.spec.ts', 'followup-pwa.spec.ts', 'v8-final-matrix.spec.ts', 'trial-access.spec.ts', 'v8-mainline.spec.ts', 'v8-plan-review.spec.ts', 'v8-coach-panel.spec.ts'],
  workers: 4,
  // A first visit opens the local database and the dev server compiles on demand; on slow shared
  // runners that took longer than the 5 s default, so assertions wait up to 15 s and a whole test
  // up to 60 s (the same runners pushed several flows past 30 s).
  expect: { timeout: 15_000 },
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 320, height: 700 },
    // The app's calendar days follow the user's zone (default Asia/Shanghai); run the browser there too so day boundaries agree.
    timezoneId: 'Asia/Shanghai',
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
