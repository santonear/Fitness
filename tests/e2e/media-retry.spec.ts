import { test, expect } from '@playwright/test';

test('failed videos can retry and close with written steps preserved in both languages', async ({ page }) => {
 const remote: string[] = [];
 page.on('request', request => { if (/youtube|ytimg/.test(request.url())) remote.push(request.url()); });
 await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
 await page.goto('/exercises');
 await expect(page.getByRole('heading', { name: 'Bodyweight squat', exact: true })).toBeVisible();
 expect(remote).toEqual([]);
 await expect(page.getByText('The publisher page links this video; this confirms source association only.', { exact: true })).toBeVisible();
 await expect(page.getByText('Only the search title matches this exercise; publisher identity has not been independently verified.', { exact: true })).toBeVisible();
 for (const locale of ['en', 'zh']) {
  await page.getByRole('combobox', { name: 'Language' }).selectOption(locale);
  const zh = locale === 'zh';
  await page.getByRole('button', { name: zh ? '加载 YouTube 视频（连接第三方）' : 'Load YouTube video (connects to a third party)', exact: true }).last().click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.getByRole('button', { name: zh ? '视频无法播放' : 'Video not working', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  const retry = page.getByRole('button', { name: zh ? '重试视频（连接第三方）' : 'Retry video (connects to a third party)', exact: true });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.getByRole('button', { name: zh ? '关闭视频' : 'Close video', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: zh ? '加载 YouTube 视频（连接第三方）' : 'Load YouTube video (connects to a third party)', exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
 await page.getByRole('combobox', { name: '语言' }).selectOption('en');
 await expect(page.getByText('Stand steadily and extend your arms for balance.', { exact: true })).toBeVisible();
 await page.getByRole('navigation').getByRole('link', { name: 'Today', exact: true }).click();
 await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
});
