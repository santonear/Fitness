import { defineConfig } from '@playwright/test';
const port=process.env.PLAN_LIFECYCLE_PORT??'5401';
export default defineConfig({
 testDir:'.',testMatch:'plan-lifecycle.spec.ts',workers:1,timeout:45000,
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:375,height:812},trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{browserName:'chromium'}}],outputDir:'../../.cache/plan-lifecycle-results',
 webServer:{command:`node node_modules/vite/bin/vite.js --config tests/e2e/helpers/v8-mainline-vite.config.ts --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`,cwd:'../..',url:`http://127.0.0.1:${port}`,reuseExistingServer:false},
});
