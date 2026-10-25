import { expect, test, type Page } from '@playwright/test';
import { answerTexts, engineSafety, nextButton, startOnboarding, weeklySchedule } from './helpers/onboarding-v9';

/** Bo 2026-10-19: 计划 has a month view; 今天 has a day view with order, planned and actual times. */
test.setTimeout(150000);
const flags = (page: Page) =>
  page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: true, bodyProfile: true, planLifecycle: true },
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
const noAccess = (page: Page) =>
  page.route('**/api/v1/trial/**', route => {
    const url = route.request().url();
    if (url.endsWith('/access-status'))
      return route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } });
    if (url.endsWith('/application-config')) return route.fulfill({ json: { available: false, siteKey: null } });
    return route.fulfill({ json: [] });
  });
const localDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

async function toPlan(page: Page) {
  await startOnboarding(page);
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await nextButton(page).click();
  await page.getByLabel('说说你的身体情况').fill('女，34岁，165厘米，60公斤');
  await nextButton(page).click();
  await weeklySchedule(page, 3, 45);
  await nextButton(page).click();
  await answerTexts(page, ['在家，有一对哑铃']);
  await engineSafety(page);
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
}

/** Trains the session shown on 今天 through the real workflow: two sets of the first exercise, then finish. */
async function trainShownSession(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const { workflow } = await import(/* @vite-ignore */ path);
    const data = await workflow.snapshot();
    const record = await workflow.start(data.version.templates[0].id);
    const first = record.templateSnapshot.items[0],
      target = first.target;
    const values =
      target.metricType === 'reps_load'
        ? { reps: target.reps, loadGrams: target.loadGrams }
        : target.metricType === 'reps'
          ? { reps: target.reps }
          : { durationSeconds: target.durationSeconds };
    await workflow.recordSet(record.id, 0, 0, values);
    await workflow.recordSet(record.id, 0, 1, values);
    const done = await workflow.finish(record.id, { reasons: [] });
    return { id: done.id, sets: done.sets, startedAt: done.startedAt, endedAt: done.endedAt, status: done.status };
  });
}

test('今天 day view: numbered steps with times from the chosen start; actual times after training, correction kept beside the record', async ({
  page,
}) => {
  await flags(page);
  await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toPlan(page);
  const main = page.locator('main.v9-home');
  const day = main.locator('section.v9-day').filter({ has: page.getByRole('heading', { name: /^顺序和时间/ }) });
  await expect(day).toBeVisible();
  // Folded to one line until opened (Bo 2026-10-25).
  await expect(day.locator('.v9-day-step')).toHaveCount(0);
  await day.getByRole('button', { name: '展开', exact: true }).click();
  const steps = day.locator('.v9-day-step');
  expect(await steps.count()).toBeGreaterThan(2);
  await expect(steps.first().locator('.v9-day-number')).toHaveText('1');
  await expect(day.locator('.v9-day-phase').first()).toHaveText('热身');
  await expect(day.locator('.v9-day-phase').last()).toHaveText('放松');
  const start = day.getByLabel('几点开始');
  await start.fill('18:00');
  await expect(steps.first().locator('.v9-day-time')).toHaveText('18:00');
  const times = await steps.locator('.v9-day-time').allInnerTexts();
  expect([...times].sort()).toEqual(times); // order follows the clock
  await expect(day.getByText(/预计 \d\d:\d\d 结束/)).toBeVisible();
  // Existing per-exercise tools still live inside each step.
  await day.locator('details').first().locator('summary').click();
  await expect(day.getByRole('button', { name: '动作怎么做', exact: true }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('day-view-pop-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: test.info().outputPath('day-view-pop-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  const trained = await trainShownSession(page);
  expect(trained.status).toBe('partial');
  await page.reload();
  // 今天 keeps its panel after training (Bo 2026-10-22); the finished session lives in 回顾, reached by one link.
  await expect(main.locator('section.v9-home-panel[data-style]')).toBeVisible();
  await expect(main.locator('section.v9-day-actual')).toHaveCount(0);
  await main.getByRole('button', { name: '今天已练 · 查看', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  const actual = page.locator('main.rv-page section.v9-day-actual');
  await expect(actual.getByRole('heading', { name: '今天练过的' })).toBeVisible();
  await expect(actual.getByTestId('day-actual-line')).toContainText('开始');
  await expect(actual.locator('.v9-day-done .v9-day-step[data-done="true"]')).toHaveCount(1);
  await actual.getByRole('button', { name: '改开始和结束时间', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '改这次的开始和结束时间' });
  const recordedStart = await sheet.getByLabel('开始').inputValue();
  // Stay on the same day: just after midnight, 20 minutes earlier would wrap to the previous evening and fail validation.
  const [h, m] = recordedStart.split(':').map(Number),
    earlierMinutes = Math.max(0, h * 60 + m - 20),
    earlier = `${String(Math.floor(earlierMinutes / 60)).padStart(2, '0')}:${String(earlierMinutes % 60).padStart(2, '0')}`;
  await sheet.getByLabel('开始').fill(earlier);
  await sheet.getByRole('button', { name: '保存时间', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(actual.getByText(/时间改过 · 原记录/)).toBeVisible();
  await expect(actual.getByTestId('day-actual-line')).toContainText(`${earlier} 开始`);
  const stored = await page.evaluate(async id => {
    const path = '/src/ui/mainline/context.tsx';
    const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
    const w = data.workouts.find((row: { id: string }) => row.id === id);
    return { sets: w.sets, startedAt: w.startedAt, endedAt: w.endedAt, corrections: w.timeCorrections?.length };
  }, trained.id);
  expect(stored).toEqual({
    sets: trained.sets,
    startedAt: trained.startedAt,
    endedAt: trained.endedAt,
    corrections: 1,
  });
  await page.screenshot({ path: test.info().outputPath('day-actual-pop-390.png'), fullPage: true });

  // 计划 › 月: today is marked, a planned day opens its session.
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '计划' }).click();
  await page.getByRole('radiogroup', { name: '计划视图' }).getByRole('radio', { name: '月', exact: true }).click();
  const calendar = page.locator('section.v9-month-plan');
  await expect(calendar).toBeVisible();
  const today = calendar.locator(`.v9-month-day[data-date="${localDate()}"]`);
  await expect(today).toHaveAttribute('data-state', 'partial');
  await expect(today).toHaveAttribute('aria-current', 'date');
  await expect(calendar.locator('.v9-month-detail')).toContainText('练了一部分');
  const planned = calendar.locator('.v9-month-day[data-state="planned"]').first();
  if (await planned.count()) {
    await planned.click();
    await expect(calendar.locator('.v9-month-detail').getByRole('heading', { name: '这天的计划' })).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath('month-pop-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: test.info().outputPath('month-pop-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await calendar.getByRole('button', { name: '下个月' }).click();
  await expect(calendar.locator('.v9-month-day[data-state="planned"]').first()).toBeVisible();
  await page.getByRole('radiogroup', { name: '计划视图' }).getByRole('radio', { name: '周', exact: true }).click();
  await expect(page.locator('.v9-week-plan')).toBeVisible();
});
