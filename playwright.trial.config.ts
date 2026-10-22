import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({ testDir: './tests/e2e', testMatch: ['trial-access.spec.ts'], outputDir: './test-results-trial', workers: 2,
  // Same waits as playwright.config.ts: the dev server compiles on first visit, and the nightly run
  // loads it from Chrome and Safari at once, which took longer than the 5 s default.
  expect: { timeout: 15_000 }, timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:5240', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5240 --strictPort',
    env: { VITE_GUIDED_DEMO: '0' }, url: 'http://127.0.0.1:5240', reuseExistingServer: false },
});
