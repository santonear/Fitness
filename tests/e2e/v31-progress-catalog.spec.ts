import { expect, test, type Page } from '@playwright/test';
test.use({ locale: 'en-US' });
const widths = [320, 375, 390, 420, 768, 1024, 1440];
async function seedHistory(page: Page) {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { database } = await load('/src/persistence/db.ts');
    const { profileService } = await load('/src/application/profile.ts');
    const { exercises } = await load('/src/catalog/exercises.ts');
    const { workoutSessionSchema, setRecordSchema } = await load('/src/domain/schemas.ts');
    const { dateInZone } = await load('/src/application/progress.ts');
    await profileService.initialize('en');
    const profile = await profileService.getProfile();
    for (const [index, offset] of [0, 0, 3, 12, 40, 100].entries()) {
      const startedAt = new Date(Date.now() - offset * 86400000).toISOString();
      const exercise = exercises[index % 2 ? 0 : 1];
      const { steps: _steps, cautions: _cautions, ...base } = exercise;
      const exerciseInstanceId = crypto.randomUUID();
      const snapshot = { ...base, exerciseId: exercise.id, exerciseInstanceId, order: 0, targetSets: [] };
      const entity = { createdAt: startedAt, updatedAt: startedAt, revision: 0 };
      const session = workoutSessionSchema.parse({ ...entity, id: crypto.randomUUID(), status: 'completed', startedAt, completedAt: startedAt, localDate: dateInZone(Date.parse(startedAt), profile.timeZone), timeZone: profile.timeZone, originalExerciseSnapshots: [snapshot], exerciseSnapshots: [snapshot], notes: 'Long training note with preserved history. '.repeat(15) });
      const metrics = exercise.metricType === 'reps_load' ? { reps: 10, loadGrams: 2500 } : { durationSeconds: 120 };
      const set = setRecordSchema.parse({ ...entity, id: crypto.randomUUID(), sessionId: session.id, exerciseInstanceId, order: 0, metricType: exercise.metricType, completed: true, ...metrics, notes: 'Read-only evidence ' + index });
      await database.transaction('rw', database.sessions, database.sets, async () => { await database.sessions.add(session); await database.sets.add(set); });
    }
  });
}
async function assertLayout(page: Page) {
  const result = await page.evaluate(() => {
    const host = document.querySelector('.v31-progress')!.getBoundingClientRect();
    const cards = [...document.querySelectorAll('.v31-progress-card')].map(node => node.getBoundingClientRect());
    return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, host: host.width, cards: cards.map(rect => ({ width: rect.width, right: rect.right })), implicit: getComputedStyle(document.querySelector('.v31-progress-grid')!).gridTemplateColumns.split(' ').length };
  });
  expect(result.scroll).toBeLessThanOrEqual(result.viewport + 1);
  for (const card of result.cards) { expect(card.width).toBeGreaterThan(180); expect(card.right).toBeLessThanOrEqual(result.viewport + 1); }
  if (result.host <= 760) { expect(result.implicit).toBe(1); for (const card of result.cards) expect(Math.abs(card.width - result.host)).toBeLessThan(2); }
}
for (const theme of ['atlas', 'serene', 'orbit']) {
  test('V3 Progress ' + theme + ' seven widths: empty, long history, entry and chart', async ({ page }) => {
    test.setTimeout(90000);
    await page.addInitScript(value => localStorage.setItem('fitness-appearance-v31', value), theme);
    await page.goto('/progress'); await expect(page.locator('.v31-metric').first()).toContainText('0');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await assertLayout(page);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await page.screenshot({ path: 'outputs/v31-progress/' + theme + '-' + width + '-empty.png', fullPage: true });
    }
    await seedHistory(page); await expect(page.locator('.v31-metric').first()).toContainText('4');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: '90 days', exact: true }).click(); await expect(page.locator('.v31-metric').first()).toContainText('5');
      await page.getByRole('button', { name: 'Duration', exact: true }).click();
      await expect(page.locator('.v31-chart svg')).toBeVisible();
      await page.getByRole('button', { name: 'View history details', exact: true }).first().click();
      await expect(page.getByRole('region', { name: 'History details' })).toContainText('Read-only evidence');
      await page.getByRole('button', { name: /Record a measurement/ }).click();
      await page.getByLabel('Weight (kg)', { exact: true }).fill('73.2');
      await assertLayout(page);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await page.screenshot({ path: 'outputs/v31-progress/' + theme + '-' + width + '-populated.png', fullPage: true });
      await page.getByRole('button', { name: 'Hide details', exact: true }).click();
    }
    await page.locator('.v31-quick-theme select').selectOption(theme === 'atlas' ? 'orbit' : 'atlas');
    await expect(page.getByLabel('Weight (kg)', { exact: true })).toHaveValue('73.2');
    await expect(page).toHaveURL(/\/progress$/);
    const calls: string[] = []; page.on('request', request => { if (request.url().includes('/api/')) calls.push(request.url()); });
    await page.getByRole('button', { name: 'Save measurement', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Measurement saved on this device.');
    expect(calls.filter(url => /ai|understand|program/.test(url))).toEqual([]);
    await page.reload(); await page.getByText('Measurement history', { exact: false }).click();
    await expect(page.locator('.v31-measurement-history')).toContainText('73.2');
  });
}
test('V3 Progress counts sessions independently and preserves missing metrics', async ({ page }) => {
  await page.goto('/progress'); await seedHistory(page);
  for (const [days, count] of [[7, 3], [30, 4], [90, 5], [180, 6]]) {
    await page.getByRole('button', { name: days + ' days', exact: true }).click();
    await expect(page.locator('.v31-metric').first().locator('strong')).toHaveText(String(count));
  }
  await page.getByRole('button', { name: 'Duration', exact: true }).click();
  await page.getByText('View chart data', { exact: true }).click();
  await expect(page.locator('.v31-chart-data')).toContainText('—');
  await page.getByLabel('Category', { exact: true }).selectOption('cardio');
  await expect(page.locator('.v31-history-row')).toHaveCount(3);
});
test('V3 catalog real filters, details, favorite persistence and no-result recovery', async ({ page }) => {
  await page.goto('/exercises'); await expect(page.locator('.v31-exercise-card')).toHaveCount(4);
  await page.getByLabel('Muscle / movement', { exact: true }).selectOption('legs');
  await expect(page.locator('.v31-exercise-card')).toHaveCount(2);
  await page.getByLabel('Equipment', { exact: true }).selectOption('dumbbell');
  await expect(page.locator('.v31-exercise-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Favorite Goblet squat', exact: true }).click();
  await page.getByRole('button', { name: 'View exercise details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Steps', exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.reload(); await page.getByLabel('Favorites only', { exact: true }).check();
  await expect(page.locator('.v31-exercise-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('not-a-real-exercise');
  await expect(page.locator('.v31-exercise-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.v31-exercise-card')).toHaveCount(4);
  for (const theme of ['atlas', 'serene', 'orbit']) {
    await page.locator('.v31-quick-theme select').selectOption(theme);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await page.screenshot({ path: 'outputs/v31-progress/catalog-' + theme + '-' + width + '.png', fullPage: true });
    }
  }
});

test('V3 Chinese measurements keep source, update history and fit all three mobile layouts', async ({ page }) => {
  await page.goto('/progress');
  await page.locator('.language-control select').selectOption('zh');
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: '新增观测', exact: true }).click();
  const form = page.locator('.v31-measurement-form');
  await form.locator('select').selectOption('waist');
  await page.getByLabel('腰围 (cm)', { exact: true }).fill('82.1');
  await page.getByLabel('测量方法或来源', { exact: true }).fill('软尺，同一条件测量');
  for (const theme of ['atlas', 'serene', 'orbit']) {
    await page.locator('.v31-quick-theme select').selectOption(theme);
    await expect(page.getByLabel('腰围 (cm)', { exact: true })).toHaveValue('82.1');
    await assertLayout(page);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await page.screenshot({ path: 'outputs/v31-progress/zh-' + theme + '-375.png', fullPage: true });
  }
  await page.getByRole('button', { name: '确认保存测量值', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('身体记录已保存在本机。');
  await form.locator('select').selectOption('bodyFat');
  await page.getByLabel('体脂率 (%)', { exact: true }).fill('20.5');
  await page.getByLabel('测量方法或来源', { exact: true }).fill('家用体脂秤');
  await page.getByRole('button', { name: '确认保存测量值', exact: true }).click();
  await expect(page.locator('.v31-measurement-history summary')).toContainText('(2)');
  await page.reload();
  await page.locator('.v31-measurement-history summary').click();
  await expect(page.locator('.v31-measurement-history')).toContainText('82.1 cm');
  await expect(page.locator('.v31-measurement-history')).toContainText('20.5 %');
  await expect(page.locator('.v31-measurement-history')).toContainText('家用体脂秤');
});
