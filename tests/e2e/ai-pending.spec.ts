import { test, expect } from '@playwright/test';
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
  await page.getByRole('button',{name:t('preview scope for understanding','预览理解目标的发送范围')}).click();
  await page.getByRole('button',{name:t('confirm sending','确认发送'),exact:true}).click();
  await page.getByText(t('review the goal and exact dates','核对目标和具体日期'),{exact:true}).click();
  const summary=page.getByRole('textbox',{name:t('goal interpretation','目标理解'),exact:true});
  await expect(summary).toHaveValue('Retained understanding');
  await summary.fill('Edited retained understanding');
  unknown=true;
  await page.getByRole('button',{name:t('Check access and allowance','查询资格与额度')}).click();
  await expect(page.getByText(t('Access and allowance are unknown','资格及额度尚未确认'))).toBeVisible();
  await expect(summary).toHaveValue('Edited retained understanding');
  expect(calls).toBe(1);
  await expect(page.getByRole('status').filter({hasText:/awaiting accounting|待核算/})).toBeVisible();
});
