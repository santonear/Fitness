import { expect, test } from '@playwright/test';
import { defaultSettings } from '../../src/backend/admin/quality/contracts';

for (const width of [320, 390, 1024, 1440])
  test(`quality settings at ${width}px preserve mandatory categories and retry request ID`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const ids: string[] = [];
    await page.route('**/api/v1/management/console/quality/**', async route => {
      if (route.request().method() === 'POST') {
        ids.push(route.request().headers()['x-request-id']);
        if (ids.length === 1) await route.fulfill({ status: 503, json: { error: 'UNCONFIRMED' } });
        else await route.fulfill({ json: { saved: true } });
      } else
        await route.fulfill({
          json: { settings: defaultSettings, available: false, publicKey: null, subscriptions: [] },
        });
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
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
test('errors and reports display real response data and empty states', async ({ page }) => {
  await page.route('**/api/v1/management/console/quality/errors', route =>
    route.fulfill({
      json: {
        groups: [
          {
            type: 'storage',
            count: 10,
            first: 1,
            last: 2,
            versions: ['1.0.0'],
            browsers: { Safari: 10 },
            currentHour: 10,
            spike: true,
            trend: [{ time: 2, count: 10 }],
          },
        ],
      },
    }),
  );
  await page.goto('/tests/admin/quality-fixture.html?view=errors');
  await expect(page.getByText('最近一小时错误增加：10')).toBeVisible();
  await page.getByText('近 24 小时趋势').click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.route('**/api/v1/management/console/quality/reports', route =>
    route.fulfill({ json: { reports: [], blocks: [] } }),
  );
  await page.goto('/tests/admin/quality-fixture.html?view=reports');
  await expect(page.getByText('暂无评测报告。')).toBeVisible();
});
test('quality report enums are translated while model and prompt identifiers remain intact', async ({ page }) => {
  await page.route('**/api/v1/management/console/quality/reports', route =>
    route.fulfill({
      json: {
        reports: [
          {
            id: 'synthetic',
            time: 1,
            promptVersion: 'v8.1.0',
            model: 'model-test-v1',
            durationMs: 1,
            costMicros: 0,
            scenarios: [
              { scenario: 'tone', passed: true, violations: 0 },
              { scenario: 'unknown_future', passed: false, violations: 1 },
            ],
          },
        ],
        blocks: [
          { day: '2026-10-11', category: 'judgment', count: 1 },
          { day: '2026-10-11', category: 'private_unknown', count: 1 },
        ],
      },
    }),
  );
  await page.goto('/tests/admin/quality-fixture.html?view=reports');
  await expect(page.locator('main')).toContainText('表达语气');
  await expect(page.locator('main')).toContainText('评判表达');
  await expect(page.locator('main')).toContainText('其他或尚未记录');
  await expect(page.locator('main')).toContainText('v8.1.0 · model-test-v1');
  await expect(page.locator('main')).not.toContainText('private_unknown');
  await page.goto('/tests/admin/quality-fixture.html?view=reports&language=en');
  await expect(page.locator('main')).toContainText('Tone checks');
  await expect(page.locator('main')).toContainText('Judgmental wording');
  await expect(page.locator('main')).toContainText('Other / not recorded');
});

for (const language of ['zh', 'en'])
  test(`user and application enums use ${language} labels`, async ({ page }) => {
    await page.route('**/api/v1/management/console/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/applications'))
        await route.fulfill({
          json: {
            items: ['pending', 'approved', 'rejected', 'claimed'].map((state, i) => ({
              id: `10000000-00${i}1`,
              name: `Fixture ${i}`,
              note: 'Synthetic application',
              state,
              kind: ['new', 'extend', 'replace', 'new'][i],
              createdAt: 1,
              directlyActivated: false,
            })),
          },
        });
      else if (path.endsWith('/users/list'))
        await route.fulfill({
          json: {
            items: ['normal', 'expiring', 'quota-unknown'].map((previewLabel, index) => ({
              id: ['91000000-0001', '92000000-0002', '93000000-0003'][index],
              previewLabel,
              expiresAt: Date.now() + 86400000,
              revoked: false,
              expired: false,
              usage: [],
            })),
            invites: [],
          },
        });
      else if (path.endsWith('/users/detail'))
        await route.fulfill({
          json: {
            requests: ['reserved', 'submitted', 'pending', 'settled', 'released'].map((status, i) => ({
              id: `request-${i}`,
              operation: ['understand', 'generate', 'summary', 'generate', 'summary'][i],
              status,
              period: '2026-10',
              costFen: null,
            })),
            history: [
              { at: 1, event: 'subject-directly-activated' },
              { at: 2, event: 'quota-restored' },
              { at: 3, event: 'quota-restore-unknown' },
            ],
          },
        });
      else await route.fulfill({ json: { items: [] } });
    });
    await page.goto(`/tests/admin/quality-fixture.html?view=applications&language=${language}`);
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(language === 'zh' ? '待处理' : 'Awaiting review');
    await expect(rows.first()).toContainText(language === 'zh' ? '首次申请' : 'New application');
    await page.getByRole('button', { name: language === 'zh' ? /^已批准/ : /^Approved/ }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('tbody')).toContainText(language === 'zh' ? '延长资格' : 'Access extension');
    await expect(page.locator('tbody')).toContainText(language === 'zh' ? '已领取资格' : 'Access claimed');
    await page.getByRole('button', { name: language === 'zh' ? /^已拒绝/ : /^Declined/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(language === 'zh' ? '补领激活码' : 'Replacement code');
    await page.getByRole('button', { name: language === 'zh' ? /^全部/ : /^All/ }).click();
    await expect(rows).toHaveCount(4);
    await expect(page.locator('main')).not.toContainText('pending');
    await page.goto(`/tests/admin/quality-fixture.html?view=users&language=${language}`);
    await expect(
      page.getByRole('button', {
        name: language === 'zh' ? /预览合成 · 即将到期/ : /Synthetic preview · Expiring soon/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: language === 'zh' ? /预览合成 · 额度恢复结果未知/ : /Synthetic preview · Quota restoration unconfirmed/,
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: language === 'zh' ? /预览合成 · 正常/ : /Synthetic preview · Active/ })
      .click();
    for (const value of language === 'zh'
      ? [
          '理解目标',
          '生成计划',
          '阶段回顾',
          '已预留费用',
          '已发送，等待结果',
          '结果待核对',
          '已核算',
          '预留已释放',
          '已免邀请码开通',
          '额度已恢复',
        ]
      : [
          'Goal interpretation',
          'Plan generation',
          'Period review',
          'Cost reserved',
          'Submitted, awaiting result',
          'Result needs reconciliation',
          'Reconciled',
          'Reservation released',
          'Access activated directly',
          'Quota restored',
        ])
      await expect(page.locator('main')).toContainText(value);
    await expect(page.locator('main')).not.toContainText('subject-directly-activated');
    await expect(page.locator('main')).toContainText(
      language === 'zh' ? '额度恢复结果未确认（合成演示）' : 'Quota restoration unconfirmed (synthetic example)',
    );
  });

test('cancelling an unconfirmed retry preserves the original request ID', async ({ page }) => {
  const ids: string[] = [];
  await page.route('**/api/v1/management/console/**', async route => {
    if (route.request().method() === 'POST') {
      ids.push(route.request().headers()['x-request-id']);
      await route.fulfill({
        status: ids.length === 1 ? 503 : 200,
        json: ids.length === 1 ? { error: 'ADMIN_UNAVAILABLE' } : { ok: true },
      });
    } else await route.fulfill({ json: { items: [], invites: [] } });
  });
  await page.goto('/tests/admin/quality-fixture.html?view=users');
  await page.getByRole('button', { name: '手动生成邀请码' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: '重试同一次' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试同一次' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('admin-user-pending')!).id)).toBe(ids[0]);
  await page.getByRole('button', { name: '重试同一次' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect.poll(() => ids.length).toBe(2);
  expect(ids[1]).toBe(ids[0]);
});
