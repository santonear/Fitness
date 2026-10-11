import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const port=process.env.ADMIN_INTEGRATION_PORT??'5397';
export default defineConfig({testDir:'.',testMatch:'integration-browser.spec.ts',outputDir:'../../test-results/admin-integration',workers:1,fullyParallel:false,use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:390,height:844},trace:'retain-on-failure'},projects:[{name:'chromium',use:{browserName:'chromium'}}],webServer:{cwd:fileURLToPath(new URL('../../',import.meta.url)),command:'node tests/admin/integration-browser-server.mjs',url:`http://127.0.0.1:${port}/__test/ready`,reuseExistingServer:false,timeout:60000}});
