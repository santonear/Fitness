import { completedPlanningProfile } from './planning-profile-fixture';
import {test,expect} from '@playwright/test';
for(const locale of ['en','zh'])test(`${locale} qualification refreshes automatically; failures clear previous remaining allowance`,async({page})=>{
 const t=(en:string,zh:string)=>locale==='zh'?zh:en;const calls:string[]=[];let outcome='QUALIFICATION_REQUIRED';
 await page.route('**/api/v1/**',route=>{calls.push(route.request().method());return route.fulfill(outcome==='ok'?{json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:2,generate:1},limits:{understand:8,generate:4},pending:1,aiEnabled:false}}:{status:401,json:{error:outcome}});});
 await page.addInitScript(locale=>localStorage.setItem('fitness.language',locale),locale);await completedPlanningProfile(page);calls.length=0;await page.goto('/ai');
 await expect(page.getByText(/Access and allowance unknown|资格及额度未知/)).toBeVisible();await expect.poll(()=>calls.length).toBeGreaterThanOrEqual(1);await expect(page.getByRole('button',{name:t('Understand goal','理解目标'),exact:true})).toBeDisabled();
 await expect(page.getByRole('link',{name:t('Trial access / invitation','试用资格 / 邀请码')})).toHaveAttribute('href','/trial');
 outcome='ok';await page.getByRole('button',{name:t('Refresh access','刷新资格')}).click();await expect(page.getByText(/6 \/ 3/)).toBeVisible();
 await page.reload();await expect(page.getByText(/6 \/ 3/)).toBeVisible();
 outcome='SUBJECT_EXPIRED';await page.getByRole('button',{name:t('Refresh access','刷新资格')}).click();
 await expect(page.getByRole('alert')).toContainText(t('trial has expired','试用已到期'));
 await expect(page.getByText(/Access and allowance unknown|资格及额度未知/)).toBeVisible();await expect(page.getByText(/6 \/ 3/)).toHaveCount(0);
 expect(calls.every(method=>method==='GET')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('static site without control API does not fabricate qualification',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));
 await page.route('**/api/v1/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<html>static app</html>'}));await completedPlanningProfile(page);await page.goto('/ai');
 await expect(page.getByText('Access and allowance unknown. Refresh or check trial access.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Understand goal',exact:true})).toBeDisabled();
});
for(const [code,message] of [['INDIVIDUAL_QUOTA_EXHAUSTED','trial request allowance is exhausted'],['GLOBAL_BUDGET_EXHAUSTED','not a personal payment request'],['ACCOUNTING_PENDING','reserved budget has not been released'],['RESULT_UNAVAILABLE','new confirmed request may use another allowance']])test(`confirmed understanding distinguishes ${code} without automatic retry or history sending`,async({page})=>{
 let submitted=0;await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));
 await page.route('**/api/v1/**',route=>{if(route.request().method()==='GET')return route.fulfill({json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true}});
 submitted++;const input=route.request().postDataJSON();expect(input).toMatchObject({operation:'understand',goalText:'Steady general fitness',locale:'en'});expect(input.dialogue.scope).not.toHaveProperty('history');expect(input.dialogue.scope).not.toHaveProperty('body');return route.fulfill({status:503,json:{error:code}});});
 await completedPlanningProfile(page);await page.goto('/ai');const goal=page.getByRole('textbox',{name:'Training goal and constraints',exact:true});await goal.fill('Steady general fitness');
 await expect(page.getByRole('button',{name:'Understand goal',exact:true})).toBeDisabled();expect(submitted).toBe(0);
 await page.getByRole('checkbox',{name:/I reviewed this information/}).check();await page.getByRole('button',{name:'Understand goal',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(message);expect(submitted).toBe(1);await expect(goal).toHaveValue('Steady general fitness');
});
