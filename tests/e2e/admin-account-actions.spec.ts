import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
const subjectId = '22222222-2222-4222-8222-222222222222';
test('administrator confirms activation, per-user code and deletion; cancelling is read-only', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  let activated = false, deleted = false; const mutations: string[] = [];
  await page.route('**/api/v1/management/**', route => {
    const op = new URL(route.request().url()).pathname.split('/').pop()!;
    if (op !== 'applications') mutations.push(op);
    if (op === 'application-activate') { expect(route.request().postDataJSON()).toEqual({ id }); activated = true; }
    if (op === 'subject-delete') { expect(route.request().postDataJSON()).toEqual({ subjectId }); deleted = true; }
    if (op === 'reissue') return route.fulfill({ json: { subjectId, code: 'a'.repeat(64), expiresAt: Date.now() + 86400000 } });
    return route.fulfill({ json: { applications: deleted ? [] : [{ id, name: 'Test applicant', kind: 'new', state: activated ? 'approved' : 'pending', createdAt: Date.now(), ...(activated ? { subjectId, directlyActivated: true } : {}) }], invites: [], quotas: [], audit: [], report: { aiEnabled: true, capturedAt: Date.now(), budgets: [], requests: [], subjects: activated && !deleted ? [{ subjectId, expiresAt: Date.now() + 86400000, expired: false, revoked: false }] : [] }, policy: { budgetLimit: 3000, reservation: 300, timeZone: 'Asia/Shanghai' }, service: {} } });
  });
  await page.goto('/admin'); const activate = page.getByRole('button', { name: 'Activate without code' });
  page.once('dialog', d => d.dismiss()); await activate.click(); expect(mutations).toEqual([]);
  page.once('dialog', d => d.accept()); await activate.click(); await expect(page.getByText('Activated without code.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Trials', exact: true }).click();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Generate user activation code' }).click();
  await expect(page.getByLabel('New activation code (shown only here)')).toHaveValue('a'.repeat(64));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'Delete account' }).click(); expect(deleted).toBe(false);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByRole('button', { name: 'Delete account' })).toHaveCount(0); expect(mutations).toEqual(['application-activate', 'reissue', 'subject-delete']);
});
for (const lostResponse of [false, true]) test(`original applicant refresh claims direct activation without a code (lost response: ${lostResponse})`, async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('fitness.language', 'en'); localStorage.setItem('fitness-trial-application-receipt-v1', 'a'.repeat(64)); });
  let claimed = false;
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/application-config')) return route.fulfill({ json: { available: false, siteKey: null } });
    if (path.endsWith('/applications')) return route.fulfill({ json: [{ id, kind: 'new', state: claimed || lostResponse ? 'claimed' : 'approved', directlyActivated: true, createdAt: Date.now(), claimUntil: Date.now() + 86400000 }] });
    if (path.endsWith('/claim')) { expect(route.request().postDataJSON()).toEqual({ receipt: 'a'.repeat(64), id }); claimed = true; return route.fulfill({ json: {} }); }
    if (path.endsWith('/status')) return claimed ? route.fulfill({ json: { expiresAt: Date.now() + 86400000, used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, aiEnabled: true } }) : route.fulfill({ status: 401, json: { error: 'QUALIFICATION_REQUIRED' } });
    return route.fulfill({ status: 500, json: { error: 'Unexpected endpoint' } });
  });
  await page.goto('/trial'); await expect(page.getByRole('button', { name: 'Start planning your training' })).toBeEnabled(); expect(claimed).toBe(true);
});
