import { expect, test, type Page } from '@playwright/test';
async function questions(page: Page) {
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '想有些力量，不再容易累', exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByText('想有些力量，不再容易累', { exact: true })).toBeVisible();
  await page.getByLabel('你的回答', { exact: true }).fill('每周两次，每次 15 分钟');
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('button', { name: '在家，只有瑜伽垫', exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
}
for (const theme of ['qingci', 'liubai', 'jingshe', 'zhuangse']) for (const width of [390, 1440]) {
  test(`${theme} ${width} adult gate, consent, explicit candidate confirmation`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/tests/e2e/helpers/v8-e-onboarding.html?theme=${theme}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${theme}-${width}-question.png`), fullPage: true });
    await questions(page);
    const generate = page.getByRole('button', { name: '生成我的第一版计划', exact: true });
    await expect(generate).toBeDisabled();
    await page.getByRole('button', { name: '手动训练', exact: true }).click();
    await expect(page.getByLabel('manual calls')).toHaveText('1');
    await expect(page.getByLabel('generate calls')).toHaveText('0');
    await page.getByRole('button', { name: '膝盖', exact: true }).click();
    await page.getByRole('button', { name: '肩', exact: true }).click();
    await expect(page.getByRole('button', { name: '没有', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '没有', exact: true }).click();
    await expect(page.getByRole('button', { name: '膝盖', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('checkbox').check();
    await page.locator('summary').click();
    await expect(page.getByText('每周两次，每次 15 分钟', { exact: true })).toBeVisible();
    await expect(page.getByLabel('generate calls')).toHaveText('0');
    await page.screenshot({ path: info.outputPath(`${theme}-${width}-safety.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await generate.click();
    await expect(page.getByLabel('generate calls')).toHaveText('1');
    await expect(page.getByLabel('confirm calls')).toHaveText('0');
    await page.locator('.v8-draft-exercise summary').first().click();
    await expect(page.locator('.v8-draft-exercise').first().getByText('哑铃', { exact: true })).toBeVisible();
    await expect(page.locator('.v8-draft-exercise').first()).not.toContainText('dumbbell');
    await expect(page.locator('.v8-draft-exercise').first().getByText('8 次', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${theme}-${width}-draft.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
    await expect(page.getByLabel('confirm calls')).toHaveText('1');
  });
}
test('basic mode also requires adulthood and never presents external consent', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/v8-e-onboarding.html?basic'); await questions(page);
  await expect(page.getByText('基础计划', { exact: true })).toBeVisible();
  await expect(page.locator('summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '生成我的第一版计划' })).toBeDisabled();
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  await expect(page.getByLabel('你的回答', { exact: true })).toHaveValue('在家，只有瑜伽垫');
});
test('English controls, keyboard activation and busy draft prevent writes', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/v8-e-onboarding.html?lang=en');
  await page.getByLabel('Your answer', { exact: true }).fill('Keep my own words');
  await page.getByRole('button', { name: 'Continue', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Keep my own words', { exact: true })).toBeVisible();
  await page.goto('/tests/e2e/helpers/v8-e-onboarding.html?draft&busy&lang=en');
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('confirm calls')).toHaveText('0');
});
