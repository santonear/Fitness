import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, workers: 2, outputDir: './test-results/integration',
  reporter: [['list'], ['json', { outputFile: 'test-results/integration-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:5189', viewport: { width: 320, height: 700 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5189 --strictPort', url: 'http://127.0.0.1:5189', reuseExistingServer: false },
});
