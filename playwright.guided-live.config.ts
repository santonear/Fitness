import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({ testDir: './tests/e2e', testMatch: 'guided-live.spec.ts',
  outputDir: './test-results-guided-live', workers: 2,
  use: { baseURL: 'http://127.0.0.1:5231', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: process.env.GUIDED_EXTERNAL_SERVER === '1' ? undefined : { command: 'node node_modules/vite/bin/vite.js --config vite.guided.config.ts --configLoader runner --host 127.0.0.1 --port 5231 --strictPort',
    env: { VITE_GUIDED_DEMO: '0' }, url: 'http://127.0.0.1:5231', reuseExistingServer: false },
});
