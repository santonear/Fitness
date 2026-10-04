import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
const target=process.env.FITNESS_RELEASE_URL;
if(!target)throw new Error('FITNESS_RELEASE_URL is required');
export default defineConfig({testDir:'./tests/e2e',testMatch:['cal-public.spec.ts','shell.spec.ts','dashboard.spec.ts'],workers:2,timeout:90000,
  outputDir:`./test-results/release-${process.env.FITNESS_RELEASE_STAGE??'preview'}`,
  reporter:[['list'],['json',{outputFile:`./test-results/release-${process.env.FITNESS_RELEASE_STAGE??'preview'}.json`}]],
  use:{baseURL:target,viewport:{width:320,height:700},trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
});
