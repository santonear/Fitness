import {defineConfig} from '@playwright/test';
const port=process.env.TRAINING_ENGINE_TEST_PORT??'5397';
export default defineConfig({
 testDir:'.',testMatch:'training-engine.spec.ts',workers:1,timeout:120000,
 outputDir:'../../.cache/training-engine-browser-results',
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:375,height:844},trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{browserName:'chromium'}}],
 webServer:{command:`node node_modules/vite/bin/vite.js --config tests/e2e/helpers/training-engine-vite.config.ts --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`,cwd:'../..',url:`http://127.0.0.1:${port}`,reuseExistingServer:false},
});
