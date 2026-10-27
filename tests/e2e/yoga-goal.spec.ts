import { expect, test, type Page } from '@playwright/test';
import { answerTexts, engineSafety, startOnboarding } from './helpers/onboarding-v9';

/** Yoga as its own goal (Bo 2026-10-26): the onboarding preset leads to a plan of 瑜伽 sessions. */
test.setTimeout(120000);
const shot = (page: Page, name: string) =>
  process.env.YOGA_SHOTS
    ? page
        .waitForTimeout(1500)
        .then(() => page.screenshot({ path: `test-results-review/yoga/${name}.png`, fullPage: true }))
    : null;

test('the yoga preset gives a plan of 瑜伽 sessions that start pose by pose', async ({ page }) => {
  await page.route('**/api/v1/features', route =>
    route.fulfill({ json: { version: 1, flags: { trainingEngine: true }, expiresAt: Date.now() + 3600000 } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await startOnboarding(page);
  await expect(page.getByRole('radio', { name: '想练瑜伽，身心都舒展', exact: true })).toBeVisible();
  await shot(page, 'goal-390');
  await answerTexts(page, ['想练瑜伽，身心都舒展', '每周 2 次，每次 30 分钟', '在家，没有器械']);
  await engineSafety(page);
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();
  const skip = page.getByRole('button', { name: '跳过', exact: true });
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByRole('button', { name: '就用这份计划', exact: true })).toBeVisible();
  await expect(page.getByText('瑜伽', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('draft-yoga')).toHaveText(
    '这份按瑜伽来排：每次从静心开始，到摊尸式放松结束。每个体式点一下开始，跟着呼吸来就好。🌱',
  );
  await shot(page, 'draft-390');
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, 'draft-1440');
});
