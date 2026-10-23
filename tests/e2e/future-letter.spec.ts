import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { answerTexts, basicSafety, generate, startOnboarding } from './helpers/onboarding-v9';

/** 未来来信 (Bo 2026-10-23): written with 几天后打开, opened full screen on 今天 when due, reread on 自记录. */
test.use({ timezoneId: 'Asia/Shanghai' });
const body =
  '给 3 天后的自己：\n希望你还在练。哪怕今天只动了 10 分钟，也是在往前走。\n别忘了你为什么开始：想不再那么容易累。慢一点没关系，别停下。';

async function confirmPlan(page: Page) {
  await startOnboarding(page);
  await answerTexts(page, ['保持力量', '每周3次，每次30分钟', '在家，只有瑜伽垫']);
  await basicSafety(page);
  await generate(page);
  await page.getByRole('button', { name: '就用这份计划' }).click();
  await expect(page.getByRole('heading', { name: '给未来的自己', exact: true })).toBeVisible();
}
const letterDialog = (page: Page) => page.getByRole('dialog', { name: /天前的你/ });

test('a letter opens on 今天 after 7 days; 稍后再看 hides it until the app opens again; 收好 keeps it', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-23T04:00:00Z'));
  await confirmPlan(page);
  const group = page.getByRole('group', { name: '几天后打开' });
  await expect(group.getByRole('button', { name: '7 天', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await group.getByRole('button', { name: '选日期', exact: true }).click();
  await expect(page.getByLabel('选日期')).toHaveAttribute('min', '2026-10-24');
  await expect(page.getByLabel('选日期')).toHaveAttribute('max', '2027-10-23');
  await group.getByRole('button', { name: '7 天', exact: true }).click();
  await page.getByRole('textbox', { name: '给未来的自己' }).fill('希望你还在练。');
  await page.getByRole('button', { name: '收好', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await expect(letterDialog(page)).toHaveCount(0);

  await page.clock.setFixedTime(new Date('2026-10-30T04:00:00Z'));
  await page.goto('/');
  await expect(letterDialog(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: '7 天前的你 · 写给现在的你' })).toBeVisible();
  await expect(letterDialog(page).getByText('10 月 23 日的我')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(letterDialog(page)).toHaveCount(0);
  await page.goto('/');
  await expect(letterDialog(page)).toBeVisible();
  await letterDialog(page).getByRole('button', { name: '收好这封信' }).click();
  await expect(letterDialog(page)).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await expect(letterDialog(page)).toHaveCount(0);

  await page.goto('/settings/changes');
  await page.getByRole('button', { name: '希望你还在练。' }).click();
  await expect(letterDialog(page)).toBeVisible();
  await letterDialog(page).getByRole('button', { name: '关上' }).click();
  await expect(letterDialog(page)).toHaveCount(0);
});

test('letter screenshots: pop at 390 and 1440, data and fire at 390 @screens', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'Screenshots are a chromium self-check');
  test.setTimeout(120_000);
  const dir = process.env.LETTER_SHOTS ?? 'test-results-review/future-letter';
  mkdirSync(dir, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-10-23T04:00:00Z'));
  await confirmPlan(page);
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await page.evaluate(async text => {
    const path = '/src/persistence/db.ts',
      db = (await import(/* @vite-ignore */ path)).database;
    await db.futureLetters.add({
      id: crypto.randomUUID(),
      text,
      createdAt: '2026-10-20T02:00:00.000Z',
      openOn: '2026-10-23',
    });
  }, body);
  for (const [theme, width, height] of [
    ['pop', 390, 844],
    ['pop', 1440, 900],
    ['data', 390, 844],
    ['fire', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => localStorage.setItem('fitness-theme', value), theme);
    await page.goto('/');
    await expect(letterDialog(page)).toBeVisible();
    await expect(page.locator('.v9-letter-dialog[data-ready="true"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/letter-open-${theme}-${width}.png` });
  }
});
