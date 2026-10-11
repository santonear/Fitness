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
