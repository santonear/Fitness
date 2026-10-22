import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.',
  testMatch: 'releases-ui.spec.ts',
  outputDir: '../../test-results/admin-releases',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5396', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: 'node tests/admin/releases-ui-server.mjs',
    url: 'http://127.0.0.1:5396/harness',
    reuseExistingServer: false,
  },
});
