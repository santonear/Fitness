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

test('大字号 sits beside the language button, enlarges the type scale and stays on this device', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html'),
    toggle = page.getByRole('button', { name: '大字号', exact: true });
  const body = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--t3').trim());
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await body()).toBe('15px');
  await toggle.click();
  await expect(html).toHaveAttribute('data-text-size', 'large');
  expect(await body()).toBe('17px');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(html).not.toHaveAttribute('data-text-size', /.+/);
  expect(await page.evaluate(() => localStorage.getItem('fitness-text-size'))).toBeNull();
});
