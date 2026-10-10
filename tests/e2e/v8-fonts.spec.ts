import { expect, test } from '@playwright/test';
test('local fonts load without external requests and are reusable with network offline',async({page,context,baseURL})=>{
 const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith(baseURL!)) external.push(r.url());});
 await page.goto('/tests/fixtures/v8-components/index.html');
 await page.addStyleTag({url:'/src/themes/fonts/fonts.css'});
 const loaded=await page.evaluate(async()=>{await document.fonts.load('300 16px "Noto Sans SC"','训练');await document.fonts.load('400 22px "Noto Serif SC"','深蹲');return document.fonts.check('300 16px "Noto Sans SC"','训练')&&document.fonts.check('400 22px "Noto Serif SC"','深蹲');});
 expect(loaded).toBe(true);expect(external).toEqual([]);
 await context.setOffline(true);await page.getByRole('button',{name:'深蹲 · 20 kg × 8'}).click(); await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.evaluate(()=>document.fonts.check('300 16px "Noto Sans SC"','训练'))).toBe(true);
});
