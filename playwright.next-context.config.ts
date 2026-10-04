import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({testDir:'./tests/e2e',testMatch:'next-context.spec.ts',outputDir:'test-results/next-context',workers:1,use:{baseURL:'http://127.0.0.1:5203'},projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5203 --strictPort',url:'http://127.0.0.1:5203',reuseExistingServer:true}});
