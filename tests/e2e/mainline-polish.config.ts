import {defineConfig} from '@playwright/test';
const url=process.env.POLISH_BASE_URL,port='5339';
export default defineConfig({testDir:'.',testMatch:'mainline-polish.spec.ts',workers:1,timeout:60000,
 use:{baseURL:url??`http://127.0.0.1:${port}`,trace:'retain-on-failure'},
 projects:[{name:'375',use:{browserName:'chromium',viewport:{width:375,height:812}}},{name:'1280',use:{browserName:'chromium',viewport:{width:1280,height:900}}}],
 outputDir:'../../.cache/mainline-polish-results',
 webServer:url?undefined:{command:`node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`,env:{VITE_GUIDED_DEMO:'0'},cwd:'../..',url:`http://127.0.0.1:${port}`,reuseExistingServer:false}});
