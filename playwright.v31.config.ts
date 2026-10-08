import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:['v31-transactions.spec.ts','v31-shell.spec.ts'],outputDir:'outputs/v31-core-test-results',use:{baseURL:'http://127.0.0.1:5241',trace:'retain-on-failure'},projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}]});
