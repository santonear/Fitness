import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
test.beforeEach(async({page})=>{await page.request.post('/__test/reset');await page.request.post('/__test/session',{data:{mode:'fresh'}});await page.addInitScript(()=>localStorage.setItem('fitness.language','zh'));});

test('real signed Access rejects missing and invalid signatures',async({page})=>{
  await page.request.post('/__test/session',{data:{mode:'none'}});expect((await page.request.get('/api/v1/management/console/session')).status()).toBe(403);
  await page.request.post('/__test/session',{data:{mode:'invalid'}});expect((await page.request.get('/api/v1/management/console/session')).status()).toBe(403);
  await page.request.post('/__test/session',{data:{mode:'fresh'}});expect(await (await page.request.get('/api/v1/management/console/session')).json()).toMatchObject({fresh:true,environment:'preview'});
});

const pages=['todo','applications','users','ledger','releases','coach','errors','settings'] as const;
for(const width of [390,320,1440,1024])for(const route of pages)test(`real ${route} at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.url().includes('/api/v1/management/console/')&&!response.ok())errors.push(`${response.status()} ${new URL(response.url()).pathname}`);});
  await page.goto(`/admin/${route}`);await page.waitForLoadState('networkidle');
  if(width>=960)await expect(page.getByRole('navigation',{name:'手机后台导航',includeHidden:true})).toBeHidden();else await expect(page.getByRole('navigation',{name:'手机后台导航'})).toBeVisible();
  if(route==='users'){await page.getByRole('button',{name:/20000000-000/}).click();await expect(page.getByRole('heading',{name:'流水与求助排查'})).toBeVisible();await page.waitForLoadState('networkidle');}
  expect(errors).toEqual([]);await expect(page.locator('[role="alert"]')).toHaveCount(0);
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(element=>{const r=element.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);}).slice(0,5).map(element=>({tag:element.tagName,text:element.textContent?.slice(0,80)}))}));
  expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(width);
  const directory=resolve('.cache/admin-integration-screens');await mkdir(directory,{recursive:true});await page.screenshot({path:resolve(directory,`${route}-${width}.png`),fullPage:true});
});

test('application approval persists through real console and removes its todo',async({page})=>{
  await page.goto('/admin/todo');await expect(page.getByRole('heading',{name:'新申请',exact:true})).toBeVisible();await page.getByRole('link',{name:'逐个审核',exact:true}).click();
  await expect(page.getByRole('heading',{name:/合成申请人/})).toBeVisible();await page.getByRole('button',{name:'批准',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  const write=page.waitForResponse(response=>response.url().endsWith('/console/users/action')&&response.request().method()==='POST');await page.getByRole('button',{name:'确认',exact:true}).click();expect((await write).status()).toBe(200);
  await expect(page.getByRole('button',{name:'批准',exact:true})).toHaveCount(0);await expect(page.locator('article').filter({has:page.getByRole('heading',{name:/合成申请人/})})).toContainText('approved');
  const evidence=await (await page.request.get('/__test/evidence')).json();expect(evidence.applicationState).toBe('approved');expect(evidence.revision).toBeGreaterThan(0);expect(evidence.audit).toContainEqual(expect.objectContaining({actor:'admin@integration.test',action:'approve',result:'success'}));expect(evidence.migrations).toEqual(expect.arrayContaining(['1_core.sql','2_releases.sql','3_finance.sql','4_quality.sql']));
  await page.getByRole('navigation',{name:'手机后台导航'}).getByRole('link',{name:/待办/}).click();await expect(page.getByText('当前没有需要处理的待办')).toBeVisible();expect((await (await page.request.get('/api/v1/management/console/todos')).json()).items).toEqual([]);
  await page.reload();await expect(page.getByText('当前没有需要处理的待办')).toBeVisible();
});

test('committed response loss retains the same request after retry-dialog cancellation',async({page})=>{
  const ids:string[]=[];page.on('request',request=>{if(request.url().endsWith('/console/users/action'))ids.push(request.headers()['x-request-id']);});
  await page.request.post('/__test/drop-next-user-response');await page.goto('/admin/applications');await page.getByRole('button',{name:'批准',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();
  await expect(page.getByRole('button',{name:'重试同一次',exact:true})).toBeVisible();expect((await (await page.request.get('/__test/evidence')).json()).applicationState).toBe('approved');
  const first=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('admin-user-pending')!).id);await page.getByRole('button',{name:'重试同一次',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.getByRole('button',{name:'重试同一次',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('admin-user-pending')!).id)).toBe(first);
  await page.getByRole('button',{name:'重试同一次',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'重试同一次',exact:true})).toHaveCount(0);expect(ids).toHaveLength(2);expect(ids[1]).toBe(ids[0]);
  const evidence=await (await page.request.get('/__test/evidence')).json();expect(evidence.applicationState).toBe('approved');expect(evidence.approvalEvents).toBe(1);
});

test('stale signed Access blocks cleanup and fresh verification resumes the same request',async({page})=>{
  await page.request.post('/__test/session',{data:{mode:'stale'}});await page.goto('/admin/applications');
  const ids:string[]=[];page.on('request',request=>{if(request.url().endsWith('/console/users/action'))ids.push(request.headers()['x-request-id']);});
  await page.getByRole('button',{name:'清理已过保留期申请'}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'重新验证',exact:true})).toBeVisible();
  expect((await (await page.request.get('/__test/evidence')).json()).revision).toBe(0);
  await page.request.post('/__test/session',{data:{mode:'fresh'}});await page.getByRole('button',{name:'重试同一次',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'重试同一次',exact:true})).toHaveCount(0);
  expect(ids).toHaveLength(2);expect(ids[1]).toBe(ids[0]);expect((await (await page.request.get('/__test/evidence')).json()).applicationState).toBe('pending');
});

test('runtime configuration edits and history restore persist through the real backend',async({page})=>{
  await page.goto('/admin/settings');const quota=page.getByRole('spinbutton',{name:'计划额度默认值',exact:true});await expect(quota).toHaveValue('4');
  async function save(value:string){await quota.fill(value);await page.getByRole('button',{name:'查看改动',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(`改后: ${value}`);const response=page.waitForResponse(r=>r.url().endsWith('/finance/config')&&r.request().method()==='POST');await page.getByRole('button',{name:'确认',exact:true}).click();expect((await response).status()).toBe(200);await expect(page.getByRole('dialog')).not.toBeVisible();}
  await save('9');await expect(page.getByRole('button',{name:'恢复此版本'})).toHaveCount(1);await save('12');await expect(page.getByRole('button',{name:'恢复此版本'})).toHaveCount(2);
  await page.getByRole('button',{name:'恢复此版本'}).first().click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(quota).toHaveValue('9');
  const result=await (await page.request.get('/api/v1/management/console/finance/config')).json();expect(result.current.version).toBe(3);expect(result.current.config.quotaGenerate).toBe(9);expect(result.history.map((v:{config:{quotaGenerate:number}})=>v.config.quotaGenerate)).toEqual([9,12,9]);
  await page.reload();await expect(quota).toHaveValue('9');expect((await (await page.request.get('/__test/evidence')).json()).revision).toBe(0);
});

test('registered test rollback reruns real local smoke probes and resolves the smoke todo',async({page})=>{
  await page.request.post('/__test/smoke-mode',{data:{fail:true}});await page.goto('/admin/releases');await page.getByRole('button',{name:'回滚到上一版本',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('不回退数据库');
  const rolledBack=page.waitForResponse(r=>r.url().endsWith('/releases/rollback'));await page.getByRole('button',{name:'确认',exact:true}).click();const result=await rolledBack;expect(result.status()).toBe(200);const body=await result.json();expect(body.current).toBe('synthetic-previous');expect(body.smoke).toContainEqual(expect.objectContaining({check:'features',status:'failed'}));
  const todos=await (await page.request.get('/api/v1/management/console/todos')).json();expect(todos.items).toContainEqual(expect.objectContaining({id:'smoke:preview:synthetic-previous',level:'alert'}));
  expect((await (await page.request.get('/__test/evidence')).json()).syntheticDeployment).toBe('40000000-0000-4000-8000-000000000004');
  await page.request.post('/__test/smoke-mode',{data:{fail:false}});const checked=page.waitForResponse(r=>r.url().endsWith('/releases/smoke'));await page.getByRole('button',{name:'重新检查',exact:true}).click();expect((await (await checked).json()).smoke.every((row:{status:string})=>row.status==='passed')).toBe(true);
  expect((await (await page.request.get('/api/v1/management/console/todos')).json()).items.some((item:{id:string})=>item.id.startsWith('smoke:'))).toBe(false);
});


test('real management entry carries Access cookie and retries unavailable configuration',async({page})=>{
  await page.request.post('/__test/features-mode',{data:{fail:true}});
  await page.goto('/admin');await expect(page.getByRole('alert')).toContainText('暂时无法读取后台配置');
  await expect(page.getByRole('heading',{name:'应用管理',exact:true})).toHaveCount(0);
  await page.request.post('/__test/features-mode',{data:{fail:false}});
  const loaded=page.waitForResponse(r=>r.url().endsWith('/api/v1/features')&&r.status()===200);
  await page.getByRole('button',{name:'重试',exact:true}).click();await loaded;
  await expect(page.locator('.admin-bottom')).toBeVisible();
  expect(await page.evaluate(async()=> (await fetch('/api/v1/features',{credentials:'omit'})).status)).toBe(403);
});


test('quota restoration response loss retries exactly once with unchanged usage and budget',async({page})=>{
 const before=await (await page.request.get('/__test/evidence')).json();const ids:string[]=[];
 page.on('request',r=>{if(r.url().endsWith('/console/users/action'))ids.push(r.headers()['x-request-id']);});
 await page.goto('/admin/users');await page.getByRole('button',{name:/20000000.*有效/}).click();
 await page.request.post('/__test/drop-next-user-response');await page.getByRole('button',{name:'刷新额度',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();
 await expect(page.getByRole('button',{name:'重试同一次',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'重试同一次',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'重试同一次',exact:true})).toHaveCount(0);
 const after=await (await page.request.get('/__test/evidence')).json();expect(ids).toHaveLength(2);expect(ids[1]).toBe(ids[0]);expect(Object.keys(after.quotaRestorations)).toEqual([ids[0]]);expect(after.usage).toEqual(before.usage);expect(after.budgets).toEqual(before.budgets);
});

test('preview simulation persists separately from actual deployment and live smoke',async({page})=>{
 await page.goto('/admin/releases');await page.getByRole('button',{name:'模拟回滚',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('不切换实际代码');
 const response=page.waitForResponse(r=>r.url().endsWith('/releases/simulate-rollback'));await page.getByRole('button',{name:'确认',exact:true}).click();expect((await response).status()).toBe(200);
 await expect(page.getByText('模拟验证已完成，实际部署未改变。')).toBeVisible();await page.reload();await expect(page.getByText('模拟验证已完成，实际部署未改变。')).toBeVisible();
 const evidence=await (await page.request.get('/__test/evidence')).json();expect(evidence.syntheticDeployment).toBe('30000000-0000-4000-8000-000000000003');expect(evidence.releaseStates).toEqual([]);
});


for(const [button,action] of [['拒绝','reject'],['免邀请码开通','activate']] as const)test(`legacy parity application ${action}`,async({page})=>{
 await page.goto('/admin/applications');if(action==='reject')await page.getByLabel('审核备注（拒绝必填）').fill('合成审核说明');
 await page.getByRole('button',{name:button,exact:true}).click();const response=page.waitForResponse(r=>r.url().endsWith('/console/users/action'));await page.getByRole('button',{name:'确认',exact:true}).click();expect((await response).status()).toBe(200);
 const evidence=await (await page.request.get('/__test/evidence')).json();if(action==='reject')expect(evidence.application.state).toBe('rejected');else expect(evidence.application.directlyActivated).toBe(true);
 expect(evidence.audit).toContainEqual(expect.objectContaining({action,result:'success'}));
});
for(const [button,action] of [['重新生成激活码','reissue'],['作废资格','revoke'],['删除账号','delete']] as const)test(`legacy parity user ${action}`,async({page})=>{
 await page.goto('/admin/users');await page.getByRole('button',{name:/20000000.*有效/}).click();await page.getByRole('button',{name:button,exact:true}).click();const response=page.waitForResponse(r=>r.url().endsWith('/console/users/action'));await page.getByRole('button',{name:'确认',exact:true}).click();expect((await response).status()).toBe(200);
 const evidence=await (await page.request.get('/__test/evidence')).json();expect(evidence.audit).toContainEqual(expect.objectContaining({action,result:'success'}));expect(Object.keys(evidence.requests)).toHaveLength(1);expect(Object.values(evidence.budgets)[0]).toMatchObject({spent:35});
 if(action==='delete')expect(evidence.subjects['20000000-0000-4000-8000-000000000002'].deletedAt).toBeGreaterThan(0);else expect(evidence.subjects['20000000-0000-4000-8000-000000000002'].revoked).toBe(true);
});
test('legacy parity invite creation and revocation',async({page})=>{
 await page.goto('/admin/users');await page.getByRole('button',{name:'手动生成邀请码',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'作废',exact:true})).toBeVisible();
 const created=await (await page.request.get('/__test/evidence')).json();expect(created.invites).toBe(1);await page.getByRole('button',{name:'作废',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('button',{name:'作废',exact:true})).toHaveCount(0);
 const evidence=await (await page.request.get('/__test/evidence')).json();expect(evidence.audit).toContainEqual(expect.objectContaining({action:'invite-revoke',result:'success'}));
});


test('legacy parity pending settlement uses actual ledger accounting',async({page})=>{
 await page.request.post('/__test/parity-fixture',{data:{mode:'pending'}});await page.goto('/admin/ledger');await page.getByRole('button',{name:'核算',exact:true}).click();await page.getByLabel('供应商账单金额（分）').fill('47');const response=page.waitForResponse(r=>r.url().endsWith('/finance/settle'));await page.getByRole('button',{name:'确认',exact:true}).click();expect((await response).status()).toBe(200);
 const evidence=await (await page.request.get('/__test/evidence')).json();expect(evidence.requests['20000000-0000-4000-8000-000000000002:50000000-0000-4000-8000-000000000005']).toMatchObject({status:'settled',actualCost:47});expect(Object.values(evidence.budgets)[0]).toMatchObject({spent:47,reserved:0});
});
test('legacy parity retention removes only expired closed application',async({page})=>{
 await page.request.post('/__test/parity-fixture',{data:{mode:'expired'}});await page.goto('/admin/applications');await page.getByRole('button',{name:'清理已过保留期申请'}).click();const response=page.waitForResponse(r=>r.url().endsWith('/console/users/action'));await page.getByRole('button',{name:'确认',exact:true}).click();expect((await response).status()).toBe(200);expect((await (await page.request.get('/__test/evidence')).json()).application).toBeUndefined();
});
test('legacy parity AI switch persists without invoking any model transport',async({page})=>{
 await page.request.post('/__test/parity-fixture',{data:{mode:'ai'}});await page.goto('/admin/settings');
 for(const name of ['开启 AI 服务','关闭 AI 服务']){await page.getByRole('button',{name,exact:true}).click();const response=page.waitForResponse(r=>r.url().endsWith('/console/users/action'));await page.getByRole('button',{name:'确认',exact:true}).click();expect((await response).status()).toBe(200);await expect(page.getByRole('dialog')).not.toBeVisible();expect((await (await page.request.get('/__test/evidence')).json()).aiEnabled).toBe(name==='开启 AI 服务');}
});
test('legacy parity audit filter and CSV preserve UTF8 BOM',async({page})=>{
 await page.goto('/admin/applications');await page.getByRole('button',{name:'批准',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await page.goto('/admin/audit');await page.getByLabel('筛选操作').fill('approve');await expect(page.getByText(/admin@integration.test.*approve.*success/)).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'导出 CSV',exact:true}).click();const path=await (await download).path();const {readFile}=await import('node:fs/promises');const bytes=await readFile(path!);expect([...bytes.subarray(0,3)]).toEqual([239,187,191]);expect(bytes.toString('utf8')).toContain('approve');
});
