import { test, expect } from '@playwright/test';

test('media is local until keyboard consent and blocked media preserves catalogue', async ({ page }) => {
 const remote: string[] = [];
 page.on('request', request => { if (/youtube|ytimg/.test(request.url())) remote.push(request.url()); });
 await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
 await page.goto('/exercises');
 await expect(page.getByRole('heading', { name: 'Bodyweight squat', exact: true })).toBeVisible();
 await expect(page.getByText('Original illustration; movement form has not been professionally reviewed.', { exact: true })).toHaveCount(4);
 await expect(page.locator('iframe')).toHaveCount(0);
 expect(remote).toEqual([]);
 const load = page.getByRole('button', { name: 'Load YouTube video (connects to a third party)' }).last();
 await load.focus(); await page.keyboard.press('Enter');
 await expect(page.locator('iframe')).toHaveCount(1);
 await page.getByRole('button', { name: 'Video not working', exact: true }).click();
 await expect(page.getByText('Video unavailable. Written steps remain available.', { exact: true })).toBeVisible();
 await expect(page.locator('iframe')).toHaveCount(0);
 await expect(page.getByText('Stand steadily and extend your arms for balance.', { exact: true })).toBeVisible();
 expect(remote.length).toBeGreaterThan(0);
 await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
 await expect(page.getByText('原创示意图；动作姿势尚未经专业审核。', { exact: true })).toHaveCount(4);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.getByRole('navigation').getByRole('link', { name: '今日', exact: true }).click();
 await expect(page.getByRole('heading', { name: '今日训练', exact: true })).toBeVisible();
});



 test('broken original illustrations retain text and bilingual missing-video fallback', async ({ page }) => {
  await page.route('**/media/*.svg', route => route.abort());
  await page.goto('/exercises');
  await expect(page.getByText('Illustration unavailable. Written steps remain available.', { exact: true })).toHaveCount(4);
  await expect(page.getByText('No confirmed matching video yet. Use the source and written steps.', { exact: true })).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
  await expect(page.getByText('示意图不可用，仍可阅读动作步骤。', { exact: true })).toHaveCount(4);
  await expect(page.getByText('尚无经确认的对应视频。可查看来源和动作步骤。', { exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
