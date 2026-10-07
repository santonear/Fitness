import { completedPlanningProfile } from './planning-profile-fixture';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => completedPlanningProfile(page));
import { validateGuidedProviderOutput } from '../../src/backend/guided-provider';
for (const locale of ['en', 'zh'] as const) test(`${locale} pending understanding survives unknown status without releasing accounting or resending`, async ({page}) => {
  const t=(en:string,zh:string)=>locale==='zh'?zh:en;
  let calls=0, unknown=false;
  await page.route('**/api/v1/**',async route=>{
    if(route.request().method()==='GET')return route.fulfill(unknown ? {status:503,json:{error:'CONTROL_UNAVAILABLE'}} : {json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:1,generate:0},limits:{understand:8,generate:4},pending:calls,reconciliationRequired:calls>0,aiEnabled:true}});
    calls++; const body=route.request().postDataJSON();
    return route.fulfill({json:{requestId:body.requestId,accounting:'pending',result:validateGuidedProviderOutput(body.dialogue,{kind:'understand',summary:'Retained understanding',uncertainties:[]}),context:{restoreGeneration:body.restoreGeneration,inputDigest:body.sendConfirmation}}});
  });
  await page.addInitScript(locale=>localStorage.setItem('fitness.language',locale),locale);
  await page.goto('/ai');
  await page.getByRole('button',{name:t('Check access and allowance','查询资格与额度')}).click();
  await page.getByRole('textbox',{name:t('goal, clarification or changes','目标、补充或调整想法'),exact:true}).fill('Regular walking');
  await page.getByRole('button',{name:t('Send','发送'),exact:true}).click();
  await page.getByText(t('Goal and optional information','目标与可选资料'),{exact:true}).click();
  const summary=page.getByRole('textbox',{name:t('goal interpretation','目标理解'),exact:true});
  await expect(summary).toHaveValue('Retained understanding');
  await summary.fill('Edited retained understanding');
  unknown=true;
  await page.getByRole('button',{name:t('Check access and allowance','查询资格与额度')}).click();
  await expect(page.getByText(t('Access and allowance are unknown','资格及额度查询失败，请重试'))).toBeVisible();
  await expect(summary).toHaveValue('Edited retained understanding');
  expect(calls).toBe(1);
  await expect(page.getByRole('status').filter({hasText:/awaiting accounting|待核算/})).toBeVisible();
});
