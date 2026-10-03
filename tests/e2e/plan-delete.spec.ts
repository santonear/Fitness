import { expect, test } from '@playwright/test';

for (const locale of ['en', 'zh'] as const) {
  test(`deleting a saved draft supports cancellation and persists (${locale})`, async ({ page }) => {
    await page.goto('/plans');
    if (locale === 'zh') await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh');
    const zh = locale === 'zh';
    await page.getByLabel(zh ? '计划名称' : 'Plan name').fill('Disposable draft');
    await page.getByLabel(zh ? '保存为' : 'Save as').selectOption('draft');
    await page.getByRole('button', { name: zh ? '保存计划' : 'Save plan', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(zh ? '计划已保存' : 'Plan saved');
    const row = page.getByRole('list', { name: zh ? '已保存计划' : 'Saved plans' }).getByRole('listitem').filter({ hasText: 'Disposable draft' });
    page.once('dialog', dialog => dialog.dismiss());
    await row.getByRole('button', { name: zh ? '删除' : 'Delete', exact: true }).click({ timeout: 3000 });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: zh ? '编辑' : 'Edit', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: zh ? '删除' : 'Delete', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(zh ? '计划已删除，已有训练记录仍保留' : 'Plan deleted. Existing training records are preserved.');
    await expect(row).toHaveCount(0);
    await expect(page.getByRole('button', { name: zh ? '取消编辑' : 'Cancel edit', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('list', { name: zh ? '已保存计划' : 'Saved plans' }).getByRole('listitem')).toHaveCount(0);
  });
}

test('plan deletion preserves history, rejects stale and ongoing writes, rolls back and round-trips backups', async ({ page }) => {
  await page.goto('/plans');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/plan-delete-browser.ts';
    return (await import(/* @vite-ignore */ path)).verifyPlanDeletion();
  });
  expect(result).toEqual({ conflict: true, rollback: true, removed: true, blocked: true, ongoingUnchanged: true, retained: true, archived: true, cannotEdit: true, cannotStart: true, cannotReschedule: true, noActiveSchedule: true, roundTrip: true });
});
