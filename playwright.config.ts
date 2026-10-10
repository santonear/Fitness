import { defineConfig } from '@playwright/test';
// Playwright enables color in child processes; avoid conflicting inherited flags.
delete process.env.NO_COLOR;
export default defineConfig({
  testDir: './tests/e2e',
  // HTTP qualification tests require the production transport, not the local demo.
  testIgnore: ['guided-live.spec.ts', 'ai-control-status.spec.ts', 'ai-pending.spec.ts', 'trial-access.spec.ts', 'v31-*.spec.ts', 'v8-mainline.spec.ts', 'v8-plan-review.spec.ts', 'v8-coach-panel.spec.ts'],
  workers: 4,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 320, height: 700 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5173 --strictPort',
    env: { VITE_GUIDED_DEMO: '0' },
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
});
