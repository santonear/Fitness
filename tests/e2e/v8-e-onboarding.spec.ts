import { expect, test, type Page } from '@playwright/test';
import { answerText, nextButton } from './helpers/onboarding-v9';
async function questions(page: Page) {
  await expect(nextButton(page)).toBeDisabled();
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await expect(page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('什么时候练？');
  await answerText(page, '每周两次，每次 15 分钟');
  await answerText(page, '在家，只有瑜伽垫');
}
async function toReady(page: Page) {
  await expect(nextButton(page)).toBeDisabled();
  await page.getByRole('button', { name: '我已年满 18 岁' }).click();
  await nextButton(page).click();
  await page.getByRole('radio', { name: '有，选一下部位' }).click();
  await page.getByRole('button', { name: '膝盖', exact: true }).click();
  await page.getByRole('button', { name: '肩', exact: true }).click();
  await expect(page.getByRole('button', { name: '膝盖', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('radio', { name: '没有', exact: true }).click();
  await expect(page.getByRole('button', { name: '膝盖', exact: true })).toHaveCount(0);
  await nextButton(page).click();
}
for (const theme of ['pop', 'vivid', 'gentle', 'data', 'fire'])
  for (const width of [390, 1440]) {
    test(`${theme} ${width} adult gate, consent, explicit candidate confirmation`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/tests/e2e/helpers/v8-e-onboarding.html?theme=${theme}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${theme}-${width}-question.png`), fullPage: true });
      await questions(page);
      await toReady(page);
      const generate = page.getByRole('button', { name: '生成计划', exact: true });
      await page.getByRole('button', { name: '先自己练练', exact: true }).click();
      await expect(page.getByLabel('manual calls')).toHaveText('1');
      await expect(page.getByLabel('generate calls')).toHaveText('0');
      await page.locator('summary').click();
      await expect(page.getByText('每周两次，每次 15 分钟', { exact: true })).toBeVisible();
      await expect(page.getByLabel('generate calls')).toHaveText('0');
      await page.screenshot({ path: info.outputPath(`${theme}-${width}-safety.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await generate.click();
      await expect(page.getByLabel('generate calls')).toHaveText('1');
      await expect(page.getByLabel('confirm calls')).toHaveText('0');
      await page.locator('.v9-session summary').first().click();
      await page.locator('button.v9-item').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.locator('.v9-item').first().getByText('哑铃', { exact: true })).toBeVisible();
      await expect(page.locator('.v9-item').first()).not.toContainText('dumbbell');
      await expect(
        page
          .locator('.v9-item')
          .first()
          .getByText(/^2 组 · 8 次$/),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: '为什么这样排' })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${theme}-${width}-draft.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
      await expect(page.getByLabel('confirm calls')).toHaveText('1');
    });
  }
test('basic mode also requires adulthood and never presents external consent or AI upsell', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/v8-e-onboarding.html?basic');
  await questions(page);
  await expect(nextButton(page)).toBeDisabled();
  await toReady(page);
  await expect(page.getByText('基础计划', { exact: true })).toHaveCount(0);
  await expect(page.getByText('开启 AI 后可以得到更贴合的计划', { exact: true })).toHaveCount(0);
  await expect(page.locator('summary')).toHaveCount(0);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '上一步', exact: true }).click();
  // The user's own words come back as the value, not as a grey placeholder.
  await expect(page.getByLabel('你的回答', { exact: true })).toHaveValue('在家，只有瑜伽垫');
});
test('English controls, keyboard activation and busy draft prevent writes', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/v8-e-onboarding.html?lang=en');
  await page.getByRole('button', { name: 'Write my own', exact: true }).click();
  await page.getByLabel('Your answer', { exact: true }).fill('Keep my own words');
  await page.getByRole('button', { name: 'Next', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('When can you train?');
  await page.goto('/tests/e2e/helpers/v8-e-onboarding.html?draft&busy&lang=en');
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('confirm calls')).toHaveText('0');
});
