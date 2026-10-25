import { expect, type Page } from '@playwright/test';

/** 今天's single start (V9.14): the minutes panel's 开始 / Start. */
export const homeStart = (page: Page) => page.locator('.v9-home-now').getByRole('button', { name: /^(开始|Start)$/ });

/** Starts today's planned session: panel 开始 → 今天练这里 → 开始 · N′. */
export async function startToday(page: Page) {
  await homeStart(page).click();
  await expect(page).toHaveURL(/\/today-focus$/);
  await page.getByRole('button', { name: /^(开始|Start) · / }).click();
}

/** 今天's 顺序和时间 is folded to one line (Bo 2026-10-25); opens it when folded. */
export async function openDayView(page: Page) {
  const toggle = page.locator('section.v9-day').getByRole('button', { name: /^(展开|Show)$/ });
  await expect(page.locator('section.v9-day')).toBeVisible();
  if (await toggle.count()) await toggle.click();
}
