import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ locale: 'en-US' });
test.setTimeout(60_000);

test('10,000 set records: transaction save p95 stays below the desktop engineering target', async ({ page }, testInfo) => {
  test.slow();
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acceptance-browser.ts';
    return (await import(/* @vite-ignore */ path)).measureSetSave(`performance-${crypto.randomUUID()}`);
  });
  await testInfo.attach('set-save-performance', { body: JSON.stringify({ ...result, platform: process.platform, browser: testInfo.project.name }), contentType: 'application/json' });
  console.log(`PERFORMANCE ${testInfo.project.name} ${JSON.stringify(result)}`);
  expect(result.historyCount).toBe(100);
  expect(result.persistedSets).toBe(10_050);
  expect(result.p95Ms).toBeLessThan(300);
});

test('legacy calendar upgrade fails visibly without deleting existing facts', async ({ page }) => {
  // A bare same-origin resource avoids mounted App observers reopening the database.
  await page.goto('/tests/e2e/helpers/acceptance-browser.ts');
  await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acceptance-browser.ts';
    await (await import(/* @vite-ignore */ path)).seedMissingProvenance();
  });
  await page.goto('/settings');
  await expect(page.getByRole('alert').filter({ hasText: 'CALENDAR_PROVENANCE_MISSING' }).first()).toBeVisible();
  const kept = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acceptance-browser.ts';
    return (await import(/* @vite-ignore */ path)).readLegacyFacts();
  });
  expect(kept).toEqual({ versions: 1, goal: 'Keep legacy facts', version: 2 });
});

for (const locale of ['en', 'zh'] as const) {
  test(`${locale}: opened app offline manual plan, sets, review, history, memo and JSON restore`, async ({ page, context }, testInfo) => {
    const zh = locale === 'zh';
    const text = (en: string, cn: string) => zh ? cn : en;
    await page.goto('/plans');
    if (zh) await page.getByLabel('Language').selectOption('zh');
    await page.getByLabel(text('Plan name', '计划名称')).fill('Acceptance plan');
    if (testInfo.project.name === 'webkit') {
      // Windows WebKit's emulated offline flag also prevents native File reads.
      // Block every HTTP(S) request while leaving local File APIs operational.
      await context.route(/^https?:\/\//, route => route.abort('internetdisconnected'));
      expect(await page.evaluate(async () => {
        try { await fetch(`${location.origin}/offline-network-probe`); return false; }
        catch { return true; }
      })).toBe(true);
    } else {
      await context.setOffline(true);
    }
    await page.getByRole('button', { name: text('Save plan', '保存计划'), exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(text('Plan saved', '计划已保存'));
    await page.getByRole('link', { name: text('Today', '今日'), exact: true }).click();
    await page.getByRole('button', { name: text('Start planned workout', '开始计划训练'), exact: true }).first().click();
    await page.getByLabel(text('Reps', '次数'), { exact: true }).fill('12');
    await page.getByLabel(text('Set notes', '组备注'), { exact: true }).fill('Offline acceptance evidence');
    await page.getByRole('button', { name: text('Record set', '记录组'), exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(text('Set saved', '组已保存'));
    await page.getByRole('button', { name: text('Review completion', '完成前核对'), exact: true }).click();
    await expect(page.getByRole('region', { name: text('Completion review', '完成前核对') })).toContainText('Offline acceptance evidence');
    await page.getByRole('button', { name: text('Confirm completion', '确认完成'), exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(text('Workout completed', '训练已完成'));
    await page.getByRole('link', { name: text('Progress', '进度'), exact: true }).click();
    await page.getByRole('button', { name: text('View history details', '查看历史详情'), exact: true }).click();
    await expect(page.getByRole('region', { name: text('History details', '历史详情') })).toContainText('Offline acceptance evidence');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('link', { name: text('Settings', '设置'), exact: true }).click();
    await page.getByRole('button', { name: text('Read full training memo', '读取全量训练备忘'), exact: true }).click();
    await expect(page.getByRole('region', { name: text('Full training memo', '全量训练备忘'), exact: true })).toContainText('Offline acceptance evidence');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: text('Export JSON backup', '导出 JSON 备份'), exact: true }).click();
    const path = await (await downloaded).path();
    if (!path) throw new Error('JSON download missing');
    const downloadedBytes = await readFile(path);
    const json = JSON.parse(downloadedBytes.toString('utf8'));
    expect(json.data.sets[0].notes).toBe('Offline acceptance evidence');
    // WebKit on this Windows host cannot read native file handles while offline.
    // Upload the exact bytes from the real download, using Playwright's FilePayload API.
    await page.getByLabel(text('Restore JSON file', '恢复 JSON 文件'), { exact: true }).setInputFiles({
      name: 'downloaded-backup.json', mimeType: 'application/json', buffer: downloadedBytes,
    });
    const fileDiagnostics = await page.getByLabel(text('Restore JSON file', '恢复 JSON 文件'), { exact: true }).evaluate(async (element: HTMLInputElement) => {
      const file = element.files![0];
      const result: Record<string, unknown> = { name: file.name, size: file.size, type: file.type };
      try { result.textLength = (await file.text()).length; } catch (error) { result.textError = String(error); }
      result.reader = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve({ length: String(reader.result).length });
        reader.onerror = () => resolve({ error: String(reader.error) });
        reader.readAsText(file);
      });
      return result;
    });
    await testInfo.attach('uploaded-file-diagnostics', { body: JSON.stringify(fileDiagnostics), contentType: 'application/json' });
    await expect(page.getByText(text('Backup validated', '备份校验通过'), { exact: true })).toBeVisible();
    const before = page.waitForEvent('download');
    await page.getByRole('button', { name: text('Download current data before replacement', '替换前下载当前数据'), exact: true }).click();
    await before;
    await page.getByLabel(text('I have downloaded and kept the current backup', '我已下载并保管当前备份'), { exact: true }).check();
    await page.getByLabel(text('I confirm replacing all local data', '我确认替换全部本地数据'), { exact: true }).check();
    await page.getByRole('button', { name: text('Replace local data', '替换本地数据'), exact: true }).click();
    await page.getByRole('button', { name: text('Read full training memo', '读取全量训练备忘'), exact: true }).click();
    await expect(page.getByRole('region', { name: text('Full training memo', '全量训练备忘'), exact: true })).toContainText('Offline acceptance evidence');
  });
}

test('editing the current plan preserves the original calendar and due classification', async ({ page }) => {
  await page.goto('/plans');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acceptance-browser.ts';
    return (await import(/* @vite-ignore */ path)).calendarProvenance(`calendar-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ before: 1, after: 1, startDate: '2026-10-03', scheduleTimeZone: 'Asia/Shanghai', backupValid: true });
});
