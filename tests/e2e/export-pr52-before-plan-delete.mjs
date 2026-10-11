import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const baseURL='https://fitness-mainline-polish-preview.initdevl.workers.dev';
const target=new URL('../fixtures/legacy-backups/pr52-before-plan-delete.json',import.meta.url);
const browser=await chromium.launch();
try {
 const context=await browser.newContext({baseURL,viewport:{width:375,height:812},acceptDownloads:true});const page=await context.newPage();
 let aiCalls=0;await page.route('**/api/v1/plans/generate',route=>{aiCalls++;return route.abort();});
 await page.goto('/onboarding');
 for(const text of ['保持力量','每周3次，每次30分钟','在家，只有瑜伽垫']){await page.getByLabel('你的回答').fill(text);await page.getByRole('button',{name:'继续',exact:true}).click();}
 await page.getByLabel('我已年满 18 岁',{exact:false}).check();await page.getByRole('button',{name:'生成我的第一版计划',exact:true}).click();await page.getByRole('button',{name:'就用这份计划',exact:true}).click();
 await page.getByRole('button',{name:'开始训练',exact:true}).first().click();await page.getByRole('button',{name:'完成这一组',exact:true}).click();await page.getByRole('button',{name:'暂停或结束',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'结束并记下',exact:true}).click();await page.getByRole('button',{name:'记下来',exact:true}).click();
 await expect(page.locator('.v8-facts dd')).toHaveCount(5);await page.goto('/settings');await page.getByRole('button',{name:'备份恢复',exact:true}).click();
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON 备份',exact:true}).click();const download=await downloaded;const bytes=await readFile(await download.path());const payload=JSON.parse(bytes.toString('utf8'));
 expect(payload.schemaVersion).toBe(8);expect(payload.data.metadata.schemaVersion).toBe(10);expect(payload.data.v8.plans).toHaveLength(1);expect(payload.data.v8.workouts).toHaveLength(1);expect(payload.data.v8.workouts[0].sets).toHaveLength(1);expect(aiCalls).toBe(0);
 await writeFile(target,bytes);
 await writeFile(new URL('../fixtures/legacy-backups/pr52-before-plan-delete.manifest.json',import.meta.url),JSON.stringify({sourceUrl:baseURL,sourceCommit:'687a048',workerVersion:'10f4af19-9b80-4375-b773-e4f672a4ebdd',generatedAt:new Date().toISOString(),method:'Fresh Chromium context; real onboarding, local plan acceptance, one recorded set, finish, Settings > Export JSON backup download. No DB injection or JSON rewrite.',synthetic:true,aiCalls,envelopeVersion:payload.schemaVersion,databaseVersion:payload.data.metadata.schemaVersion,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,downloadFilename:download.suggestedFilename(),generator:'tests/e2e/export-pr52-before-plan-delete.mjs'},null,2)+'\n');
 console.log(JSON.stringify({saved:target.pathname,envelope:payload.schemaVersion,database:payload.data.metadata.schemaVersion,bytes:bytes.length,aiCalls}));
} finally {await browser.close();}
