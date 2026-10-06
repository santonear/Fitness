import { defineConfig } from '@playwright/test';

delete process.env.NO_COLOR;
if (process.platform === 'win32') process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:/Project/xxgospel/Fitness/.worktrees/.playwright-browsers';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['guided-lifecycle.spec.ts', 'guided-backup.spec.ts', 'guided-ui.spec.ts', 'analytics-dashboard.spec.ts', 'onboarding-redesign.spec.ts'],
  outputDir: './test-results-guided',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5230', viewport: { width: 320, height: 700 }, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: process.env.GUIDED_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'node node_modules/vite/bin/vite.js --config vite.guided.config.ts --configLoader runner --host 127.0.0.1 --port 5230 --strictPort',
    env: { VITE_GUIDED_DEMO: '1' },
    url: 'http://127.0.0.1:5230', reuseExistingServer: false,
  },
});
