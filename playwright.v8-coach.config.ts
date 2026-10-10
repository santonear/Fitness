import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'v8-coach-panel.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:5284',browserName:'chromium'},webServer:{env:{VITE_FITNESS_V8:'1'},command:'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5284 --strictPort',url:'http://127.0.0.1:5284',reuseExistingServer:true}});

