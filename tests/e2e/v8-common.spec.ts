import { expect, test } from '@playwright/test';

for (const theme of ['qingci', 'liubai', 'jingshe', 'zhuangse']) for (const width of [390, 1440]) {
  test(`${theme} ${width}: native interactions, motion and geometry`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(`/tests/e2e/helpers/v8-common.html?theme=${theme}`);
    const start = page.getByRole('button', { name: '开始训练' });
    await expect(start).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), fullPage: true });
    for (const control of await page.locator('button, a').all()) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(72);
    expect((await page.getByRole('button', { name: '查看计划' }).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect((await page.locator('.v8-row').boundingBox())!.height).toBeGreaterThanOrEqual(52);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await start.focus(); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
    await expect(page.getByLabel('操作次数')).toHaveText('2');
    await expect(start).toBeFocused();
    expect(await start.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await expect(page.getByRole('button', { name: '不可用' })).toBeDisabled();
    const chip = page.getByRole('button', { name: '哑铃' });
    await chip.click(); await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const toggle = page.getByRole('switch'); await toggle.focus(); await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '本月' }).click();
    await expect(page.getByRole('button', { name: '本月' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '本周' })).toHaveAttribute('aria-pressed', 'false');
    await start.hover(); await page.mouse.down();
    await expect.poll(() => start.evaluate(el => getComputedStyle(el).transform)).toBe(theme === 'zhuangse' ? 'matrix(0.98, 0, 0, 0.98, 3, 3)' : 'matrix(0.96, 0, 0, 0.96, 0, 0)');
    if (theme === 'zhuangse') expect(await start.evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
    await page.mouse.up(); await expect.poll(() => start.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await start.hover(); await page.mouse.down();
    expect(await start.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    expect(await start.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
    await page.mouse.up();
    await page.getByRole('link').click(); await expect(page).toHaveURL(/#details$/);
  });
}
