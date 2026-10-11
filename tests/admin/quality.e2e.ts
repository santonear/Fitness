import { expect, test } from '@playwright/test';
import { defaultSettings } from '../../src/backend/admin/quality/contracts';

for (const width of [320, 390, 1024, 1440]) test(`quality settings at ${width}px preserve mandatory categories and retry request ID`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const ids: string[] = [];
  await page.route('**/api/v1/management/console/quality/**', async route => {
    if (route.request().method() === 'POST') {
      ids.push(route.request().headers()['x-request-id']);
      if (ids.length === 1) await route.fulfill({ status: 503, json: { error: 'UNCONFIRMED' } });
      else await route.fulfill({ json: { saved: true } });
    } else await route.fulfill({ json: { settings: defaultSettings, available: false, publicKey: null, subscriptions: [] } });
  });
  await page.goto('/tests/admin/quality-fixture.html');
  await expect(page.getByLabel('账本核对（必选）')).toBeChecked();
  await expect(page.getByLabel('账本核对（必选）')).toBeDisabled();
  await expect(page.getByRole('button', { name: '发送测试提醒' })).toBeDisabled();
  await page.getByLabel('错误增加', { exact: true }).uncheck();
  await page.getByRole('button', { name: '保存提醒设置' }).click();
  await expect(page.getByRole('status').filter({ hasText: '结果尚未确认' })).toBeVisible();
  await page.getByRole('button', { name: '重试同一次' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存' })).toBeVisible();
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('errors and reports display real response data and empty states', async ({ page }) => {
  await page.route('**/api/v1/management/console/quality/errors', route => route.fulfill({ json: { groups: [{ type: 'storage', count: 10, first: 1, last: 2, versions: ['1.0.0'], browsers: { Safari: 10 }, currentHour: 10, spike: true, trend: [{ time: 2, count: 10 }] }] } }));
  await page.goto('/tests/admin/quality-fixture.html?view=errors');
  await expect(page.getByText('最近一小时错误增加：10')).toBeVisible();
  await page.getByText('近 24 小时趋势').click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.route('**/api/v1/management/console/quality/reports', route => route.fulfill({ json: { reports: [], blocks: [] } }));
  await page.goto('/tests/admin/quality-fixture.html?view=reports');
  await expect(page.getByText('暂无评测报告。')).toBeVisible();
});
