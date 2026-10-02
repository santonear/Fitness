import { defineConfig } from '@playwright/test';
// Playwright enables color in child processes; avoid conflicting inherited flags.
delete process.env.NO_COLOR;
export default defineConfig({ testDir: './tests/e2e', use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 320, height: 700 }, trace: 'retain-on-failure' }, projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }], webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false } });
