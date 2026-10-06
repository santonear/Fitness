import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'stage-summary.spec.ts', outputDir: 'test-results/stage2-summary',
  use: { baseURL: 'http://127.0.0.1:5211', viewport: { width: 320, height: 700 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5211 --strictPort', url: 'http://127.0.0.1:5211', reuseExistingServer: false },
});
