import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockActiveCoachAccess } from './helpers/coach-access';

test('coach uses explicit send and confirmation before changing a single workout',async({page})=>{
 await mockActiveCoachAccess(page);
 let calls=0;await page.route('**/api/v1/plans/generate',async route=>{calls++;const envelope=route.request().postDataJSON(),request=envelope.coach;
  expect(request.body).toBeUndefined();expect(request.history).toBeUndefined();
  await route.fulfill({json:{requestId:request.requestId,context:{restoreGeneration:request.restoreGeneration,inputDigest:envelope.sendConfirmation},accounting:'settled',result:{requestId:request.requestId,restoreGeneration:request.restoreGeneration,mutationAllowed:false,type:'today_adjustment',target:request.target,template:{...request.template,items:request.template.items.map((i:any)=>({...i,sets:1}))},summary:'本次每个动作一组'}}});
 });
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).click();expect(calls).toBe(0);
 await page.getByRole('dialog').getByRole('textbox',{name:'跟芽芽说'}).fill('今天少一组');await page.getByRole('dialog').getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByText('本次每个动作一组',{exact:true})).toBeVisible();
 const before=await page.evaluate(async()=>{const p='/src/ui/mainline/context.tsx';return(await(await import(/* @vite-ignore */ p)).workflow.snapshot()).state.nextWorkoutOverride;});expect(before).toBeUndefined();
 await page.getByRole('button',{name:'确认应用',exact:true}).click();await expect(page.getByText('已保存',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'开始训练',exact:true}).first().click();await expect(page.getByText('第 1 组，共 1 组',{exact:true})).toBeVisible();expect(calls).toBe(1);
});

test('home composer opens coach and sends once with optional data excluded',async({page})=>{
 await mockActiveCoachAccess(page);
 let calls=0;await page.route('**/api/v1/plans/generate',async route=>{calls++;const request=route.request().postDataJSON().coach;expect(request.body).toBeUndefined();expect(request.history).toBeUndefined();expect(request.instruction).toBe('今天轻一点');await route.fulfill({status:503,json:{error:'AI_DISABLED'}});});
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('今天轻一点');expect(calls).toBe(0);
 await page.getByRole('button',{name:'发送',exact:true}).click();await expect.poll(()=>calls).toBe(1);
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).click();expect(calls).toBe(1);
});

test('monthly review sends the visible month instead of the current week',async({page})=>{
 await mockActiveCoachAccess(page);
 let received:any;
 await page.route('**/api/v1/stages/summarize',async route=>{received=route.request().postDataJSON().coach;await route.fulfill({status:503,json:{error:'AI_DISABLED'}});});
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
 await page.goto('/review');await page.getByRole('button',{name:'本月回顾',exact:true}).click();
 await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).click();
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('看看这个月');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect.poll(()=>received?.kind).toBe('month');expect(received.facts.from).toMatch(/-01$/);
 expect(received.body).toBeUndefined();expect(received.history).toBeUndefined();
});

test('a confirmed today adjustment changes only one workout and survives reload',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await expect(page.getByRole('heading',{name:'下一次'})).toBeVisible();
 const result=await page.evaluate(async()=>{
  const p='/src/ui/mainline/context.tsx',c='/src/coach/response-adapter.ts';const {workflow}=await import(/* @vite-ignore */ p);const {adaptCoachResponse}=await import(/* @vite-ignore */ c);
  const s=await workflow.snapshot(),before=JSON.stringify(s.version),template=s.version.templates[0],requestId=crypto.randomUUID();
  const target={planId:s.plan.id,versionId:s.version.id,revision:s.metadata.dataRevision};
  const request={version:'fitness-coach-v8',requestId,conversationId:crypto.randomUUID(),restoreGeneration:s.metadata.restoreGeneration??0,inputSnapshot:'local revision',sendConfirmation:'test-confirmed',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'ADJUST_TODAY',target,template,instruction:'今天少一组'};
  const response=adaptCoachResponse(request,{requestId,restoreGeneration:request.restoreGeneration,mutationAllowed:false,type:'today_adjustment',target,template:{...template,items:template.items.map((i:any)=>({...i,sets:1}))},summary:'今天少一组'});
  await workflow.applyCoachCandidate({request,response,expectedRevision:s.metadata.dataRevision});const staged=await workflow.snapshot();return {before,after:JSON.stringify(staged.version),staged:!!staged.state.nextWorkoutOverride};
 });expect(result.before).toBe(result.after);expect(result.staged).toBe(true);
 await page.reload();await page.getByRole('button',{name:'开始训练',exact:true}).first().click();await expect(page.getByText('第 1 组，共 1 组',{exact:true})).toBeVisible();
 const saved=await page.evaluate(async()=>{const p='/src/ui/mainline/context.tsx';const s=await(await import(/* @vite-ignore */ p)).workflow.snapshot();return {override:s.state.nextWorkoutOverride,sets:s.active.templateSnapshot.items[0].sets,planSets:s.version.templates[0].items[0].sets};});expect(saved.override).toBeUndefined();expect(saved.sets).toBe(1);expect(saved.planSets).toBe(2);
});

test('backup restoration resets active editors in this tab and another tab',async({page,context})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await page.getByRole('button',{name:'开始训练',exact:true}).first().click();
 const exported=await page.evaluate(async()=>{const p='/src/application/backup.ts';return (await(await import(/* @vite-ignore */ p)).backupService.exportBackup()).text();});
 const other=await context.newPage();await other.goto(page.url());await expect(other.getByText('第 1 组，共 2 组',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'完成这一组',exact:true}).click();await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.evaluate(async text=>{const p='/src/application/backup.ts',service=(await import(/* @vite-ignore */ p)).backupService;await service.exportBackup();const input=await service.validateBackup(new File([text],'saved.json',{type:'application/json'}));await service.importBackup(input,{backupExported:true,replacementConfirmed:true,expectedRevision:input.expectedRevision});},exported);
 await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByText('第 1 组，共 2 组',{exact:true})).toBeVisible();await expect(other.getByText('第 1 组，共 2 组',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'完成这一组',exact:true}).click();await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();await other.close();
});

async function onboard(page: Page, caution?: string) {
  await page.goto('/'); await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel('你的回答').fill('想有些力量，不再容易累'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('每周 2 次，每次 20 分钟'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('在家，只有瑜伽垫'); await page.getByRole('button', { name: '继续', exact: true }).click();
  if (caution) await page.getByRole('button', { name: caution, exact: true }).click();
  await page.getByLabel('我已年满 18 岁').check(); await page.getByRole('button', { name: '生成新计划' }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划' })).toBeVisible();
}
test('real local mainline persists a confirmed plan, training and review with no model requests', async ({ page }) => {
  const apiRequests: {url:string;method:string;body:string|null;headers:Record<string,string>}[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push({url:request.url(),method:request.method(),body:request.postData(),headers:request.headers()}); });
  await onboard(page);
  expect(await page.evaluate(async () => { const p = '/src/persistence/db.ts'; return (await import(/* @vite-ignore */ p)).database.v8Plans.count(); })).toBe(0);
  await page.getByRole('button', { name: '就用这份计划' }).click();
  await expect(page.getByRole('heading', { name: '下一次' })).toBeVisible();
  await page.screenshot({ path: 'tests/fixtures/v8-mainline/qingci-390.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: 'tests/fixtures/v8-mainline/qingci-1440.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '开始训练', exact: true }).first().click();
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.goto('/settings/appearance'); await page.getByRole('button', { name: '留白', exact: true }).click();
  await page.getByRole('button', { name: '青瓷', exact: true }).click();
  await page.goto('/'); await page.getByRole('button', { name: '正在进行，点这里回到训练' }).click();
  await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暂停或结束' }).click();
  await page.getByRole('button', { name: '结束并记下', exact: true }).click();
  await page.getByRole('button', { name: '时间不够', exact: true }).click(); await page.getByLabel('想补充一句（可不填）').fill('今天先记一组');
  await page.getByRole('button', { name: '记下来', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本周回顾' })).toBeVisible();
  await expect(page.getByText('今天先记一组', { exact: true })).toBeVisible();  const record = await page.evaluate(async () => { const p = '/src/persistence/db.ts'; const db = (await import(/* @vite-ignore */ p)).database; return { workouts: await db.v8Workouts.toArray(), versions: await db.v8PlanVersions.toArray() }; });
  expect(record.workouts[0].status).toBe('partial'); expect(record.workouts[0].sets).toHaveLength(1);
  expect(record.versions[0].sessionMinutes).toBe(20); expect(record.workouts[0].planVersionId).toBe(record.versions[0].id);
  // Public settings reads are not model calls. Keep the exception exact and inspect their payload surface.
  const publicPaths = new Set(['/api/v1/features', '/api/v1/announcement']);
  const origin = new URL(page.url()).origin;
  const violations = apiRequests.filter(request => new URL(request.url).origin !== origin || !publicPaths.has(new URL(request.url).pathname));
  expect(violations, 'All other API traffic remains forbidden in this local-only flow').toEqual([]);
  expect(apiRequests.some(request => new URL(request.url).pathname === '/api/v1/announcement')).toBe(true);
  for (const request of apiRequests) {
    expect(request.method, request.url).toBe('GET');
    expect(request.body, request.url).toBeNull();
    expect(new URL(request.url).search, 'Public reads must not carry personal query parameters').toBe('');
    expect(Object.keys(request.headers).filter(key => /goal|health|weight|diet|chat|note|history|instruction|training|workout|exercise|plan/i.test(key)), 'No custom sensitive-data headers').toEqual([]);
    const outgoing = JSON.stringify(request);
    for (const privateText of ['想有些力量，不再容易累', '每周 2 次，每次 20 分钟', '在家，只有瑜伽垫', '今天先记一组']) expect(outgoing).not.toContain(privateText);
  }
});
test('manual timed distance exercise preserves edited measurements after reload', async ({ page }) => {
  await onboard(page); await page.getByRole('button', { name: '就用这份计划' }).click();
  await page.getByRole('button', { name: '手动训练', exact: true }).click();
  const id = await page.evaluate(async () => { const p = '/src/catalog/exercises.ts'; return (await import(/* @vite-ignore */ p)).exercises.find((e: { metricType: string }) => e.metricType === 'duration_distance').id; });
  const name = await page.evaluate(async (exerciseId) => { const p = '/src/catalog/exercises.ts'; return (await import(/* @vite-ignore */ p)).exercises.find((e: { id: string }) => e.id === exerciseId).name.zh; }, id);
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await page.getByRole('searchbox').fill(name);
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.getByRole('button', { name: '修改数值' }).click();
  await page.getByLabel('秒', { exact: true }).fill('120');
  await page.getByLabel('米', { exact: true }).fill('250');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: '完成这一组' }).click();
  await expect.poll(async()=>page.evaluate(async()=>{const p='/src/persistence/db.ts';return (await (await import(/* @vite-ignore */ p)).database.v8Workouts.toArray())[0]?.sets.length;})).toBe(1);
  await page.reload();
  const record = await page.evaluate(async () => { const p = '/src/persistence/db.ts'; return (await (await import(/* @vite-ignore */ p)).database.v8Workouts.toArray())[0]; });
  expect(record.sets[0]).toMatchObject({ exerciseId: id, durationSeconds: 120, distanceMeters: 250 });
});

test('onboarding is resumable and adult confirmation is required for basic generation', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('你的回答').fill('保持活动'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('每周 3 次，每次 30 分钟'); await page.reload();
  await expect(page.getByLabel('你的回答')).toHaveValue('每周 3 次，每次 30 分钟');
  await page.getByRole('button', { name: '继续', exact: true }).click(); await page.getByLabel('你的回答').fill('在家'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByRole('button', { name: '生成新计划' })).toBeDisabled();
});


test('one focused exercise, edited defaults, replacement and pause retain facts',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 await expect(page.getByRole('button',{name:'开始训练',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'换一份',exact:true}).click();await page.getByRole('button',{name:'开始训练',exact:true}).click();
 await page.getByRole('button',{name:'修改数值'}).click();await page.getByLabel('次',{exact:true}).fill('9');await page.getByRole('button',{name:'确定',exact:true}).click();
 await page.getByRole('button',{name:'完成这一组'}).click();await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'换动作',exact:true}).click();await page.getByRole('dialog').getByRole('searchbox').fill('自阻力划船');await page.getByRole('dialog').getByRole('button',{name:'自阻力划船',exact:true}).click();await page.getByLabel('换动作的原因').selectOption('discomfort');await page.getByRole('button',{name:'确定',exact:true}).click();
 await expect(page.getByRole('heading',{name:'自阻力划船',exact:true})).toBeVisible();await page.getByRole('button',{name:'完成这一组'}).click();
 await expect(page.getByRole('button',{name:'这个动作完成了，换下一个'})).toBeVisible();
 const result=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return (await db.v8Workouts.toArray())[0];});
 expect(result.sets[0].reps).toBe(9);expect(result.sets[0].exerciseId).not.toBe(result.sets[1].exerciseId);expect(result.substitutions[0].reason).toBe('discomfort');
 await page.getByRole('button',{name:'暂停或结束'}).click();await expect(page.getByRole('button',{name:'继续训练',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'结束并记下',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'放弃这次（不计入回顾）'})).toBeVisible();
});

test('cautions produce a draft instead of redirecting to manual training',async({page})=>{
 await onboard(page,'膝盖');await expect(page.getByRole('button',{name:'就用这份计划'})).toBeEnabled();
 await expect(page.getByText('已按你选择的注意部位排除相关负担动作；这不是医疗适用性判断。')).toBeVisible();
 await page.getByRole('button',{name:'就用这份计划'}).click();await expect(page.getByRole('heading',{name:'下一次'})).toBeVisible();
});

test('responsive navigation leaves all home actions clickable and activities persist independently',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 for(const width of [320,390,959,960,1440]) {
  await page.setViewportSize({width,height:844});
  const nav=page.locator('.v8-shell > nav'); const rect=await nav.boundingBox();
  if(width>=960){expect(rect!.x).toBe(0);expect(rect!.width).toBe(88);}else expect(rect!.width).toBeLessThanOrEqual(width);
  for(const label of ['换一份','手动训练','记录其他活动']) {
   const button=page.getByRole('button',{name:label,exact:true});await button.scrollIntoViewIfNeeded();
   await button.click({trial:true});
   const box=await button.boundingBox(),bar=await nav.boundingBox();
   if(width<960)expect(box!.y+box!.height).toBeLessThanOrEqual(bar!.y);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await page.getByRole('button',{name:'记录其他活动',exact:true}).click();
 await page.getByRole('button',{name:'骑行',exact:true}).click();await page.getByLabel('时长（分钟）').fill('5');
 await expect(page.getByRole('button',{name:'减少 10 分钟'})).toBeDisabled();
 await page.getByRole('button',{name:'增加 10 分钟'}).click();await page.getByLabel('想补充一句（可不填）').fill('公园骑行');
 await page.getByRole('button',{name:'记下来',exact:true}).click();await expect(page).toHaveURL(/review/);await expect(page.getByText('公园骑行',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('公园骑行',{exact:true})).toBeVisible();
 const saved=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return {activities:await db.v8Activities.toArray(),workouts:await db.v8Workouts.count(),versions:await db.v8PlanVersions.count()};});
 expect(saved.activities).toHaveLength(1);expect(saved.activities[0]).toMatchObject({type:'cycle',minutes:15});expect(saved.workouts).toBe(0);expect(saved.versions).toBe(1);
 await page.goto('/plans');await expect(page.getByRole('heading',{name:'我的计划',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看以前的版本'}).click();await expect(page.getByRole('heading',{name:'计划版本',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看计划',exact:true}).click();await expect(page.getByRole('heading',{name:'我的计划',exact:true})).toBeVisible();
});

test('review adjustment is previewed then saved as a new version without rewriting facts',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 for(let i=0;i<2;i++){
  await page.getByRole('button',{name:'开始训练',exact:true}).click();await page.getByRole('button',{name:'完成这一组'}).click();
  await page.getByRole('button',{name:'暂停或结束'}).click();await page.getByRole('button',{name:'结束并记下',exact:true}).click();
  await page.getByRole('button',{name:'时间不够',exact:true}).click();await page.getByRole('button',{name:'记下来',exact:true}).click();
  await expect(page.getByRole('heading',{name:'本周回顾',exact:true})).toBeVisible();
  if(i===0)await page.getByRole('button',{name:'下一次',exact:true}).click();
 }
 const before=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return {workouts:await db.v8Workouts.toArray(),versions:await db.v8PlanVersions.toArray()};});
 await page.getByRole('button',{name:'就这样调整',exact:true}).click();await expect(page.getByRole('heading',{name:'核对调整后的计划'})).toBeVisible();
 expect(await page.evaluate(async()=>{const p='/src/persistence/db.ts';return (await import(/* @vite-ignore */ p)).database.v8PlanVersions.count();})).toBe(1);
 await page.getByRole('button',{name:'就这样调整',exact:true}).click();await expect(page.getByRole('status')).toHaveText('已保存为新的计划版本。');
 const after=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return {workouts:await db.v8Workouts.toArray(),versions:await db.v8PlanVersions.toArray()};});
 expect(after.workouts).toEqual(before.workouts);expect(after.versions).toHaveLength(2);expect(after.versions.find((v:{id:string})=>v.id===before.versions[0].id)).toEqual(before.versions[0]);
 await page.getByRole('button',{name:'本月回顾',exact:true}).click();await expect(page.getByRole('heading',{name:'本月回顾',exact:true})).toBeVisible();
 await page.goto('/plans/versions');await expect(page.getByRole('button',{name:'查看计划',exact:true})).toHaveCount(2);
});


test('current-week overnight patterns, replacement review and localized names',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T03:00:00Z'));await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 const before=await page.evaluate(async()=>{const path='/src/persistence/db.ts',db=(await import(/* @vite-ignore */ path)).database;const profile=await db.profiles.toCollection().first();await db.profiles.put({...profile,timeZone:'Asia/Shanghai'});const version=(await db.v8PlanVersions.toArray())[0];
  const dates=['2026-10-11T15:59:00Z','2026-10-11T16:01:00Z','2026-10-12T16:01:00Z'];await db.v8Workouts.bulkAdd(dates.map(startedAt=>({id:crypto.randomUUID(),planVersionId:version.id,templateId:version.templates[0].id,startedAt,endedAt:new Date(Date.parse(startedAt)+600000).toISOString(),localDate:startedAt.slice(0,10),timeZone:'UTC',status:'partial',plannedSetCount:8,sets:[{exerciseId:version.templates[0].items[0].exerciseId,itemIndex:0,setIndex:0,reps:8,completedAt:new Date(Date.parse(startedAt)+60000).toISOString()}],feedback:{reasons:['time']}})));return version;
 });
 await page.goto('/review');await expect(page.getByText('工作日凌晨有 2 次没练完。',{exact:true})).toBeVisible();await expect(page.getByText(/周末晚上有/)).toHaveCount(0);await expect(page.locator('.v8-facts dd')).toHaveText(['0','2','2','20','0']);
 await page.getByRole('button',{name:'就这样调整',exact:true}).click();await page.getByRole('button',{name:'就这样调整',exact:true}).click();await expect(page.getByRole('status')).toHaveText('已保存为新的计划版本。');
 const current=await page.evaluate(async()=>{const path='/src/persistence/db.ts',db=(await import(/* @vite-ignore */ path)).database;return(await db.v8PlanVersions.toArray()).find((v:{versionNumber:number})=>v.versionNumber===2)});
 expect(current.templates.map((t:{id:string})=>t.id)).toEqual(before.templates.map((t:{id:string})=>t.id));expect(current.templates[0].estimatedMinutes).toBeLessThan(before.templates[0].estimatedMinutes);
 await page.goto('/plans');await expect(page.getByRole('heading',{name:`${current.templates[0].estimatedMinutes} 分钟`,exact:true})).toBeVisible();
 await page.goto('/settings');await page.getByRole('combobox',{name:'语言',exact:true}).selectOption('en');await page.goto('/plans');await expect(page.getByRole('heading',{name:`${current.templates[0].estimatedMinutes} min`,exact:true})).toBeVisible();await page.getByRole('button',{name:'View previous versions',exact:true}).click();await expect(page.getByText('Replaced the corresponding workout with a shorter session.',{exact:true})).toBeVisible();
});

test('server-revoked access replaces local entitlement and blocks paid requests',async({page})=>{
 let qualification='active',modelCalls=0;
 await page.route('**/api/v1/trial/access-status',route=>route.fulfill({json:{qualification,sessionValid:qualification==='active',expiresAt:Date.now()+86400000,aiEnabled:true,planningBudgetDisabled:true,used:{generate:0},limits:{generate:4}}}));
 await page.route('**/api/v1/plans/generate',route=>{modelCalls++;return route.fulfill({status:500,json:{error:'UNEXPECTED'}})});
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await page.goto('/settings');await expect(page.getByText('AI 资格有效',{exact:true})).toBeVisible();qualification='revoked';await page.getByRole('button',{name:'刷新资格',exact:true}).click();await expect(page.getByText('此浏览器的资格已失效',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'恢复领取或申请补发'})).toHaveAttribute('href','/trial');
 await page.goto('/');await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).click();await page.getByRole('dialog').getByRole('textbox',{name:'跟芽芽说'}).fill('今天时间不够');await page.getByRole('dialog').getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('现在用的是本地建议 · 资格无效');expect(modelCalls).toBe(0);
});

test('activities require an explicit type and replanning starts with previous answers',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await page.goto('/activity');await expect(page.getByRole('button',{name:'记下来',exact:true})).toBeDisabled();await page.getByRole('button',{name:'散步',exact:true}).click();await expect(page.getByRole('button',{name:'记下来',exact:true})).toBeEnabled();
 await page.goto('/settings');await page.getByRole('button',{name:'生成新计划',exact:true}).click();await expect(page.getByLabel('你的回答')).not.toHaveValue('');await expect(page.getByRole('button',{name:'继续',exact:true})).toBeVisible();
});

test('favorite exercises roundtrip through a downloaded backup without changing workout facts',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await page.goto('/exercises');await page.getByRole('searchbox').fill('自阻力划船');await page.getByRole('button',{name:'收藏 自阻力划船',exact:true}).click();await page.goto('/settings');await page.getByRole('button',{name:'备份恢复',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON 备份',exact:true}).click();const download=await downloaded;const file=await download.path();expect(file).toBeTruthy();
 const {readFileSync}=await import('node:fs');const envelope=JSON.parse(readFileSync(file!,'utf8'));expect(envelope.schemaVersion).toBe(10);expect(envelope.data.exerciseFavorites).toHaveLength(1);
 const result=await page.evaluate(async backup=>{const p='/src/persistence/repository.ts',b='/src/application/backup.ts',repo=(await import(/* @vite-ignore */ p)).repository,service=(await import(/* @vite-ignore */ b)).createBackupService(repo);await repo.write(async()=>{await repo.db.exerciseFavorites.clear()});const input=await service.validateBackup(new File([JSON.stringify(backup)],'backup.json'));await service.importBackup(input,{backupExported:true,replacementConfirmed:true,expectedRevision:input.expectedRevision});return {favorites:await repo.db.exerciseFavorites.toArray(),workouts:await repo.db.v8Workouts.toArray()};},envelope);
 expect(result.favorites).toEqual(envelope.data.exerciseFavorites);expect(result.workouts).toEqual(envelope.data.v8.workouts);await page.goto('/exercises');await page.getByLabel('只看已收藏').check();await expect(page.getByRole('button',{name:'自阻力划船',exact:true})).toBeVisible();
});
