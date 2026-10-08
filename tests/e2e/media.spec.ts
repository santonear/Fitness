import { test, expect } from '@playwright/test';

test('media is local until keyboard consent and blocked media preserves catalogue', async ({ page }) => {
 const remote: string[] = [];
 page.on('request', request => { if (/youtube|ytimg/.test(request.url())) remote.push(request.url()); });
 await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
 await page.goto('/exercises');
 await expect(page.getByRole('button',{name:'View exercise details',exact:true}).first()).toBeVisible();
 for (let i=0;i<4;i++) await page.getByRole('button', {name:'View exercise details',exact:true}).first().click();
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
 await expect(page.locator('li').getByText('Stand steadily and extend your arms for balance.', { exact: true })).toBeVisible();
 expect(remote.length).toBeGreaterThan(0);
 await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
 await expect(page.getByText('原创示意图；动作姿势尚未经专业审核。', { exact: true })).toHaveCount(4);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.getByRole('navigation',{name:/Bottom navigation|底部导航/,exact:true}).getByRole('link', { name: '今日', exact: true }).click();
 await expect(page.getByRole('heading', { name: '你的性别是？', exact: true })).toBeVisible();
});



 test('broken original illustrations retain text and bilingual video controls', async ({ page }) => {
  await page.route('**/media/*.svg', route => route.abort());
  await page.goto('/exercises');
 await expect(page.getByRole('button',{name:'View exercise details',exact:true}).first()).toBeVisible();
 for (let i=0;i<4;i++) await page.getByRole('button', {name:'View exercise details',exact:true}).first().click();
  await expect(page.getByText('Illustration unavailable. Written steps remain available.', { exact: true })).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Load YouTube video (connects to a third party)', exact: true })).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
  await expect(page.getByText('示意图不可用，仍可阅读动作步骤。', { exact: true })).toHaveCount(4);
  await expect(page.getByRole('button', { name: '加载 YouTube 视频（连接第三方）', exact: true })).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });

test('walking and plank load only their matched resources and preserve fallback at 320px', async ({ page }) => {
 await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
 await page.setViewportSize({ width: 320, height: 720 });
 await page.goto('/exercises');
 await expect(page.getByRole('button',{name:'View exercise details',exact:true}).first()).toBeVisible();
 for (let i=0;i<4;i++) await page.getByRole('button', {name:'View exercise details',exact:true}).first().click();
 await expect(page.locator('iframe')).toHaveCount(0);
 const walking = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Walking', exact: true }) });
 await expect(walking.getByText(/Only the walking portion is referenced/)).toBeVisible();
 for (const [name, id] of [['Walking', '4PR9GedBrZY'], ['Plank', 'P3FR4GUl2QM']]) {
  const article = page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await article.getByRole('button', { name: 'Load YouTube video (connects to a third party)', exact: true }).click();
  await expect(article.locator('iframe')).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${id}?autoplay=0`);
  await expect(article.locator('iframe')).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await article.getByRole('button', { name: 'Video not working', exact: true }).click();
  await expect(article.getByRole('status')).toHaveText('Video unavailable. Written steps remain available.');
  await expect(article.locator('ol li').first()).toBeVisible();
  await article.getByRole('button', { name: 'Close video', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
 await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
 await expect(page.getByText(/这里只参考步行部分/)).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
