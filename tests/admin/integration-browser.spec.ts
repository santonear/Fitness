import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.request.post('/__test/reset');await page.request.post('/__test/session',{data:{mode:'fresh'}});await page.addInitScript(()=>localStorage.setItem('fitness.language','zh'));});

test('real signed Access rejects missing and invalid signatures',async({page})=>{
  await page.request.post('/__test/session',{data:{mode:'none'}});expect((await page.request.get('/api/v1/management/console/session')).status()).toBe(403);
  await page.request.post('/__test/session',{data:{mode:'invalid'}});expect((await page.request.get('/api/v1/management/console/session')).status()).toBe(403);
  await page.request.post('/__test/session',{data:{mode:'fresh'}});expect(await (await page.request.get('/api/v1/management/console/session')).json()).toMatchObject({fresh:true,environment:'preview'});
});

test('application approval persists through real console and removes its todo',async({page})=>{
  await page.goto('/admin/todo');await expect(page.getByRole('heading',{name:'新申请',exact:true})).toBeVisible();await page.getByRole('link',{name:'逐个审核',exact:true}).click();
  await expect(page.getByRole('heading',{name:/合成申请人/})).toBeVisible();await page.getByRole('button',{name:'批准',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  const write=page.waitForResponse(response=>response.url().endsWith('/console/users/action')&&response.request().method()==='POST');await page.getByRole('button',{name:'确认',exact:true}).click();expect((await write).status()).toBe(200);
  await expect(page.getByRole('button',{name:'批准',exact:true})).toHaveCount(0);await expect(page.locator('article').filter({has:page.getByRole('heading',{name:/合成申请人/})})).toContainText('approved');
  const evidence=await (await page.request.get('/__test/evidence')).json();expect(evidence.applicationState).toBe('approved');expect(evidence.revision).toBeGreaterThan(0);expect(evidence.audit).toContainEqual(expect.objectContaining({actor:'admin@integration.test',action:'approve',result:'success'}));expect(evidence.migrations).toEqual(expect.arrayContaining(['1_core.sql','2_releases.sql','3_finance.sql','4_quality.sql']));
  await page.goto('/admin/todo');await expect(page.getByText('当前没有需要处理的待办')).toBeVisible();expect((await (await page.request.get('/api/v1/management/console/todos')).json()).items).toEqual([]);
  await page.reload();await expect(page.getByText('当前没有需要处理的待办')).toBeVisible();
});
