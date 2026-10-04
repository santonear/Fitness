import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
export default defineConfig({
 testDir:'./tests/e2e', timeout:60000, workers:2, outputDir:'./test-results/vis', reporter:[['list'],['json',{outputFile:'test-results/vis-report.json'}]],
 use:{baseURL:'http://127.0.0.1:5188',locale:'en-US',trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort',url:'http://127.0.0.1:5188',reuseExistingServer:false},
});
