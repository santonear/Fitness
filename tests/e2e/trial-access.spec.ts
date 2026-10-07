import { expect, test } from '@playwright/test';

for (const zh of [false, true]) test(`manual invitation generation and revocation (${zh ? 'zh' : 'en'})`, async ({ page }) => {
  await page.addInitScript(zh => localStorage.setItem('fitness.language', zh ? 'zh' : 'en'), zh);
  const code = 'a'.repeat(64), inviteId = 'b'.repeat(64), expiresAt = Date.now() + 604800000;
  let issued = false, generations = 0;
  await page.route('**/api/v1/management/**', async route => {
    if (route.request().url().endsWith('/invites/revoke')) {
      expect(route.request().postDataJSON()).toEqual({ inviteId }); issued = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (route.request().url().endsWith('/invites')) { issued = true; generations++; return route.fulfill({ json: { code, inviteId, expiresAt } }); }
    return route.fulfill({ json: { report: { capturedAt: Date.now(), aiEnabled: true, budgets: [], requests: [], subjects: [] },
      applications: [], audit: [], invites: issued ? [{ inviteId, expiresAt }] : [],
      policy: { budgetLimit: 3000, reservation: 300, timeZone: 'Asia/Shanghai' }, service: { reconciliationRequired: false } } });
  });
  await page.goto('/admin'); await page.getByRole('button', { name: zh ? '试用资格' : 'Trials', exact: true }).click();
  const generate = page.getByRole('button', { name: zh ? '生成邀请码' : 'Generate invitation', exact: true });
  page.once('dialog', d => d.dismiss()); await generate.click(); expect(generations).toBe(0);
  page.once('dialog', d => d.accept()); await generate.click();
  const field = page.getByLabel(zh ? '新邀请码' : 'New invitation code', { exact: true });
  await expect(field).toHaveValue(code); expect(generations).toBe(1);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.getByRole('button', { name: zh ? '复制邀请码' : 'Copy invitation', exact: true }).click();
  await expect(page.getByText(zh ? '复制失败，请选中邀请码手动复制。' : 'Copy failed. Select the code and copy it manually.', { exact: true })).toBeVisible();
  await expect(field).toHaveValue(code);
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: test.info().outputPath(`manual-invite-${zh ? 'zh' : 'en'}.png`), fullPage: true });
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: new RegExp(zh ? '^撤销邀请码' : '^Revoke invitation') }).click();
  await expect(field).toHaveCount(0);
  await expect(page.getByText(zh ? '暂无有效邀请码' : 'No active invitations', { exact: true })).toBeVisible();
});

test('quota restoration confirms defaults and retries the same operation after an uncertain response', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  const subjectId = '982ab731-a782-49de-aec0-8c4f5b5bd406';
  const submissions: unknown[] = [];
  await page.route('**/api/v1/management/**', async route => {
    if (route.request().url().endsWith('/quota-restore')) {
      submissions.push(route.request().postDataJSON());
      return submissions.length === 1 ? route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } }) : route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { report: { capturedAt: Date.now(), aiEnabled: true, budgets: [], requests: [], subjects: [{ subjectId, expiresAt: Date.now() + 86400000, revoked: false, expired: false }] },
      applications: [], audit: [], quotas: [{ subjectId, period: '2026-10', used: { understand: 8, generate: 4 }, limits: { understand: 8, generate: 4 }, defaults: { understand: 8, generate: 4 } }],
      policy: { budgetLimit: 3000, reservation: 300, timeZone: 'Asia/Shanghai' }, service: { reconciliationRequired: false } } });
  });
  await page.goto('/admin'); await page.getByRole('button', { name: 'Trials', exact: true }).click();
  const button = page.getByRole('button', { name: 'Restore monthly default quota', exact: true });
  await expect(button).toBeDisabled(); await page.getByLabel('Restoration reason', { exact: true }).fill('Verified support request');
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('8 understandings and 4 plans'); await dialog.dismiss(); });
  await button.click(); expect(submissions).toHaveLength(0);
  page.once('dialog', dialog => dialog.accept()); await button.click();
  await expect(page.getByRole('alert')).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Retry same restoration', exact: true }).click();
  await expect.poll(() => submissions.length).toBe(2); expect(submissions[0]).toEqual(submissions[1]);
  await expect(page.getByLabel('Restoration reason', { exact: true })).toHaveValue('');
});

test('cost inputs stay independent when two subjects use the same request ID', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  const requestId = '7df87763-d1b4-40bd-a8dd-9a995793da13';
  const subjects = ['982ab731-a782-49de-aec0-8c4f5b5bd406', 'f1658adb-74bc-48ca-9806-e6459c494ce1'];
  let submitted: unknown;
  await page.route('**/api/v1/management/**', async route => {
    if (route.request().url().endsWith('/settle')) {
      submitted = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { report: { capturedAt: new Date().toISOString(), aiEnabled: false, recoveryRequired: false, budgets: [], subjects: [],
      requests: subjects.map(subjectId => ({ subjectId, requestId, operation: 'understand', period: '2026-10', status: 'pending', boundFen: 300 })), usages: [] },
      applications: [], audit: [], policy: { budgetLimit: 3000, reservation: 300, timeZone: 'Asia/Shanghai' }, service: { reconciliationRequired: false } } });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Budget & usage', exact: true }).click();
  const inputs = page.getByLabel('Verified actual cost (fen)', { exact: true });
  await inputs.nth(0).fill('1');
  await expect(inputs.nth(1)).toHaveValue('');
  await inputs.nth(1).fill('2');
  await expect(inputs.nth(0)).toHaveValue('1');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Confirm settlement', exact: true }).nth(1).click();
  await expect.poll(() => submitted).toEqual({ subjectId: subjects[1], requestId, actualCost: 2 });
});

for (const zh of [false, true]) {
  test(`application → pending → approval → claim → onboarding (${zh ? 'zh' : 'en'})`, async ({ page }) => {
    await page.addInitScript(({ zh }) => {
      localStorage.setItem('fitness.language', zh ? 'zh' : 'en');
      (window as unknown as { turnstile: unknown }).turnstile = { render: (_host: unknown, options: { callback: (s: string) => void }) => { options.callback('synthetic-proof'); return 'fixture'; }, remove: () => {} };
    }, { zh });
    let application: Record<string, unknown> | undefined; let active = false; let submissions = 0;
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/application-config')) return route.fulfill({ json: { available: true, siteKey: 'synthetic-site-key' } });
      if (path.endsWith('/status')) return active ? route.fulfill({ json: { expiresAt: Date.now() + 86400000, used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 } } }) : route.fulfill({ status: 401, json: { error: 'QUALIFICATION_REQUIRED' } });
      if (path.endsWith('/applications')) return route.fulfill({ json: application ? [application] : [] });
      if (path.endsWith('/apply')) { submissions++; const body = route.request().postDataJSON(); expect(body.receipt).toMatch(/^[a-f0-9]{64}$/); application = { id: body.id, kind: 'new', state: 'pending', createdAt: Date.now() }; return route.fulfill({ json: application }); }
      if (path.endsWith('/claim')) { active = true; application!.state = 'claimed'; return route.fulfill({ json: { expiresAt: Date.now() + 86400000 } }); }
      return route.fulfill({ status: 503, json: { error: 'UNEXPECTED' } });
    });
    await page.goto('/');
    for (const width of [320,375,390,430,768,1024,1280,1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('.trial-access')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: test.info().outputPath(`trial-${zh ? 'zh' : 'en'}.png`), fullPage: true });
    await page.getByRole('button', { name: zh ? '申请 AI 试用' : 'Apply for AI trial', exact: true }).click();
    await page.getByLabel(zh ? '称呼' : 'Name', { exact: true }).fill('Synthetic applicant');
    await page.getByRole('button', { name: zh ? '提交申请' : 'Submit application', exact: true }).click();
    await expect(page.getByText(zh ? '等待审核' : 'Awaiting review', { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByText(zh ? '等待审核' : 'Awaiting review', { exact: true })).toBeVisible();
    expect(submissions).toBe(1);
    application!.state = 'approved'; application!.claimUntil = Date.now() + 86400000;
    await page.getByRole('button', { name: zh ? '刷新状态' : 'Refresh status', exact: true }).click();
    await page.getByRole('button', { name: zh ? '领取并启用' : 'Claim and activate', exact: true }).click();
    await expect(page.locator('.onboarding-flow')).toBeVisible();
    await page.goto('/trial'); await expect(page.getByRole('button', { name: zh ? '申请延期 30 天' : 'Request 30-day extension' })).toBeVisible();
    await expect(page.getByRole('button', { name: zh ? '申请 AI 试用' : 'Apply for AI trial', exact: true })).toHaveCount(0);
  });
  test(`unavailable service allows local dashboard (${zh ? 'zh' : 'en'})`, async ({ page }) => {
    await page.addInitScript(zh => localStorage.setItem('fitness.language', zh ? 'zh' : 'en'), zh);
    await page.route('**/api/v1/**', route => route.abort('internetdisconnected'));
    await page.goto('/');
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: zh ? '先看看应用' : 'Explore the app first' }).click();
    await expect(page.locator('.trial-access')).toHaveCount(0);
    await expect(page.locator('.guided-records')).toBeVisible();
  });
}
test('management shows real report values, review actions and responsive layout', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  const application = { id: '7df87763-d1b4-40bd-a8dd-9a995793da13', name: 'Synthetic applicant', note: 'Try Fitness', kind: 'new', state: 'pending', createdAt: Date.now() };
  await page.route('**/api/v1/management/**', async route => {
    if (route.request().url().endsWith('application-review')) { expect(route.request().postDataJSON().decision).toBe('approve'); application.state = 'approved'; return route.fulfill({ json: application }); }
    return route.fulfill({ json: { report: { capturedAt: new Date().toISOString(), aiEnabled: false, recoveryRequired: false, budgets: [], subjects: [], requests: [], usages: [] }, applications: [application], audit: [], policy: { budgetLimit: 3000, reservation: 300, timeZone: 'Asia/Shanghai' }, service: { reconciliationRequired: false } } });
  });
  await page.goto('/admin'); await expect(page.getByText('Synthetic applicant', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click(); await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  for (const width of [320,375,390,430,768,1024,1280,1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: test.info().outputPath('management-desktop.png'), fullPage: true });
});
