import { expect, test, type Page } from '@playwright/test';
import { validateGuidedProviderOutput } from '../../src/backend/guided-provider';
import { fourMetricCandidate } from '../fixtures/prompt-cases';
test.setTimeout(90_000);
async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await page.goto('/ai');
  await page.getByRole('heading', { name: 'AI trial access' }).waitFor();
}
async function scope(page: Page) {
  await page.getByLabel('goal, clarification or changes', { exact: true }).fill('Build a regular fitness routine');
  await page.getByRole('button', { name: 'preview scope for understanding', exact: true }).click();
}
for (const bounded of [false, true]) {
test(`real transport UI: verified-bound=${bounded}; pending candidate can be saved without another request`, async ({ page }) => {
  let pending = false; let requests = 0;
  await page.route('**/api/v1/**', async route => {
    const url = route.request().url();
    if (url.endsWith('trial/status')) return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 1, generate: 0 },
      limits: { understand: 8, generate: 4 }, pending: pending ? 1 : 0, reconciliationRequired: pending && !bounded, aiEnabled: true } });
    const body = route.request().postDataJSON(); requests++; pending = true;
    const raw = body.operation === 'understand' ? { kind: 'understand', summary: 'Build a regular fitness routine', uncertainties: [] }
      : { kind: 'program', name: 'A steady start', explanation: 'Confirmed conditions', days: body.dialogue.dates.map((date: string) => ({ ...fourMetricCandidate().days[0], date })) };
    return route.fulfill({ json: { requestId: body.requestId, result: validateGuidedProviderOutput(body.dialogue, raw), accounting: 'pending',
      context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await open(page); await scope(page);
  await expect(page.getByRole('button', { name: 'confirm sending', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Check access and allowance' }).click();
  await page.getByRole('button', { name: 'confirm sending', exact: true }).click();
  await expect(page.getByText(/submitted request is awaiting accounting/)).toBeVisible();
  await page.getByText('review the goal and exact dates', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'goal interpretation', exact: true })).toHaveValue('Build a regular fitness routine');
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await page.getByLabel('start date', { exact: true }).fill(today); await page.getByLabel('end date', { exact: true }).fill(today);
  await page.getByRole('button', { name: today, exact: true }).click();
  await page.getByRole('button', { name: 'confirm interpretation', exact: true }).click();
  await page.getByRole('button', { name: 'preview sending scope', exact: true }).click();
  if (bounded) await expect(page.getByRole('button', { name: 'confirm sending', exact: true })).toBeEnabled();
  else await expect(page.getByRole('button', { name: 'confirm sending', exact: true })).toBeDisabled();
  if (!bounded) pending = false; // Independent operator reconciliation, never a UI settlement.
  await page.getByRole('button', { name: 'Check access and allowance' }).click();
  await page.getByRole('button', { name: 'confirm sending', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'complete candidate, not active yet' })).toBeVisible();
  expect(requests).toBe(2);
  await page.getByRole('button', { name: 'confirm complete plan', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); return (await database.guidedStates.get('guided')).programs.length; })).toBe(1);
  expect(requests).toBe(2);
});
}

test('failed status stays unknown and no request is sent without qualification', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/v1/**', async route => { requests++; return route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } }); });
  await open(page); await scope(page); await page.getByRole('button', { name: 'Check access and allowance' }).click();
  await expect(page.getByText('Access and allowance are unknown')).toBeVisible();
  await expect(page.getByRole('button', { name: 'confirm sending', exact: true })).toBeDisabled();
  expect(requests).toBe(1);
});
