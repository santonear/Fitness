import { test, expect, type Page } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
const subjectId = '22222222-2222-4222-8222-222222222222';
function report() {
  return {
    applications: [{ id, name: '小林', kind: 'new', state: 'pending', createdAt: 1791504000000, note: '希望开始规律训练' }],
    invites: [], audit: [], quotaRestorations: [],
    quotas: [{ subjectId, period: '2026-10', limits: { generate: 4, understand: 8 }, used: { generate: 2, understand: 3 }, defaults: { generate: 4, understand: 8 } }],
    report: { aiEnabled: true, capturedAt: 1791504000000, budgets: [], requests: [], subjects: [{ subjectId, expiresAt: Date.now() + 86400000, expired: false, revoked: false }] },
    policy: { budgetLimit: 3000, reservation: 300, timeZone: 'Asia/Shanghai', planningBudgetDisabled: true }, service: {},
  };
}
async function mock(page: Page, options: { failRead?: boolean; failQuota?: boolean } = {}) {
  const writes: { op: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/features') return route.fulfill({ json: { version: 1, flags: {}, expiresAt: Date.now() + 60_000 } });
    const op = path.replace('/api/v1/management/', '');
    if (op === 'applications') return route.fulfill({ status: options.failRead ? 403 : 200, json: options.failRead ? { error: 'FORBIDDEN' } : report() });
    writes.push({ op, body: route.request().postDataJSON() });
    if (op === 'quota-restore' && options.failQuota) return route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } });
    return route.fulfill({ json: {} });
  });
  return writes;
}
test('Chinese default, semantic table, full ID clipboard and approve payload', async ({ page }) => {
  const writes = await mock(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { sessionStorage.setItem('copied', value); } } }));
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '应用管理' })).toBeVisible();
  const table = page.getByRole('table', { name: '申请审核' });
  await expect(table.getByRole('columnheader')).toHaveText(['称呼', '类型', '状态', '时间', '备注', '操作']);
  await expect(table.getByText(id, { exact: true })).toHaveCount(0);
  await table.getByRole('button', { name: '复制申请 ID 11111111' }).click();
  await expect(page.getByRole('status')).toHaveText('已复制完整 ID');
  expect(await page.evaluate(() => sessionStorage.getItem('copied'))).toBe(id);
  await expect(table.getByRole('button', { name: '拒绝', exact: true })).toBeDisabled();
  await table.getByLabel('处理说明').fill('已核对');
  await page.getByRole('button', { name: '操作记录', exact: true }).click();
  await page.getByRole('button', { name: '申请审核', exact: true }).click();
  await expect(table.getByLabel('处理说明')).toHaveValue('已核对');
  await table.getByRole('button', { name: '批准', exact: true }).click();
  await expect.poll(() => writes).toEqual([{ op: 'application-review', body: { id, decision: 'approve', reason: '已核对' } }]);
  await expect(page.getByText(/AI 架构评审|契约示例|评测面板/)).toHaveCount(0);
});
test('direct activation cancellation makes no mutation and approval is primary', async ({ page }) => {
  const writes = await mock(page); await page.goto('/admin');
  const direct = page.getByRole('button', { name: '免邀请码直接开通' });
  await expect(direct).toHaveClass(/admin-text-action/);
  await expect(page.getByRole('button', { name: '批准', exact: true })).toHaveClass(/admin-primary/);
  page.once('dialog', dialog => dialog.dismiss()); await direct.click(); expect(writes).toEqual([]);
  page.once('dialog', dialog => dialog.accept()); await direct.click();
  await expect.poll(() => writes).toEqual([{ op: 'application-activate', body: { id } }]);
});
test('explicit English choice survives admin initialization; failed copy has feedback', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('fitness.language', 'en'); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw Error('denied'); } } }); });
  await mock(page); await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Application management' })).toBeVisible();
  await page.getByRole('button', { name: 'Copy application ID 11111111' }).click();
  await expect(page.getByRole('status')).toHaveText('Copy failed. Please retry.');
});
test('denied report exposes no application actions', async ({ page }) => {
  const writes = await mock(page, { failRead: true }); await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('操作或状态查询失败');
  await expect(page.getByRole('button', { name: '批准', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '清理已超过保留期的申请资料' })).toBeDisabled();
  expect(writes).toEqual([]);
});
test('quota retry keeps same id and preserved controls remain available', async ({ page }) => {
  const writes = await mock(page, { failQuota: true }); await page.goto('/admin');
  await page.getByRole('button', { name: '试用资格', exact: true }).click();
  await expect(page.getByRole('button', { name: '生成邀请码', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '删除账号' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '撤销资格' })).toBeEnabled();
  await page.getByLabel('恢复原因').fill('补回失败的生成');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '刷新额度' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('恢复原因')).toBeDisabled();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '重试同一次恢复' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0]).toEqual(writes[1]); expect(writes[0].body).toMatchObject({ subjectId, period: '2026-10', reason: '补回失败的生成' });
});
test('independent admin tokens across four themes and two viewport widths', async ({ page }, testInfo) => {
  await mock(page); await page.goto('/admin');
  await expect(page.getByRole('table')).toBeVisible();
  let reference: string | undefined;
  for (const theme of ['qingci', 'liubai', 'jingshe', 'zhuangse']) {
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    const background = await page.locator('.admin-console').evaluate(el => getComputedStyle(el).backgroundColor);
    reference ??= background; expect(background).toBe(reference);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), fullPage: true });
    }
  }
});
