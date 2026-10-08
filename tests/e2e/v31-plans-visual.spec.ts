import { test, expect } from '@playwright/test';
for (const theme of ['atlas', 'serene', 'orbit']) {
  test(`${theme} plans calendar and manual form fit desktop and mobile`, async ({ page }) => {
    await page.addInitScript(theme => localStorage.setItem('fitness-appearance-v31', theme), theme);
    await page.goto('/plans');
    await page.getByRole('tab', { name: 'Calendar', exact: true }).waitFor();
    await expect(page.getByText('Loading your local plans…', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 768 ? 1000 : 844 });
      await expect(page.locator('html')).toHaveAttribute('data-appearance', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (width === 390 || width === 1440) await page.screenshot({ path: `outputs/v31-plans-${theme}-${width}.png`, fullPage: true });
    }
    await page.getByRole('tab', { name: 'Create plan', exact: true }).click();
    await page.getByRole('button', { name: 'Create manually', exact: true }).click();
    const create = page.getByRole('tabpanel', { name: 'Create plan', exact: true });
    await create.locator('[data-plan-date]:not(.outside-month)').nth(10).click();
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `outputs/v31-plans-manual-${theme}-320.png`, fullPage: true });
  });
}
