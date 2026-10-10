import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { nutrition: true, activityImport: true }, expiresAt: Date.now() + 60_000 } }));
});
test('V8 database upgrade is additive, idempotent and rolls back a failing transaction', async ({ page }) => {
 const source=JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v807-mainline.json',import.meta.url),'utf8'));
 await page.goto('/settings');
 const upgraded=await page.evaluate(async source=>{const p='/tests/e2e/helpers/followup-migration.ts';return(await import(/* @vite-ignore */ p)).checkV8Upgrade(source);},source);
 expect(upgraded).toEqual({unchanged:true,version:9,metadata:9,empty:true});
 const failed=await page.evaluate(async source=>{const p='/tests/e2e/helpers/followup-migration.ts';return(await import(/* @vite-ignore */ p)).checkV8Upgrade(source,true);},source);
 expect(failed).toEqual({rejected:true,version:8,unchanged:true});
});
test('local food and GPX use actual forms, roundtrip without implicit model requests', async ({ page }) => {
  let modelCalls = 0; page.on('request', request => { if (/goals\/interpret|plans\/generate|stages\/summarize/.test(request.url())) modelCalls++; });
  await page.goto('/settings/nutrition');
  await page.getByLabel('大致份量（可选）').fill('一碗米饭');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存' })).toBeVisible();
  await page.reload(); await expect(page.getByText(/早餐 · 一碗米饭/)).toBeVisible();
  await page.goto('/settings/import');
  const gpx = '<?xml version="1.0"?><gpx version="1.1" creator="synthetic" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Never store this</name><trkseg><trkpt lat="1" lon="2"><time>2026-01-01T00:00:00Z</time></trkpt><trkpt lat="2" lon="3"><time>2026-01-01T00:20:00Z</time></trkpt></trkseg></trk></gpx>';
  const upload = () => page.getByLabel('选择 GPX 文件').setInputFiles({ name: 'activity.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) });
  await upload(); await expect(page.getByText('2026-01-01 · 20 分钟')).toBeVisible();
  await page.getByLabel('活动类型').selectOption('walk'); await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByRole('status')).toHaveText('已导入 1 项，跳过 0 项重复记录。');
  await upload(); await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByRole('status')).toHaveText('已导入 0 项，跳过 1 项重复记录。');
  const exported = await page.evaluate(async () => { const p='/src/application/backup.ts'; return JSON.parse(await(await(await import(/* @vite-ignore */ p)).backupService.exportBackup()).text()); });
  expect(exported.schemaVersion).toBe(7); expect(exported.data.metadata.schemaVersion).toBe(9);
  expect(exported.data.nutritionRecords[0].calories).toBeUndefined(); expect(exported.data.v8.activities).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain('Never store this'); expect(exported.data.activityImportReceipts).toHaveLength(1); expect(modelCalls).toBe(0);
  const invalidGpx=gpx.replaceAll('2026-01-01','2026-02-30');await page.getByLabel('选择 GPX 文件').setInputFiles({name:'invalid.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(invalidGpx)});await expect(page.getByRole('status')).toContainText('无法读取');
});
test('every UI-exported legacy and V8 backup restores through new envelope without losing facts', async ({ page }) => {
  test.setTimeout(120_000);
  const folder = new URL('../fixtures/legacy-backups/', import.meta.url);
  const sources = readdirSync(folder).filter(name => name.endsWith('.json') && !name.includes('manifest')).map(name => ({ name, value: JSON.parse(readFileSync(new URL(name, folder), 'utf8')) }));
  expect(sources.some(source => source.name === 'v807-mainline.json')).toBe(true);
  await page.goto('/settings'); await expect(page.getByRole('heading', {name:'设置',exact:true})).toBeVisible();
  for (const source of sources) {
    const result = await page.evaluate(async ({ name, value }) => {
      const p='/src/application/backup.ts', service=(await import(/* @vite-ignore */ p)).backupService;
      const before=await service.validateBackup(new File([JSON.stringify(value)],name));
      await service.importBackup(before,{backupExported:true,replacementConfirmed:true,expectedRevision:before.expectedRevision});
      const first=JSON.parse(await(await service.exportBackup()).text());
      const round=await service.validateBackup(new File([JSON.stringify(first)],'roundtrip.json'));
      await service.importBackup(round,{backupExported:true,replacementConfirmed:true,expectedRevision:round.expectedRevision});
      const second=JSON.parse(await(await service.exportBackup()).text());
      return { first, second };
    }, source);
    for (const table of ['profiles','plans','planVersions','sessions','sets','bodyWeights','aiMemoryNotes']) expect(result.first.data[table], `${source.name}:${table}`).toEqual(source.value.data[table]);
    expect(result.first.schemaVersion).toBe(7); expect(result.first.data.metadata.schemaVersion).toBe(9);
    expect(result.second.data.v8).toEqual(result.first.data.v8);
    expect(result.second.data.nutritionRecords).toEqual([]);
  }
});
test('lifestyle transaction failure and stale generation never partially write', async ({ page }) => {
  await page.goto('/settings'); await expect(page.getByRole('heading', {name:'设置',exact:true})).toBeVisible();
  const result = await page.evaluate(async () => {
    const rp='/src/persistence/repository.ts', ip='/src/application/activity-import.ts', np='/src/application/nutrition.ts';
    const {repository:repo}=await import(/* @vite-ignore */ rp), {createActivityImportService}=await import(/* @vite-ignore */ ip), {createNutritionService}=await import(/* @vite-ignore */ np);
    const meta=await repo.readMetadata();
    const candidate={receiptId:'a'.repeat(64)+':0',localDate:'2026-01-01',minutes:20,timeZone:'Asia/Shanghai'};
    const fail=()=>{throw Error('synthetic failure');}; repo.db.activityImportReceipts.hook('creating',fail);
    let rejected=false;try{await createActivityImportService(repo,()=>true).save([candidate],'walk',meta.dataRevision,meta.restoreGeneration??0);}catch{rejected=true;}
    repo.db.activityImportReceipts.hook('creating').unsubscribe(fail);
    let stale=false;try{await createNutritionService(repo,()=>true).save({id:crypto.randomUUID(),localDate:'2026-01-01',timeZone:'Asia/Shanghai',meal:'lunch'},meta.dataRevision,999);}catch{stale=true;}
    return {rejected,stale,activities:await repo.db.v8Activities.count(),receipts:await repo.db.activityImportReceipts.count(),nutrition:await repo.db.nutritionRecords.count(),revision:(await repo.readMetadata()).dataRevision===meta.dataRevision};
  });
  expect(result).toEqual({rejected:true,stale:true,activities:0,receipts:0,nutrition:0,revision:true});
});
