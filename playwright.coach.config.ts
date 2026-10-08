import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testIgnore:[],workers:2,use:{...base.use,baseURL:'http://127.0.0.1:5189'},webServer:{command:'node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5189 --strictPort',env:{VITE_GUIDED_DEMO:'0'},url:'http://127.0.0.1:5189',reuseExistingServer:false}});
