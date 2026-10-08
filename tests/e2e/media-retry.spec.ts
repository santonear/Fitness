import { test, expect } from '@playwright/test';

test('failed videos can retry and close with written steps preserved in both languages', async ({ page }) => {
 const remote: string[] = [];
 page.on('request', request => { if (/youtube|ytimg/.test(request.url())) remote.push(request.url()); });
 await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
 await page.goto('/exercises');
 await expect(page.getByRole('button',{name:'View exercise details',exact:true}).first()).toBeVisible();
 for (let i=0;i<4;i++) await page.getByRole('button', {name:'View exercise details',exact:true}).first().click();
 await expect(page.getByRole('heading', { name: 'Bodyweight squat', exact: true })).toBeVisible();
 expect(remote).toEqual([]);
 await expect(page.getByText('The publisher page or document links this video; this confirms source association only.', { exact: true })).toHaveCount(3);
 await expect(page.getByText('YouTube metadata confirms the video title and channel name; this confirms source information only.', { exact: true })).toBeVisible();
 for (const locale of ['en', 'zh']) {
  await page.getByRole('combobox', { name: 'Language' }).selectOption(locale);
  const zh = locale === 'zh';
  await page.getByRole('button', { name: zh ? '加载 YouTube 视频（连接第三方）' : 'Load YouTube video (connects to a third party)', exact: true }).last().click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await page.getByRole('button', { name: zh ? '视频无法播放' : 'Video not working', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  const retry = page.getByRole('button', { name: zh ? '重试视频（连接第三方）' : 'Retry video (connects to a third party)', exact: true });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.getByRole('button', { name: zh ? '关闭视频' : 'Close video', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: zh ? '加载 YouTube 视频（连接第三方）' : 'Load YouTube video (connects to a third party)', exact: true })).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
 await page.getByRole('combobox', { name: '语言' }).selectOption('en');
 await expect(page.locator('li').getByText('Stand steadily and extend your arms for balance.', { exact: true })).toBeVisible();
 await page.getByRole('navigation',{name:/Bottom navigation|底部导航/,exact:true}).getByRole('link', { name: 'Today', exact: true }).click();
 await expect(page.getByRole('heading', { name: 'Make today your own.', exact: true })).toBeVisible();
});
