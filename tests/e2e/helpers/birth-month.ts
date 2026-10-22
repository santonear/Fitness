import type { Page } from '@playwright/test';

/** Fills the birth year and month used in onboarding and settings (switches to 手动输入 first). */
export async function fillBirthMonth(page: Page, value: string) {
  const [year, month] = value.split('-');
  const group = page.getByRole('group', { name: '出生年月', exact: true });
  const manual = group.getByRole('button', { name: '手动输入', exact: true });
  const input = group.getByLabel('出生年份', { exact: true });
  await manual.or(input).first().waitFor();
  if ((await manual.count()) && (await manual.getAttribute('aria-pressed')) !== 'true') await manual.click();
  await input.fill(year);
  await group.getByLabel('月份', { exact: true }).selectOption(month);
}
