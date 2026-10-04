import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, workers: 2, outputDir: './test-results/cal',
  reporter: [['list'], ['json', { outputFile: 'test-results/cal-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:5184', viewport: { width: 320, height: 700 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5184 --strictPort', url: 'http://127.0.0.1:5184', reuseExistingServer: false },
});
