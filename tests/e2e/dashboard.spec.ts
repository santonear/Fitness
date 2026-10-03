import { expect, test } from '@playwright/test';

test('dashboard uses empty real-data states and updates after a completed workout', async ({ page }) => {
  await page.goto('/');
  const summary = page.getByRole('region', { name: 'Training overview', exact: true });
  await expect(summary.getByText('No tasks due', { exact: true })).toBeVisible();
  await expect(summary.getByText('No weight observations yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent training', exact: true })).toContainText('No completed sessions yet.');
  await page.getByRole('button', { name: 'Start temporary workout', exact: true }).click();
  await page.getByLabel('Reps', { exact: true }).fill('12');
  await page.getByLabel('Load (kg)', { exact: true }).fill('2.5');
  await page.getByRole('button', { name: 'Record set', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Set saved');
  await page.getByRole('button', { name: 'Review completion', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Workout completed');
  await expect(summary.getByLabel('Completed sessions', { exact: true })).toHaveText('1');
  await expect(page.getByRole('region', { name: 'Recent training', exact: true })).toContainText('Goblet squat');
  await page.reload();
  await expect(summary.getByLabel('Completed sessions', { exact: true })).toHaveText('1');
  await expect(summary.getByText('No tasks due', { exact: true })).toBeVisible();
});

test('dashboard respects responsive layout and accessible navigation in both languages', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Training overview', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await page.getByRole('navigation').getByRole('link').all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByLabel('Language', { exact: true }).selectOption('zh');
  await expect(page.getByRole('region', { name: '训练概览', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日训练', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '最近训练', exact: true })).toContainText('暂无已完成训练。');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
});
