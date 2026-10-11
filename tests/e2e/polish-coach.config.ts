import { defineConfig } from '@playwright/test';
const port=process.env.V8_COACH_PORT??'5318';
export default defineConfig({
 testDir:'.',testMatch:['polish-coach.spec.ts','v8-coach-panel.spec.ts'],workers:1,
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:390,height:844},trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{browserName:'chromium'}}],outputDir:'../../.cache/polish-coach-results',
 webServer:{command:`node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`,env:{VITE_GUIDED_DEMO:'0'},cwd:'../..',url:`http://127.0.0.1:${port}`,reuseExistingServer:false},
});
