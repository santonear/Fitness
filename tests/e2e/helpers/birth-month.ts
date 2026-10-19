import type { Page } from '@playwright/test';

/** Fills the year-plus-month birth field used in onboarding and settings. */
export async function fillBirthMonth(page: Page, value: string) {
  const [year, month] = value.split('-');
  const group = page.getByRole('group', { name: '出生年月', exact: true });
  await group.getByLabel('出生年份', { exact: true }).fill(year);
  await group.getByLabel('月份', { exact: true }).selectOption(month);
}
