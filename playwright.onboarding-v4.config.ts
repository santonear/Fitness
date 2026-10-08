import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'onboarding-v4*.spec.ts',outputDir:'outputs/onboarding-v4/tests',workers:2,
 use:{baseURL:'http://127.0.0.1:5245',trace:'retain-on-failure'},projects:[{name:'chromium',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},{name:'webkit',use:{browserName:'webkit',viewport:{width:390,height:844}}}],
 webServer:{command:'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5245 --strictPort',env:{VITE_GUIDED_DEMO:'0'},url:'http://127.0.0.1:5245',reuseExistingServer:!process.env.CI}});
