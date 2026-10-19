import { expect, type Page } from '@playwright/test';

/** 今天 has a single AI entry since V9.0.2: the floating 芽芽 orb → 打开对话. Returns the chat dialog. */
export async function openHomeCoach(page: Page) {
  await page.getByRole('button', { name: '芽芽助手，按住可上下拖动' }).click();
  await page.getByRole('dialog', { name: '芽芽快捷助手' }).getByRole('button', { name: '打开对话', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '芽芽', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
/** Local adjustment controls live in their own sheet (快速调整) instead of inside the chat. */
export async function openQuickAdjust(page: Page) {
  await page.getByRole('dialog', { name: '芽芽', exact: true }).getByRole('button', { name: '快速调整', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '快速调整', exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}
/** Consent choices are folded under 发送哪些资料 above the composer; expands them (idempotent). */
export async function showShared(page: Page) {
  const share = page.locator('.assistant-share').first();
  await expect(share).toBeAttached();
  if (!(await share.evaluate(element => (element as HTMLDetailsElement).open))) await share.locator('summary').first().click();
}
