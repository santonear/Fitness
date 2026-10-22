import { expect, test, type Page } from '@playwright/test';

/** Bo 2026-10-19: 我的 drops 界面风格, hides training reminders by default and adds 给我们留言. */
const flags = (page: Page, extra: Record<string, boolean> = {}) =>
  page.route('**/api/v1/features', route =>
    route.fulfill({ json: { version: 1, flags: extra, expiresAt: Date.now() + 3600000 } }),
  );

test('我的: no 界面风格 or training reminders by default; 给我们留言 states the recipient, sends only the text and keeps a local copy', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'zh'));
  await flags(page);
  const sent: Record<string, unknown>[] = [];
  let fail = true;
  await page.route('**/api/v1/feedback', route => {
    sent.push(route.request().postDataJSON());
    if (fail) {
      fail = false;
      return route.fulfill({ status: 503, json: { error: 'SERVICE_UNAVAILABLE' } });
    }
    return route.fulfill({ status: 201, json: { ok: true } });
  });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '我的', exact: true })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '界面风格' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '提醒', exact: true })).toHaveCount(0);
  await expect(page.locator('#reminders')).toHaveCount(0);

  await page.getByRole('button', { name: /^给我们留言/ }).click();
  await expect(page.getByText(/留言会发送给 Fitness 的运营者/)).toBeVisible();
  await expect(page.getByText(/不会附带你的训练、身体或聊天记录/)).toBeVisible();
  const send = page.getByRole('button', { name: '发送给运营者', exact: true });
  await expect(send).toBeDisabled();
  await page.getByLabel('想说的话').fill('希望能把计划同步到手机日历');
  await expect(page.getByText('13/1000')).toBeVisible();
  await page.getByLabel('联系方式（选填）').fill('me@example.com');
  await send.click();
  // A failure keeps the draft; the retry reuses the same request ID.
  await expect(page.getByRole('status').filter({ hasText: '暂时发不出去' })).toBeVisible();
  await expect(page.getByLabel('想说的话')).toHaveValue('希望能把计划同步到手机日历');
  await send.click();
  await expect(page.getByRole('status').filter({ hasText: '已发送，谢谢你' })).toBeVisible();
  await expect(page.getByLabel('想说的话')).toHaveValue('');
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual({
    id: sent[0].id,
    message: '希望能把计划同步到手机日历',
    contact: 'me@example.com',
    locale: 'zh',
  });
  const history = page.getByRole('region', { name: /你发过的留言/ });
  await expect(history.getByText('希望能把计划同步到手机日历')).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
    await page.getByLabel('想说的话').scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`me-feedback-pop-${width}.png`) });
  }
  await page.reload();
  await page.getByRole('button', { name: /^给我们留言/ }).click();
  await expect(
    page.getByRole('region', { name: /你发过的留言/ }).getByText('希望能把计划同步到手机日历'),
  ).toBeVisible();
});

test('training reminder settings come back only when the flag is on', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'zh'));
  await flags(page, { trainingReminders: true });
  await page.goto('/settings#reminders');
  await expect(page.getByRole('button', { name: '提醒', exact: true })).toBeVisible();
  await expect(page.getByLabel('时间', { exact: true })).toBeVisible();
});
