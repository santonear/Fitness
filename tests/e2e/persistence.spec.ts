import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });
test.setTimeout(15_000);
test.beforeEach(async ({ page }) => { await page.goto('/settings'); });

// Losing the IDB write or initializing over an existing profile breaks refresh.
test('profile preferences survive refresh without becoming weight observations', async ({ page }) => {
  await page.getByLabel('Goal', { exact: true }).fill('Build strength', { timeout: 5000 });
  await page.getByLabel('Profile weight (kg)').fill('72.5');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await page.reload();
  await expect(page.getByLabel('Goal', { exact: true })).toHaveValue('Build strength');
  await expect(page.getByLabel('Profile weight (kg)')).toHaveValue('72.5');
  await expect(page.getByRole('list', { name: 'Weight history' }).getByRole('listitem')).toHaveCount(0);
});

// An implicit upsert by date would silently overwrite an observation.
test('same-day entry requires explicit edit; backdated observations can be deleted', async ({ page }) => {
  await page.getByLabel('Observation date').fill('2026-09-01', { timeout: 5000 });
  await page.getByLabel('Observed weight (kg)').fill('70.2');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  const row = page.getByRole('list', { name: 'Weight history' }).getByRole('listitem');
  await expect(row).toContainText('70.2');
  await page.getByLabel('Observed weight (kg)').fill('71');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONFLICT');
  await expect(row).toContainText('70.2');
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Observed weight (kg)').fill('71');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  // A click starts an async transaction; the committed row and success are its completion signal.
  await expect(row).toContainText('2026-09-01 · 71 kg');
  await expect(page.getByRole('status')).toHaveText('Weight saved');
  await page.reload();
  await expect(row).toContainText('71');
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Weight deleted');
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(row).toHaveCount(0);
});

test('clearing preferences preserves historical weight and language', async ({ page }) => {
  await page.getByLabel('Goal', { exact: true }).fill('Temporary goal', { timeout: 5000 });
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByLabel('Observation date').fill('2026-09-02');
  await page.getByLabel('Observed weight (kg)').fill('69');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  await page.getByRole('button', { name: 'Clear preferences', exact: true }).click();
  await expect(page.getByLabel('Goal', { exact: true })).toHaveValue('');
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await page.reload();
  await expect(page.getByLabel('Goal', { exact: true })).toHaveValue('');
  await expect(page.getByRole('list', { name: 'Weight history' })).toContainText('69');
});

test('real IndexedDB serializes revisions and rolls back failed writes', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/persistence-browser.ts';
    const helper = await import(/* @vite-ignore */ path);
    return helper.exerciseConcurrency(`fitness-test-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ profileCount: 1, fulfilled: 1, codes: ['CONFLICT'], before: 3, after: 3, weights: 1, illegalIdentity: 'INVALID' });
});

test('existing version upgrades preserve facts and failed upgrades roll back', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/persistence-browser.ts';
    const helper = await import(/* @vite-ignore */ path);
    return helper.exerciseUpgrade(`fitness-test-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ kept: 65000, rejected: true, intact: 65000, upgradedRevision: 4 });
});

test('invalid preferences show failure and preserve last saved profile', async ({ page }) => {
  await page.getByLabel('Goal', { exact: true }).fill('Keep this', { timeout: 5000 });
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await page.getByLabel('Days per week').fill('2');
  await page.getByLabel('Training weekdays (1–7, comma separated)').fill('1');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('INVALID');
  await expect(page.getByRole('status')).toHaveText('');
  await page.reload();
  await expect(page.getByLabel('Goal', { exact: true })).toHaveValue('Keep this');
  await expect(page.getByLabel('Days per week')).toHaveValue('');
});

test('storage failure reports STORAGE_FULL without a success or partial write', async ({ page }) => {
  await page.getByLabel('Observation date').fill('2026-09-03', { timeout: 5000 });
  await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/persistence-browser.ts';
    const helper = await import(/* @vite-ignore */ path);
    helper.rejectWeightWriteForQuota();
  });
  await page.getByLabel('Observed weight (kg)').fill('67');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('STORAGE_FULL');
  await expect(page.getByRole('status')).toHaveText('');
  await page.reload();
  await expect(page.getByRole('list', { name: 'Weight history' }).getByRole('listitem')).toHaveCount(0);
});

test('shell language is synchronized to profile while observation facts stay unchanged', async ({ page }) => {
  await page.getByLabel('Observation date').fill('2026-09-04', { timeout: 5000 });
  await page.getByLabel('Observed weight (kg)').fill('68');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Weight saved');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/tests/e2e/helpers/persistence-browser.ts';
    return (await import(/* @vite-ignore */ path)).persistedLocale();
  }), { timeout: 5000 }).toBe('zh');
  await page.reload();
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByRole('list', { name: '体重历史' })).toContainText('2026-09-04 · 68 kg');
});
