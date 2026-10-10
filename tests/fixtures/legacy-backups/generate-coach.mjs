import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Separate mode: never regenerates the existing nine baseline fixtures.
const output = fileURLToPath(new URL('./', import.meta.url));
const cwd = resolve(process.cwd(), '../fitness-v8-legacy-v71');
const sourceCommit = execFileSync('git', ['rev-parse', '9d2a212'], { encoding: 'utf8' }).trim();
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim() !== sourceCommit || execFileSync('git', ['diff', 'HEAD', '--name-only'], { cwd, encoding: 'utf8' }).trim()) throw Error('Legacy V7.1 source differs from its pinned commit');
const base = 'http://127.0.0.1:5294';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5294', '--strictPort'], { cwd, windowsHide: true, stdio: 'pipe' });
let browser;
const operations = [];
const blockedExternal = [];
try {
  await new Promise((ready, reject) => {
    server.stdout.on('data', bytes => { if (bytes.toString().includes('Local:')) ready(); });
    server.on('exit', code => reject(Error(`Server exited ${code}`))); server.on('error', reject);
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1100 } });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) { blockedExternal.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (request.method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    const body = request.postDataJSON();
    if (!['understand', 'generate'].includes(body.operation)) throw Error('Unexpected mocked operation');
    operations.push(body.operation);
    const d = body.dialogue;
    const identity = { version: d.version, requestId: d.requestId, conversationId: d.conversationId, inputSnapshot: d.inputSnapshot, restoreGeneration: d.restoreGeneration };
    const result = body.operation === 'understand'
      ? { ...identity, purpose: 'understand', summary: 'Synthetic mock: beginner bodyweight training at home for 30 minutes.', uncertainties: [] }
      : { ...identity, purpose: 'program', candidate: {
        id: '86765432-1234-4234-8234-123456789abc', name: 'Synthetic coach fixture', explanation: 'Fixed local mock response, not a real model recommendation.',
        goal: d.scope.goal, startDate: d.startDate, endDate: d.endDate, timeZone: d.timeZone,
        days: d.dates.map(date => ({ date, ...d.schedule.find(slot => slot.date === date), exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 8 }], setTimings: [{ durationSeconds: 40, restSeconds: 30 }], notes: 'Synthetic coach instruction' }] })),
        restoreGeneration: d.restoreGeneration, inputSnapshot: d.inputSnapshot, createdAt: new Date().toISOString(),
      } };
    return route.fulfill({ json: { requestId: body.requestId, accounting: 'settled', result, context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await page.goto(base);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('spinbutton').press('Home');
  for (let age = 12; age < 30; age++) await page.getByRole('spinbutton').press('ArrowUp');
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await expect(page.locator('.ob4-progress')).toContainText('3 / 10');
  for (let step = 2; step < 10; step++) {
    await page.getByRole('button', { name: /^Skip(?: remaining)?$/, exact: true }).click();
    await expect(page.locator('.ob4-progress')).toContainText(step === 9 ? 'Your summary' : `${step + 2} / 10`);
  }
  await page.getByRole('button', { name: 'Confirm profile', exact: true }).click();
  await expect(page).toHaveURL(/ai/);
  await page.getByRole('textbox', { name: 'Training goal and constraints', exact: true }).fill('Synthetic fixture: beginner, build strength at home with no equipment, 30 minutes');
  await page.getByText('Review or edit training details', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Experience', exact: true }).fill('Beginner');
  await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Home');
  await page.getByRole('textbox', { name: 'Equipment', exact: true }).fill('None');
  await page.getByRole('checkbox', { name: /Schedule was unknown in onboarding/ }).click();
  await expect(page.getByRole('checkbox', { name: /Schedule was unknown in onboarding/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Agree to send and understand goal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI understanding · review needed' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'I confirm this understanding is correct', exact: true }).check();
  await page.getByRole('button', { name: 'Choose dates →', exact: true }).click();
  await page.locator('[data-plan-date]').nth(15).click();
  await page.getByLabel('Start time', { exact: true }).fill('12:00');
  await page.getByRole('button', { name: 'Review sending →', exact: true }).click();
  await page.getByRole('checkbox', { name: /I confirm these fields and dates/ }).check();
  await page.getByRole('button', { name: 'Generate proposal →', exact: true }).click();
  await expect(page.getByRole('heading', { name: '04 · Review your proposal, then save' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm & save all daily plans' })).toBeDisabled();
  await page.getByLabel('Plan name', { exact: true }).fill('Reviewed synthetic coach plan');
  await page.getByRole('checkbox', { name: /I reviewed each day/ }).check();
  await page.getByRole('button', { name: 'Confirm & save all daily plans' }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
  await page.screenshot({ path: resolve(output, 'v71-coach-confirmed.png'), fullPage: true });
  await page.goto(`${base}/settings?tab=backup`);
  await page.getByRole('tab', { name: 'Backup & restore', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON backup', exact: true }).click();
  const file = 'v71-coach-plan.json';
  await (await download).saveAs(resolve(output, file));
  const bytes = await readFile(resolve(output, file));
  const data = JSON.parse(bytes.toString()).data;
  expect(data.plans).toHaveLength(1);
  expect(data.plans[0].name).toBe('Reviewed synthetic coach plan');
  expect(data.planVersions[0].days[0].exercises[0].notes).toBe('Synthetic coach instruction');
  expect(operations).toEqual(['understand', 'generate']);
  await writeFile(resolve(output, 'coach-manifest.json'), JSON.stringify({ kind: 'synthetic-data-entered-through-legacy-ui-with-fixed-model-mock', sourceCommit, file, sha256: createHash('sha256').update(bytes).digest('hex'), realModelCalls: 0, mockOperations: operations, blockedExternal, browser: browser.version(), generatedAt: new Date().toISOString(), coverage: ['adult-profile-entered-in-ui', 'mock-coach-candidate', 'explicit-ui-confirmation-save', 'settings-ui-export'], mockSource: 'generate-coach.mjs', limitations: ['No real model quality or provider integration verified', 'No direct database or application service seeding'] }, null, 2) + '\n');
  console.log('V7.1 fixed-mock candidate confirmed and UI export verified');
} finally { await browser?.close(); server.kill(); }
