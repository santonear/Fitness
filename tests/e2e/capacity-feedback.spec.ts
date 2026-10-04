import { test, expect } from '@playwright/test';

for (const locale of ['en-US', 'zh-CN']) {
  test.describe(locale, () => {
    test.use({ locale });
    test('download is not kept confirmation and a later write invalidates replacement', async ({ page }) => {
      const zh = locale === 'zh-CN';
      await page.goto('/settings');
      if (zh) await page.getByLabel('Language', { exact: true }).selectOption('zh');
      await expect(page.getByRole('button', { name: zh ? '导出 JSON 备份' : 'Export JSON backup', exact: true })).toBeVisible();
      await expect(page.getByText(/16 MiB（16777216|16 MiB \(16777216/)).toBeVisible();
      const first = page.waitForEvent('download');
      await page.getByRole('button', { name: zh ? '导出 JSON 备份' : 'Export JSON backup', exact: true }).click();
      const downloaded = await first; const file = await downloaded.path();
      if (!file) throw new Error('Missing actual download');
      await page.getByLabel(zh ? '恢复 JSON 文件' : 'Restore JSON file', { exact: true }).setInputFiles(file);
      await expect(page.getByText(zh ? '备份校验通过' : 'Backup validated', { exact: true })).toBeVisible();
      await expect(page.getByText(zh ? '准备备份或校验文件中，请稍候。' : 'Preparing backup or validating file. Please wait.', { exact: true })).toHaveCount(0);
      const kept = page.getByLabel(zh ? '我已下载并保管当前备份' : 'I have downloaded and kept the current backup', { exact: true });
      const replace = page.getByRole('button', { name: zh ? '替换本地数据' : 'Replace local data', exact: true });
      await expect(kept).toBeDisabled();
      const second = page.waitForEvent('download');
      await page.getByRole('button', { name: zh ? '替换前下载当前数据' : 'Download current data before replacement', exact: true }).click();
      await second;
      await expect(kept).not.toBeChecked();
      await expect(replace).toBeDisabled();
      await kept.check();
      await page.getByLabel(zh ? '我确认替换全部本地数据' : 'I confirm replacing all local data', { exact: true }).check();
      await page.evaluate(async () => {
        const path = '/src/application/body-weight.ts';
        await (await import(/* @vite-ignore */ path)).bodyWeightService.saveBodyWeight({ localDate: '2026-10-05', timeZone: 'UTC', weightGrams: 70000 });
      });
      await replace.click();
      await expect(page.getByRole('alert')).toContainText(zh ? '本地数据已变化' : 'Local data changed');
      await expect(page.getByText(zh ? '备份校验通过' : 'Backup validated', { exact: true })).toHaveCount(0);
      const weight = await page.evaluate(async () => { const path = '/src/application/body-weight.ts'; return (await (await import(/* @vite-ignore */ path)).bodyWeightService.listBodyWeights()).map((row: { weightGrams: number }) => row.weightGrams); });
      expect(weight).toContain(70000);
      const picker = page.getByLabel(zh ? '恢复 JSON 文件' : 'Restore JSON file', { exact: true });
      await expect(picker).toHaveValue('');
      await picker.setInputFiles(file);
      await expect(page.getByText(zh ? '备份校验通过' : 'Backup validated', { exact: true })).toBeVisible();
      await expect(replace).toBeDisabled();
    });
  });
}
for (const locale of ['en', 'zh']) test(`successful replacement leaves explicit ${locale} feedback after the generation remount`, async ({ page }) => {
  const zh = locale === 'zh';
  await page.goto('/settings');
  if (zh) await page.getByLabel('Language', { exact: true }).selectOption('zh');
  const first = page.waitForEvent('download');
  await page.getByRole('button', { name: zh ? '导出 JSON 备份' : 'Export JSON backup', exact: true }).click();
  const file = await (await first).path(); if (!file) throw new Error('Missing download');
  await page.getByLabel(zh ? '恢复 JSON 文件' : 'Restore JSON file', { exact: true }).setInputFiles(file);
  await expect(page.getByText(zh ? '备份校验通过' : 'Backup validated', { exact: true })).toBeVisible();
  const second = page.waitForEvent('download');
  await page.getByRole('button', { name: zh ? '替换前下载当前数据' : 'Download current data before replacement', exact: true }).click(); await second;
  await page.getByLabel(zh ? '我已下载并保管当前备份' : 'I have downloaded and kept the current backup', { exact: true }).check();
  await page.getByLabel(zh ? '我确认替换全部本地数据' : 'I confirm replacing all local data', { exact: true }).check();
  await page.getByRole('button', { name: zh ? '替换本地数据' : 'Replace local data', exact: true }).click();
  await expect(page.getByTestId('restore-result')).toHaveText(zh ? '恢复成功。' : 'Restore succeeded.');
});
