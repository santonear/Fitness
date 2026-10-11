// Isolated browser test of the actual React component; synthetic notice, no production or Access claims.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer as createHttpServer} from 'node:http';
const now=Date.now(),notice={text:'芽芽暂时休息，训练和记录不受影响。',start:now-1000,end:now+86400000};
let requests=0;
const server=await createServer({cacheDir:".cache/finance-browser",server:{middlewareMode:true},optimizeDeps:{include:["react","react-dom/client"]}});
const http=createHttpServer(async(request,response)=>{
 if(request.url?.startsWith('/__finance-banner'))return fixture(request,response);
 if(request.url==='/api/v1/announcement'){requests++;response.setHeader('Content-Type','application/json');response.end(JSON.stringify({announcement:notice}));return}
 server.middlewares(request,response);
});
async function fixture(_request,response){
 const html=await server.transformIndexHtml('/__finance-banner',`<html lang="zh"><body><main id="fixture"></main><script type="module" src="/tests/admin/finance-banner-fixture.tsx"></script></body></html>`);
 response.setHeader('Content-Type','text/html');response.end(html);
}
let browser;
try{
 await new Promise(resolve=>http.listen(5198,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:320,height:700}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.goto('http://127.0.0.1:5198/__finance-banner');await page.getByText(notice.text).waitFor();
 assert.equal(await page.locator('.maintenance-line').isVisible(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>window.renderBanner(true));await page.waitForFunction(()=>!document.querySelector('.maintenance-line'));const before=requests;await page.waitForTimeout(100);assert.equal(requests,before);
 await page.evaluate(()=>window.renderBanner(false));await page.getByText(notice.text).waitFor();await page.getByRole('button',{name:'关闭公告'}).click();await page.waitForFunction(()=>!document.querySelector('.maintenance-line'));
 await page.evaluate(()=>window.renderBanner(false));assert.equal(await page.locator('.maintenance-line').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: real MaintenanceBanner at 320px; training hides; same notice remains dismissed on rerender. Synthetic endpoint only.');
}finally{await browser?.close();await server.close();await new Promise(resolve=>http.close(resolve))}


