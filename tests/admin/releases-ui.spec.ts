import {test,expect} from '@playwright/test';
const fixture=()=>({environment:'production',adapterAvailable:true,features:[{name:'errorReports',sensitive:true,states:[{environment:'preview',enabled:null,pending:false,changedBy:null,changedAt:null},{environment:'production',enabled:false,pending:false,changedBy:'admin@example.test',changedAt:'2026-10-11T10:00:00Z'}]}],registered:[{environment:'production',dataVersion:11,current:{id:'release-current',publishedAt:'2026-10-11T10:00:00Z',compatibleDataVersion:11},previous:{id:'release-previous',publishedAt:'2026-10-10T10:00:00Z',compatibleDataVersion:11}}],releases:[],smoke:[],prompts:[],promptTasks:['ONBOARD_PLAN'],registeredPromptVersions:['v8.1.0','v8.0.0'],history:[]});
test('sensitive change requires explicit confirmation and same request survives freshness/retry',async({page})=>{
 const bodies:{id:string;body:unknown}[]=[];let attempts=0;
 await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='GET')return route.fulfill({json:fixture()});bodies.push({id:route.request().headers()['x-request-id'],body:route.request().postDataJSON()});attempts++;return route.fulfill({status:attempts===1?401:200,json:attempts===1?{error:'FRESH_ACCESS_REQUIRED'}:{status:'applied'}});});
 await page.goto('/harness');await page.getByRole('button',{name:'开启',exact:true}).click();expect(bodies).toHaveLength(0);await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'重新验证身份'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'重试同一次'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);
});
test('one-click disable has no freshness requirement and unknown retry reuses request',async({page})=>{
 const ids:string[]=[];await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='GET')return route.fulfill({json:fixture()});ids.push(route.request().headers()['x-request-id']);return route.fulfill({status:ids.length===1?503:200,json:ids.length===1?{error:'OPERATION_RESULT_UNKNOWN'}:{status:'applied'}});});
 await page.goto('/harness');await page.getByRole('button',{name:'关闭',exact:true}).click();await expect(page.getByRole('button',{name:'重试同一次'})).toBeVisible();expect(ids).toHaveLength(1);await page.getByRole('button',{name:'重试同一次'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(ids[1]).toBe(ids[0]);
});
test('console disable removes stale controls if the next read is unavailable',async({page})=>{
 let disabled=false;const data=fixture();data.features[0].name='adminConsole';data.features[0].sensitive=false;
 await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='POST'){disabled=true;return route.fulfill({json:{status:'applied'}});}return route.fulfill(disabled?{status:404,json:{error:'NOT_FOUND'}}:{json:data});});
 await page.goto('/harness');await expect(page.getByRole('heading',{name:'新版后台'})).toBeVisible();await expect(page.getByText('关闭后停止访问新版后台；需要通过受控维护重新开启。')).toBeVisible();await page.getByRole('button',{name:'关闭',exact:true}).click();await expect(page.getByRole('alert')).toContainText('后台可能已关闭');await expect(page.getByRole('button',{name:'开启',exact:true})).toHaveCount(0);
});
test('rollback then renders checks and prompt rollback submits registered version',async({page})=>{
 const data=fixture();let posted:Record<string,unknown>|null=null;await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='GET')return route.fulfill({json:data});posted=route.request().postDataJSON();return route.fulfill({json:{status:'applied'}});});
 await page.goto('/harness');await page.getByRole('button',{name:'回滚到上一版本'}).click();await expect(page.getByRole('dialog')).toContainText('不回退数据库');await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(posted).toMatchObject({target:'release-previous',expectedCurrent:'release-current',confirmed:true});
 await page.goto('/harness?prompts');await page.getByRole('combobox').selectOption('v8.0.0');await page.getByRole('button',{name:'切换到所选版本'}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(posted).toMatchObject({task:'ONBOARD_PLAN',version:'v8.0.0',confirmed:true});
});
for(const width of [320,390,1024,1440])test(`layout ${width} stays within viewport`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await page.route('**/api/v1/management/console/releases',route=>route.fulfill({json:fixture()}));await page.goto('/harness');await expect(page.getByRole('heading',{name:'开关与发布'})).toBeVisible();await expect(page.getByRole('heading',{name:'错误统计'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390||width===1440)await page.screenshot({path:testInfo.outputPath(`releases-${width}.png`),fullPage:true});
});
