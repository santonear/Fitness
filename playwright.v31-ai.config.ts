import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'./tests/e2e', testMatch:'v31-ai.spec.ts', outputDir:'./test-results-v31-ai', workers:1,
  use:{baseURL:'http://127.0.0.1:5241', trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},{name:'webkit-mobile',use:{browserName:'webkit',viewport:{width:390,height:844}}}],
});
