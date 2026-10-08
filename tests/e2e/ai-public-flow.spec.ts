import {test,expect} from '@playwright/test';
for(const locale of ['en','zh'] as const)test(`${locale} invitation redemption sends code only; activation does not call AI or create training facts`,async({page})=>{
 const t=(en:string,zh:string)=>locale==='zh'?zh:en;let redeemed=false;const posts:{path:string;body:any}[]=[];
 await page.addInitScript(locale=>localStorage.setItem('fitness.language',locale),locale);
 await page.route('**/api/v1/**',route=>{const path=new URL(route.request().url()).pathname;if(route.request().method()==='POST')posts.push({path,body:route.request().postDataJSON()});
 if(path.endsWith('/application-config'))return route.fulfill({json:{available:false,siteKey:null}});
 if(path.endsWith('/access-status'))return route.fulfill({json:{qualification:'none',sessionValid:false}});
 if(path.endsWith('/redeem')){redeemed=true;return route.fulfill({json:{}});}
 if(path.endsWith('/status'))return route.fulfill(redeemed?{json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true}}:{status:401,json:{error:'QUALIFICATION_REQUIRED'}});
 return route.fulfill({status:503,json:{error:'UNEXPECTED_REQUEST'}});});
 await page.goto('/trial');await page.getByLabel(t('Your name','用户名（称呼）'),{exact:true}).fill('Local-only name');await page.getByLabel(t('Invitation code','邀请码'),{exact:true}).fill('a'.repeat(64));
 await page.getByRole('button',{name:t('Activate and start planning','启用并开始制定计划'),exact:true}).click();await expect(page).toHaveURL(/\/ai$/);
 expect(posts.filter(call=>!call.path.endsWith('/access-status'))).toEqual([{path:'/api/v1/trial/redeem',body:{code:'a'.repeat(64)}}]);
 expect(await page.evaluate(async()=>{const path='/src/persistence/db.ts';const{database}=await import(/* @vite-ignore */path);return[await database.sessions.count(),await database.sets.count(),await database.scheduledWorkouts.count()];})).toEqual([0,0,0]);
 expect(await page.evaluate(()=>localStorage.getItem('fitness.trial'))).toBeNull();
});
test('changing goal removes earlier sending consent without an implicit request',async({page})=>{
 let posts=0;await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));await page.route('**/api/v1/**',route=>{if(route.request().method()==='POST')posts++;return route.fulfill({json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true}});});await page.goto('/ai');
 const goal=page.getByRole('textbox',{name:'Training goal and constraints',exact:true});await goal.fill('First goal');const consent=page.getByRole('checkbox',{name:/I reviewed this information/});await consent.check();await expect(page.getByRole('button',{name:'Understand goal',exact:true})).toBeEnabled();await goal.fill('Changed goal');await expect(consent).not.toBeChecked();await expect(page.getByRole('button',{name:'Understand goal',exact:true})).toBeDisabled();expect(posts).toBe(0);
});
