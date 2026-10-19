import { expect, test } from '@playwright/test';

test('language can be switched from the style sheet on the welcome page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '先挑个喜欢的样子（可跳过）' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radiogroup', { name: '语言' }).getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'Done', exact: true }).last()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: '中文' }).click();
  await expect(page.getByRole('button', { name: '好了', exact: true }).last()).toBeVisible({ timeout: 10_000 });
});
