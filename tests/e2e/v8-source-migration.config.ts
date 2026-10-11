import { defineConfig } from '@playwright/test';
const port = process.env.V8_SOURCE_PORT ?? '5338';
export default defineConfig({
  testDir: '.', testMatch: ['v8-source-migration.spec.ts','v8-database-migration.spec.ts','cal-backup.spec.ts','cal-migration.spec.ts','followup-lifestyle.spec.ts','training-schedule.spec.ts'], workers: 1, timeout: 60000,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }], outputDir: '../../.cache/source-migration-results',
  webServer: { command: `node node_modules/vite/bin/vite.js --config tests/e2e/helpers/v8-migration-vite.config.ts --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`, cwd: '../..', url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
