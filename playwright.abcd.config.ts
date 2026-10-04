import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({
  testDir: './tests/e2e', timeout: 180000, workers: 2, outputDir: './test-results/abcd',
  reporter: [['list'], ['json', { outputFile: 'test-results/abcd-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:5187', viewport: { width: 320, height: 700 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort', url: 'http://127.0.0.1:5187', reuseExistingServer: false },
});
