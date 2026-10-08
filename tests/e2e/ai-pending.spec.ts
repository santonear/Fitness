import { completedPlanningProfile } from './planning-profile-fixture';
import { test, expect } from '@playwright/test';
import { validateGuidedProviderOutput } from '../../src/backend/guided-provider';
for (const locale of ['en', 'zh'] as const) test(`${locale} pending understanding survives unknown status without releasing accounting or resending`, async ({page}) => {
 const t=(en:string,zh:string)=>locale==='zh'?zh:en;let calls=0,unknown=false;
 await page.route('**/api/v1/**',async route=>{
 if(route.request().method()==='GET')return route.fulfill(unknown?{status:503,json:{error:'CONTROL_UNAVAILABLE'}}:{json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:1,generate:0},limits:{understand:8,generate:4},pending:calls,reconciliationRequired:calls>0,aiEnabled:true}});
 calls++;const body=route.request().postDataJSON();return route.fulfill({json:{requestId:body.requestId,accounting:'pending',result:validateGuidedProviderOutput(body.dialogue,{kind:'understand',summary:'Retained understanding',uncertainties:[]}),context:{restoreGeneration:body.restoreGeneration,inputDigest:body.sendConfirmation}}});});
 await page.addInitScript(locale=>localStorage.setItem('fitness.language',locale),locale);await completedPlanningProfile(page);await page.goto('/ai');
 await page.getByRole('textbox',{name:t('Training goal and constraints','训练目标与约束'),exact:true}).fill('Regular walking');
 await page.getByRole('checkbox',{name:/I reviewed this information|我已核对上述内容/}).check();
 await page.getByRole('button',{name:t('Understand goal','理解目标'),exact:true}).click();
 await expect(page.getByText('Retained understanding',{exact:true})).toBeVisible();unknown=true;
 await page.getByRole('button',{name:t('Refresh access','刷新资格'),exact:true}).click();
 await expect(page.getByText(/Access and allowance unknown|资格及额度未知/)).toBeVisible();
 await expect(page.getByText('Retained understanding',{exact:true})).toBeVisible();expect(calls).toBe(1);
 await expect(page.getByText(/reserved budget has not been released|预留预算尚未释放/)).toBeVisible();
 await expect(page.getByRole('button',{name:t('Understand goal','理解目标'),exact:true})).toBeDisabled();
});
