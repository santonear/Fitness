import {test,expect} from '@playwright/test';
import {completedPlanningProfile} from './planning-profile-fixture';
const receipt='a'.repeat(64),id='0fb6e661-e282-49ef-bcc6-bcb31c3e9836';
const status={expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true};
for(const automatic of [false,true])test(`coach recovers direct activation ${automatic?'on opening':'on refresh'} without losing draft or sending AI`,async({page})=>{
 let approved=false,claimed=false,claims=0,modelCalls=0;
 await page.addInitScript(receipt=>{localStorage.setItem('fitness.language','en');localStorage.setItem('fitness-trial-application-receipt-v1',receipt);},receipt);
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(/goals\/interpret|plans\/generate/.test(path)){modelCalls++;return route.abort();}
  if(path.endsWith('/status'))return route.fulfill(claimed?{json:status}:{status:401,json:{error:'QUALIFICATION_REQUIRED'}});
  if(path.endsWith('/applications')){expect(route.request().postDataJSON()).toEqual({receipt});return route.fulfill({json:[{id,kind:'new',state:approved?'approved':'pending',directlyActivated:approved,createdAt:1,claimUntil:Date.now()+86400000}]});}
  if(path.endsWith('/claim')){expect(route.request().postDataJSON()).toEqual({receipt,id});claims++;claimed=true;return route.fulfill({json:{}});}
  return route.fulfill({status:503,json:{error:'UNEXPECTED'}});
 });
 await completedPlanningProfile(page);await page.goto('/plans');expect(claims).toBe(0);approved=automatic;await page.getByRole('button',{name:'Open AI coach',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'AI coach conversation'});
 if(!automatic){
  await expect(dialog.locator('.v31-ai-access')).toContainText('Access and allowance unknown');
  await dialog.getByRole('textbox',{name:'Training goal and constraints',exact:true}).fill('Keep this unsent goal');
  await dialog.getByRole('textbox',{name:'Reply to your coach',exact:true}).fill('Keep this unsent reply');
  expect(claims).toBe(0);approved=true;await dialog.getByRole('button',{name:'Refresh access',exact:true}).click();
 }
 await expect(dialog.locator('.v31-ai-access')).toContainText('AI service available');
 if(automatic)await dialog.getByRole('textbox',{name:'Training goal and constraints',exact:true}).fill('Build strength');
 await expect(dialog.getByRole('button',{name:'Agree to send and understand goal',exact:true})).toBeEnabled();
 if(!automatic){await expect(dialog.getByRole('textbox',{name:'Training goal and constraints',exact:true})).toHaveValue('Keep this unsent goal');await expect(dialog.getByRole('textbox',{name:'Reply to your coach',exact:true})).toHaveValue('Keep this unsent reply');}
 await dialog.getByRole('button',{name:'Refresh access',exact:true}).click();await expect(dialog.locator('.v31-ai-access')).toContainText('AI service available');
 expect(claims).toBe(1);expect(modelCalls).toBe(0);await expect(page).toHaveURL(/\/plans$/);
});
