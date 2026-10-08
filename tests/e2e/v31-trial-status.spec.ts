import { expect, test } from '@playwright/test';
const base={expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},aiEnabled:true,pending:0,resetAt:1793462400000,timeZone:'Asia/Shanghai',maxDays:7,maximumRequestCost:300,budgetAvailable:{understand:true,generate:true}};
for(const state of ['active','expired','revoked','none','session-missing','quota','budget','pending','unavailable','query-failed'] as const) test(`trial truthful state ${state}`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));
 let modelCalls=0,writes=0;
 await page.route('**/api/v1/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(/goals\/interpret|plans\/generate/.test(path))modelCalls++;
  if(route.request().method()==='POST'&&!path.endsWith('/access-status'))writes++;
  if(path.endsWith('/application-config'))return route.fulfill({json:{available:true,siteKey:null}});
  if(path.endsWith('/status')){
   if(['expired','revoked','none','session-missing'].includes(state))return route.fulfill({status:401,json:{error:'QUALIFICATION_REQUIRED'}});
   if(state==='query-failed')return route.fulfill({status:503,json:{error:'CONTROL_UNAVAILABLE'}});
   return route.fulfill({json:{...base,...(state==='quota'?{used:{understand:8,generate:4}}:{}),...(state==='budget'?{budgetAvailable:{understand:false,generate:false}}:{}),...(state==='pending'?{pending:1,reconciliationRequired:true}:{}),...(state==='unavailable'?{aiEnabled:false}:{})}});
  }
  if(path.endsWith('/access-status'))return route.fulfill({json:state==='none'?{qualification:'none',sessionValid:false}:{...base,qualification:state==='session-missing'?'active':state,sessionValid:false}});
  return route.fulfill({status:503,json:{error:'UNEXPECTED'}});
 });
 await page.goto('/trial');
 const start=page.getByRole('button',{name:'Start planning your training',exact:true});
 if(state==='none'){await expect(page.getByText('No verified trial on this browser.',{exact:false})).toBeVisible();await expect(start).toHaveCount(0);}
 else if(state==='query-failed'){await expect(page.getByRole('alert')).toContainText('status is unknown');await expect(page.locator('.v31-quota')).toHaveCount(0);}
 else {
  await expect(page.getByText('Select up to 7 training dates per request')).toBeVisible();
  await expect(page.getByText('Per-request cost limit: ¥3.00')).toBeVisible();
  await expect(page.getByText('Quota resets:',{exact:false})).toHaveCount(0);await expect(page.locator('.v31-quota')).toHaveCount(0);
  if(state==='active')await expect(start).toBeEnabled();else await expect(start).toBeDisabled();
  if(state==='expired')await expect(page.getByText('Trial expired — request an extension')).toBeVisible();
  if(state==='revoked')await expect(page.getByText('Access revoked — contact the administrator')).toBeVisible();
  if(state==='session-missing')await expect(page.getByRole('button',{name:'Request replacement / change device'})).toBeVisible();
  if(state==='quota')await expect(page.getByText('Personal quota exhausted.',{exact:false})).toBeVisible();
  if(state==='budget')await expect(page.getByText('Project budget is insufficient',{exact:false})).toBeVisible();
  if(state==='pending')await expect(page.getByText('Reconciliation required; requests paused')).toBeVisible();
  if(state==='unavailable')await expect(page.getByText('Model disabled; local training stays available')).toBeVisible();
 }
 expect(modelCalls).toBe(0);expect(writes).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('application lifecycle remains visible with receipt ownership and no automatic claim',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('fitness.language','en');localStorage.setItem('fitness-trial-application-receipt-v1','a'.repeat(64));});
 let mutations=0;
 await page.route('**/api/v1/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(route.request().method()==='POST'&&!/\/(access-status|applications)$/.test(path))mutations++;
  if(path.endsWith('/status'))return route.fulfill({status:401,json:{error:'QUALIFICATION_REQUIRED'}});
  if(path.endsWith('/access-status'))return route.fulfill({json:{qualification:'none',sessionValid:false}});
  if(path.endsWith('/application-config'))return route.fulfill({json:{available:true,siteKey:null}});
  if(path.endsWith('/applications'))return route.fulfill({json:[{id:'b59d347e-0c40-4ac9-9e56-27217b9c9eb8',kind:'extend',state:'pending',createdAt:Date.now()},{id:'e5673bda-a8d7-4b62-a693-a67d51cbb42c',kind:'replace',state:'pending',createdAt:Date.now()},{id:'0fb6e661-e282-49ef-bcc6-bcb31c3e9836',kind:'new',state:'approved',createdAt:Date.now(),claimUntil:Date.now()+86400000}]});
  return route.fulfill({status:503,json:{error:'UNEXPECTED'}});
 });
 await page.goto('/trial');
 await expect(page.getByText('Extension · Awaiting review')).toBeVisible();
 await expect(page.getByText('Replacement · Awaiting review')).toBeVisible();
 await expect(page.getByRole('button',{name:'Claim and activate'})).toBeEnabled();
 expect(mutations).toBe(0);
});
