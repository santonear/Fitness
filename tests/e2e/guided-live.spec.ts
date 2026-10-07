import { completedPlanningProfile } from './planning-profile-fixture';
import { expect, test, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => completedPlanningProfile(page));
import { validateGuidedProviderOutput } from '../../src/backend/guided-provider';
import { fourMetricCandidate } from '../fixtures/prompt-cases';
test.setTimeout(90_000);
async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await page.goto('/ai');
  await page.getByRole('heading', { name: 'AI trial access' }).waitFor();
}
async function scope(page: Page) {
  await page.getByRole('textbox', { name: 'goal, clarification or changes', exact: true }).fill('Build a regular fitness routine');
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
      : { kind: 'program', name: 'A steady start', explanation: 'Confirmed conditions', days: [body.dialogue.dates[1], body.dialogue.dates[4]].map((date: string) => ({ ...fourMetricCandidate().days[0], date, exercises: fourMetricCandidate().days[0].exercises.map(exercise => ({ ...exercise, notes: 'Rest 60 seconds; use a controlled tempo.' })) })) };
    return route.fulfill({ json: { requestId: body.requestId, result: validateGuidedProviderOutput(body.dialogue, raw), accounting: 'pending',
      context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await open(page); await scope(page);
  await expect(page.locator('#chat-quota-notice')).toContainText('uses 1 AI understanding allowance');
  await expect(page.getByRole('button', { name: 'preview scope for understanding', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/submitted request is awaiting accounting/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check access and allowance', exact: true })).toBeEnabled();
  if (!bounded) {
    await expect(page.getByRole('alert')).toContainText('Your goal is ready');
    expect(requests).toBe(1);
    await expect(page.getByRole('button', { name: 'Resume plan generation', exact: true })).toBeDisabled();
    pending = false; // Independent operator reconciliation, never a UI settlement.
    await page.getByRole('button', { name: 'Check access and allowance' }).click();
    await page.getByRole('button', { name: 'Resume plan generation', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your training plan' })).toBeVisible();
  expect(requests).toBe(2);
  await expect(page.locator('.candidate-day')).toHaveCount(2);
  await expect(page.locator('.candidate-day .candidate-notes').first()).toContainText('Rest 60 seconds');
  await expect(page.getByRole('button', { name: 'Confirm goal and generate plan' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adopt plan', exact: true })).toBeEnabled();
  await page.reload(); // Retained plan can be adopted without another model request.
  await expect(page.getByRole('heading', { name: 'Your training plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Adopt plan', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); return (await database.guidedStates.get('guided')).programs.length; })).toBe(1);
  expect(requests).toBe(2);
});
}

test('failed status stays unknown and no request is sent without qualification', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/v1/**', async route => { requests++; return route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } }); });
  await open(page); await scope(page);
  await expect(page.getByText('Access and allowance are unknown')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  expect(requests).toBe(1);
});

test('uncertain one-click send preserves the request identity on explicit retry', async ({ page }) => {
  const ids: string[] = [];
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    const body = route.request().postDataJSON(); ids.push(body.requestId);
    expect(body.dialogue.scope).not.toHaveProperty('body'); expect(body.dialogue.scope).not.toHaveProperty('history');
    return route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } });
  });
  await open(page); await scope(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); expect(ids).toHaveLength(1);
  await page.getByRole('button', { name: 'Check access and allowance', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); expect(ids).toHaveLength(2); expect(ids[1]).toBe(ids[0]);
  await expect(page.getByRole('textbox', { name: 'goal, clarification or changes', exact: true })).toHaveValue('Build a regular fitness routine');
});

for (const locale of ['en', 'zh'] as const) test(`${locale} clarification stays in chat, then automatically generates a detailed plan`, async ({ page }) => {
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en;
  const sent: any[] = [];
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    const body = route.request().postDataJSON(); sent.push(body);
    expect(body.dialogue.scope).not.toHaveProperty('body'); expect(body.dialogue.scope).not.toHaveProperty('history');
    const raw = body.operation === 'understand'
      ? { kind: 'understand', summary: sent.length === 1 ? 'Build strength' : 'Build strength once weekly, 30 minutes, at home without equipment; beginner, no stated restrictions.', uncertainties: sent.length === 1 ? ['How often and where can you train?'] : [] }
      : { kind: 'program', name: t('A manageable start', '循序开始'), explanation: t('One training day, with recovery on the other days.', '安排一天训练，其余日期休息恢复。'), days: [{ ...fourMetricCandidate().days[0], date: body.dialogue.dates[1], exercises: fourMetricCandidate().days[0].exercises.map(exercise => ({ ...exercise, notes: t('Rest 60 seconds. Keep a controlled tempo.', '组间休息60秒，保持稳定节奏。') })) }] };
    await route.fulfill({ json: { requestId: body.requestId, accounting: 'settled', result: validateGuidedProviderOutput(body.dialogue, raw), context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await page.addInitScript(locale => localStorage.setItem('fitness.language', locale), locale);
  await page.goto('/ai');
  const input = page.getByRole('textbox', { name: t('goal, clarification or changes', '目标、补充或调整想法'), exact: true });
  await input.fill('Local note not authorized for sending');
  await page.getByRole('button', { name: t('save your thoughts locally', '保存想法（不外发）'), exact: true }).click();
  await expect(input).toHaveValue('');
  await input.fill('I want to build strength');
  await page.getByRole('button', { name: t('Send', '发送'), exact: true }).click();
  await expect(input).toHaveValue('');
  expect(sent).toHaveLength(1);
  expect(JSON.stringify(sent[0])).not.toContain('Local note not authorized');
  await expect(page.getByRole('log')).toContainText('How often and where');
  await input.fill('Once weekly, 30 minutes, home, no equipment. Beginner, no restrictions.');
  await page.getByRole('button', { name: t('Send', '发送'), exact: true }).click();
  await expect(page.getByRole('button', { name: t('Adopt plan', '采用计划'), exact: true })).toBeEnabled();
  expect(sent.map(value => value.operation)).toEqual(['understand', 'understand', 'generate']);
  expect(JSON.stringify(sent[1].dialogue.scope.conditions.priorDialogue)).toContain('I want to build strength');
  expect(sent[2].dialogue).toMatchObject({ dateSelection: 'ai', scope: { goal: 'Build strength once weekly, 30 minutes, at home without equipment; beginner, no stated restrictions.' } });
  expect(sent[2].dialogue.dates).toHaveLength(7);
  await expect(page.locator('.candidate-day')).toHaveCount(1);
  await expect(page.locator('.candidate-day .candidate-notes').first()).toContainText(t('Rest 60 seconds', '组间休息60秒'));
  await expect(page.locator('[id$="quota-notice"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `outputs/automatic-planning-${locale}.png`, fullPage: true });
  await page.getByRole('button', { name: t('Adopt plan', '采用计划'), exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: t('Plan adopted', '计划已采用') })).toBeVisible();
  expect(sent).toHaveLength(3);
});

test('failed automatic generation retries only generation with the same identity', async ({ page }) => {
  const sent: any[] = [];
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 1, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    const body = route.request().postDataJSON(); sent.push(body);
    if (body.operation === 'generate') return route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } });
    return route.fulfill({ json: { requestId: body.requestId, accounting: 'settled', result: validateGuidedProviderOutput(body.dialogue, { kind: 'understand', summary: 'A ready goal', uncertainties: [] }), context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await open(page); await scope(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(sent.map(value => value.operation)).toEqual(['understand', 'generate']);
  await page.getByRole('button', { name: 'Check access and allowance', exact: true }).click();
  await page.getByRole('button', { name: 'Resume plan generation', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(sent.map(value => value.operation)).toEqual(['understand', 'generate', 'generate']);
  expect(sent[2]).toEqual(sent[1]);
});

test('changing the message while understanding is in flight prevents automatic generation', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let posts = 0;
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    posts++; const body = route.request().postDataJSON();
    await ready;
    return route.fulfill({ json: { requestId: body.requestId, accounting: 'settled', result: validateGuidedProviderOutput(body.dialogue, { kind: 'understand', summary: 'Old goal', uncertainties: [] }), context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await open(page); await scope(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => posts).toBe(1);
  await page.getByRole('textbox', { name: 'goal, clarification or changes', exact: true }).fill('A different goal');
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
  await expect(page.getByRole('heading', { name: 'Your training plan' })).toHaveCount(0);
});
