import { expect, test } from '@playwright/test';

test('language has its own button on the welcome page, apart from the style sheet', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '先挑个喜欢的样子（可跳过）' }).click();
  await expect(page.getByRole('dialog').getByRole('radiogroup', { name: '语言' })).toHaveCount(0);
  await page.getByRole('button', { name: '好了', exact: true }).last().click();
  await page.getByRole('button', { name: '语言：中文。切换到 English' }).click();
  await expect(page.getByRole('button', { name: 'Pick a look you like (optional)' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Language: English. Switch to Chinese' }).click();
  await expect(page.getByRole('button', { name: '先挑个喜欢的样子（可跳过）' })).toBeVisible({ timeout: 10_000 });
});
