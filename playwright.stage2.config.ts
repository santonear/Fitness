import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,outputDir:'test-results/stage2',reporter:[['list'],['json',{outputFile:'.superpowers/test-results/stage2.json'}]],use:{...base.use,baseURL:'http://127.0.0.1:5213'},webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5213 --strictPort',url:'http://127.0.0.1:5213',reuseExistingServer:false}});
