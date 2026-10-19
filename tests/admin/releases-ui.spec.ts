import {test,expect} from '@playwright/test';
const fixture=()=>({environment:'production',adapterAvailable:true,features:[{name:'errorReports',sensitive:true,states:[{environment:'preview',enabled:null,pending:false,changedBy:null,changedAt:null},{environment:'production',enabled:false,pending:false,changedBy:'admin@example.test',changedAt:'2026-10-11T10:00:00Z'}]}],registered:[{environment:'production',dataVersion:11,current:{id:'release-current',publishedAt:'2026-10-11T10:00:00Z',compatibleDataVersion:11},previous:{id:'release-previous',publishedAt:'2026-10-10T10:00:00Z',compatibleDataVersion:11}}],releases:[],smoke:[],prompts:[],promptTasks:['ONBOARD_PLAN','ASSISTANT_CHAT'],registeredPromptVersions:['v8.1.0','v8.0.0','assistant-v3.1.0','assistant-v3.0.0'],history:[]});
test('sensitive change requires explicit confirmation and same request survives freshness/retry',async({page})=>{
 const bodies:{id:string;body:unknown}[]=[];let attempts=0;
 await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='GET')return route.fulfill({json:fixture()});bodies.push({id:route.request().headers()['x-request-id'],body:route.request().postDataJSON()});attempts++;return route.fulfill({status:attempts===1?401:200,json:attempts===1?{error:'FRESH_ACCESS_REQUIRED'}:{status:'applied'}});});
 await page.goto('/harness');await expect(page.getByText('生产当前：关闭')).toBeVisible();await expect(page.getByText('未读取')).toHaveCount(0);await expect(page.getByRole('button',{name:'关闭',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'开启',exact:true}).click();expect(bodies).toHaveLength(0);await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'重新验证身份'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'重试同一次'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);
});
test('disable is confirmed first, needs no freshness, and unknown retry reuses request',async({page})=>{
 const enabled=()=>{const data=fixture();data.features[0].states[1].enabled=true;return data;};
 const ids:string[]=[];await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='GET')return route.fulfill({json:enabled()});ids.push(route.request().headers()['x-request-id']);return route.fulfill({status:ids.length===1?503:200,json:ids.length===1?{error:'OPERATION_RESULT_UNKNOWN'}:{status:'applied'}});});
 await page.goto('/harness');await expect(page.getByText('生产当前：开启')).toBeVisible();await expect(page.getByRole('button',{name:'开启',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'关闭',exact:true}).click();expect(ids).toHaveLength(0);await expect(page.getByRole('dialog')).toContainText('当前：开启 → 关闭');await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'重试同一次'})).toBeVisible();expect(ids).toHaveLength(1);await page.getByRole('button',{name:'重试同一次'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(ids[1]).toBe(ids[0]);
});
test('console disable removes stale controls if the next read is unavailable',async({page})=>{
 let disabled=false;const data=fixture();data.features[0].name='adminConsole';data.features[0].sensitive=false;data.features[0].states[1].enabled=true;
 await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='POST'){disabled=true;return route.fulfill({json:{status:'applied'}});}return route.fulfill(disabled?{status:404,json:{error:'NOT_FOUND'}}:{json:data});});
 await page.goto('/harness');await expect(page.getByRole('heading',{name:'新版后台'})).toBeVisible();await expect(page.getByText('关闭后这个后台立即无法打开；要重新开启，需要在服务器配置里操作。')).toBeVisible();await expect(page.getByText('受控维护')).toHaveCount(0);await page.getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('alert')).toContainText('后台可能已关闭');await expect(page.getByRole('button',{name:'开启',exact:true})).toHaveCount(0);
});
test('rollback then renders checks and prompt rollback submits registered version',async({page})=>{
 const data=fixture();let posted:Record<string,unknown>|null=null;await page.route('**/api/v1/management/console/releases**',async route=>{if(route.request().method()==='GET')return route.fulfill({json:data});posted=route.request().postDataJSON();return route.fulfill({json:{status:'applied'}});});
 await page.goto('/harness');await page.getByRole('button',{name:'回滚到上一版本'}).click();await expect(page.getByRole('dialog')).toContainText('不回退数据库');await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(posted).toMatchObject({target:'release-previous',expectedCurrent:'release-current',confirmed:true});
 await page.goto('/harness?prompts');await page.getByRole('combobox').selectOption('assistant-v3.0.0');await page.getByRole('button',{name:'保存提示词'}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(posted).toMatchObject({task:'ASSISTANT_CHAT',version:'assistant-v3.0.0',confirmed:true});
});
for(const width of [320,390,1024,1440])test(`layout ${width} stays within viewport`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await page.route('**/api/v1/management/console/releases',route=>route.fulfill({json:fixture()}));await page.goto('/harness');await expect(page.getByRole('heading',{name:'开关与发布'})).toBeVisible();await expect(page.getByRole('heading',{name:'错误统计'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390||width===1440)await page.screenshot({path:testInfo.outputPath(`releases-${width}.png`),fullPage:true});
});


test('smoke reasons distinguish Access login blocks from service faults and legacy checks',async({page})=>{
 const base=fixture();const smoke=[{check_id:'application',status:'unavailable',reason:'access_login_required',http_status:302},{check_id:'features',status:'failed',reason:'http_error',http_status:503},{check_id:'managementAccess',status:'passed',reason:'access_protected',http_status:307}].map(row=>({...row,environment:'production',release_id:'release-current',checked_at:'2026-10-12T00:00:00Z'}));
 await page.route('**/api/v1/management/console/releases',route=>route.fulfill({json:{...base,smoke}}));await page.goto('/harness');
 await expect(page.getByText(/应用页面：需要登录，内容未确认/)).toBeVisible();await expect(page.getByText(/功能配置：需要处理.*服务返回错误响应.*503/)).toBeVisible();await expect(page.getByText(/后台登录保护：通过.*登录保护已生效.*307/)).toBeVisible();await expect(page.locator('main')).not.toContainText('Access');
});
test('rollback is disabled with a stated reason when no valid previous version is registered',async({page})=>{
 const data=fixture();delete (data.registered[0] as {previous?:unknown}).previous;
 await page.route('**/api/v1/management/console/releases**',route=>route.fulfill({json:data}));await page.goto('/harness');
 await expect(page.getByRole('button',{name:'回滚到上一版本'})).toBeDisabled();await expect(page.getByText('回滚不可用：没有已登记的上一版本。')).toBeVisible();
 data.registered[0]={...data.registered[0],previous:{id:'release-previous',publishedAt:'2026-10-10T10:00:00Z'}} as typeof data.registered[0];
 await page.reload();await expect(page.getByText('回滚不可用：上一版本没有登记数据版本，无法确认与当前数据兼容。')).toBeVisible();await expect(page.getByRole('button',{name:'回滚到上一版本'})).toBeDisabled();
});
