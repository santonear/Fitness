import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

function facts(data: any) {
  const copy=structuredClone(data);
  for(const key of ['revision','dataRevision','restoreGeneration','importedAt','upgradedAt'])delete copy.metadata[key];
  for(const key of ['revision','sourceRevision','updatedAt'])delete copy.trainingMemo[key];
  return copy;
}

for(const language of ['en','zh'] as const) test(`${language} production UI day plans, completed hidden slot and downloaded restore preserve facts`,async({page},info)=>{
  const zh=language==='zh';const text=(en:string,cn:string)=>zh?cn:en;
  await page.goto('/plans');await page.getByRole('combobox').first().selectOption(language);
  await page.evaluate(async()=>{
    const {profileService}=await import(String('/src/application/profile.ts'));
    const {dayPlanService}=await import(String('/src/application/day-plans.ts'));
    const profile=await profileService.initialize('en');
    for(const [date,name,notes] of [['2027-01-04','Date A','原计划备注 A'],['2027-01-11','Date B','独立计划备注 B']])
      await dayPlanService.saveDayPlan({date,timeZone:profile.timeZone,name,exercises:[{exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',order:0,notes,targetSets:[{metricType:'reps',reps:10}]}]});
  });
  await page.reload();
  const region=page.getByRole('region',{name:text('Date training plans','日期训练计划')});
  const list=region.getByRole('list',{name:text('Date plans','日期计划')});await expect(list.locator('li')).toHaveCount(2);
  await list.locator('li').filter({hasText:'Date A'}).getByRole('link',{name:text('Start day workout','开始日训练')}).click();
  await page.getByRole('button',{name:text('Start planned workout','开始计划训练')}).click();
  await page.getByLabel(text('Reps','次数'),{exact:true}).fill('12');await page.getByLabel(text('Set notes','组备注'),{exact:true}).fill('实际组备注');
  await page.getByRole('button',{name:text('Record set','记录组'),exact:true}).click();await expect(page.getByRole('status')).toHaveText(text('Set saved','组已保存'));
  await page.getByRole('button',{name:text('Review completion','完成前核对')}).click();await page.getByRole('button',{name:text('Confirm completion','确认完成')}).click();await expect(page.getByRole('status')).toHaveText(text('Workout completed','训练已完成'));
  await page.goto('/plans');page.once('dialog',dialog=>dialog.accept());await page.getByRole('list',{name:text('Date plans','日期计划')}).locator('li').filter({hasText:'Date A'}).getByRole('button',{name:text('Hide day plan','隐藏日计划')}).click();
  await expect(page.getByRole('list',{name:text('Date plans','日期计划')}).locator('li')).toHaveCount(1);
  await page.reload();
  expect(await page.evaluate(async()=>{
    const {slotTasks}=await import(String('/src/application/day-plans.ts'));
    const {repository}=await import(String('/src/persistence/repository.ts'));
    const {profileService}=await import(String('/src/application/profile.ts'));
    const {evaluateSlot}=await import(String('/src/domain/day-slot-policy.ts'));
    return evaluateSlot(await slotTasks(repository,(await profileService.getProfile()).timeZone),'2027-01-04').occupants.length;
  })).toBe(1);
  await page.goto('/settings');const exportFile=async(name:string)=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:text('Export JSON backup','导出 JSON 备份'),exact:true}).click();const download=await event;const file=info.outputPath(name);await download.saveAs(file);return {file,data:JSON.parse(await readFile(file,'utf8'))};};
  const source=await exportFile('day-source.json');expect(source.data.schemaVersion).toBe(5);expect(source.data.data.plans).toHaveLength(2);expect(source.data.data.sessions[0].status).toBe('completed');expect(source.data.data.sets[0].notes).toBe('实际组备注');expect(source.data.data.scheduledWorkouts.some((row:any)=>row.hiddenAt&&row.completedSessionId)).toBe(true);
  await page.getByLabel(text('Restore JSON file','恢复 JSON 文件'),{exact:true}).setInputFiles(source.file);const validated=page.getByText(text('Backup validated','备份校验通过'),{exact:true});await expect(validated).toBeVisible();
  const before=page.waitForEvent('download');await page.getByRole('button',{name:text('Download current data before replacement','替换前下载当前数据')}).click();const current=await before;await current.saveAs(info.outputPath('before-replacement.json'));
  await page.getByLabel(text('I have downloaded and kept the current backup','我已下载并保管当前备份'),{exact:true}).check();await page.getByLabel(text('I confirm replacing all local data','我确认替换全部本地数据'),{exact:true}).check();await page.getByRole('button',{name:text('Replace local data','替换本地数据'),exact:true}).click();await expect(validated).toBeHidden();
  const restored=await exportFile('day-restored.json');expect(restored.data.data.metadata.restoreGeneration).toBeGreaterThan(source.data.data.metadata.restoreGeneration??0);expect(facts(restored.data.data)).toEqual(facts(source.data.data));
  await page.goto('/plans');await expect(page.getByRole('list',{name:text('Date plans','日期计划')}).locator('li')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
