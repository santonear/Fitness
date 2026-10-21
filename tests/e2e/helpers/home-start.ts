import { expect, type Page } from '@playwright/test';

/** 今天's single start (V9.14): the minutes panel's 开始 / Start. */
export const homeStart = (page: Page) => page.locator('.v9-home-now').getByRole('button', { name: /^(开始|Start)$/ });

/** Starts today's planned session: panel 开始 → 今天练这里 → 开始 · N′. */
export async function startToday(page: Page) {
  await homeStart(page).click();
  await expect(page).toHaveURL(/\/today-focus$/);
  await page.getByRole('button', { name: /^(开始|Start) · / }).click();
}
