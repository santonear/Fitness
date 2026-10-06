import {test,expect} from '@playwright/test';
for(const locale of ['en','zh'])test(`${locale} control is opt-in and failures remain unknown`,async({page})=>{
 const t=(en:string,zh:string)=>locale==='zh'?zh:en;
 const calls:{path:string;body:string|null}[]=[];let outcome='QUALIFICATION_REQUIRED';
 await page.route('**/api/v1/**',async route=>{
  calls.push({path:new URL(route.request().url()).pathname,body:route.request().postData()});
  const body=outcome==='ok'?{expiresAt:Date.UTC(2027,0,1),period:'2026-10',used:{understand:2,generate:1},limits:{understand:8,generate:4},pending:1,aiEnabled:false}:{error:outcome};
  await route.fulfill({status:outcome==='ok'?200:401,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/ai');await page.getByRole('combobox').first().selectOption(locale);
 await expect(page.getByRole('button',{name:t('Connect to backend','连接后端'),exact:true})).toBeVisible();expect(calls).toHaveLength(0);
 await page.getByRole('button',{name:t('Connect to backend','连接后端'),exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(t('Redeem an invitation','请兑换邀请码'));
 expect(calls).toEqual([{path:'/api/v1/trial/status',body:null}]);
 await expect(page.getByLabel(t('Invitation code','邀请码'),{exact:true})).toBeEnabled();
 outcome='ok';await page.getByRole('button',{name:t('Refresh qualification','刷新资格'),exact:true}).click();
 await expect(page.getByText(/2\/8.*1\/4/)).toBeVisible();
 await expect(page.getByText(t('In-flight / awaiting accounting','在途／待核算'),{exact:false})).toContainText('1');
 await expect(page.getByLabel(t('Goal text','目标文本'),{exact:true})).toBeDisabled();
 outcome='SUBJECT_EXPIRED';await page.getByRole('button',{name:t('Refresh qualification','刷新资格'),exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(t('trial has expired','试用已到期'));
 await expect(page.getByText(t('Qualification and remaining quota: unknown.','资格和剩余额度：未知。'),{exact:true})).toBeVisible();
 await expect(page.getByText(/2\/8.*1\/4/)).toHaveCount(0);
 expect(calls.every(call=>call.body===null&&call.path==='/api/v1/trial/status')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('static site without control API does not fabricate qualification',async({page})=>{
 await page.route('**/api/v1/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<html>static app</html>'}));
 await page.goto('/ai');await page.getByRole('button',{name:'Connect to backend',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Backend status is unknown');
 await expect(page.getByLabel('Goal text',{exact:true})).toBeDisabled();
});
test('explicit invitation redemption sends only the code and never starts a model request',async({page})=>{
 const calls:{path:string;body:string|null}[]=[];let redeemed=false;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;calls.push({path,body:route.request().postData()});
  if(path.endsWith('/redeem')){redeemed=true;await route.fulfill({status:200,contentType:'application/json',body:'{}'});return;}
  await route.fulfill({status:redeemed?200:401,contentType:'application/json',body:JSON.stringify(redeemed?{expiresAt:Date.UTC(2027,0,1),period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:false}:{error:'QUALIFICATION_REQUIRED'})});
 });
 await page.goto('/ai');await page.getByRole('button',{name:'Connect to backend',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Redeem an invitation');
 await page.getByLabel('Invitation code',{exact:true}).fill('a'.repeat(64));await page.getByRole('button',{name:'Redeem code',exact:true}).click();
 await expect(page.getByText(/0\/8.*0\/4/)).toBeVisible();
 expect(calls.map(call=>call.path)).toEqual(['/api/v1/trial/status','/api/v1/trial/redeem','/api/v1/trial/status']);
 expect(JSON.parse(calls[1].body!)).toEqual({code:'a'.repeat(64)});
 expect(await page.evaluate(()=>localStorage.getItem('fitness.trial'))).toBeNull();
});
for(const [code,message] of [
 ['INDIVIDUAL_QUOTA_EXHAUSTED','trial request allowance is exhausted'],
 ['GLOBAL_BUDGET_EXHAUSTED','not a personal payment request'],
 ['ACCOUNTING_PENDING','reserved budget has not been released'],
 ['RESULT_UNAVAILABLE','new confirmed request may use another allowance'],
])test(`confirmed understanding distinguishes ${code} without retry or history sending`,async({page})=>{
 let submitted=0;
 await page.route('**/api/v1/**',async route=>{
  if(route.request().method()==='GET'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({expiresAt:Date.UTC(2027,0,1),period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true})});return;}
  submitted++;const input=route.request().postDataJSON();
  expect(input).toMatchObject({operation:'understand',goalText:'Steady general fitness',locale:'en'});
  expect(Object.keys(input).sort()).toEqual(['contractVersion','goalText','locale','operation','requestId','restoreGeneration','sendConfirmation'].sort());
  await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:code})});
 });
 await page.goto('/ai');await page.getByRole('button',{name:'Connect to backend',exact:true}).click();
 await expect(page.getByLabel('Goal text',{exact:true})).toBeEnabled();
 await page.getByLabel('Goal text',{exact:true}).fill('Steady general fitness');
 await page.getByRole('button',{name:'Preview goal sending',exact:true}).click();expect(submitted).toBe(0);
 await page.getByLabel('I confirm this sending scope',{exact:true}).check();
 await page.getByRole('button',{name:'Send confirmed request',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(message);expect(submitted).toBe(1);
 await expect(page.getByLabel('Goal text',{exact:true})).toHaveValue('Steady general fitness');
});
