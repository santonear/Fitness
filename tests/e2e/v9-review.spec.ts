import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { answerTexts, basicSafety, generate, startOnboarding } from './helpers/onboarding-v9';

/** V9 visual review (Bo 2026-10-19: charts instead of sentences). Friday in Shanghai keeps the week deterministic. */
test.use({ timezoneId: 'Asia/Shanghai' });
const themes = ['pop', 'vivid', 'gentle', 'data', 'fire'] as const;

async function plan(page: Page) {
  await startOnboarding(page); await answerTexts(page, ['保持力量', '每周3次，每次30分钟', '在家，只有瑜伽垫']);
  await basicSafety(page); await generate(page); await page.getByRole('button', { name: '就用这份计划' }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
}
/** Saved workouts on Mon, Wed, Thu this week and one in each of the two weeks before. */
async function seed(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/persistence/db.ts', db = (await import(/* @vite-ignore */ path)).database;
    const profile = await db.profiles.toCollection().first(); await db.profiles.put({ ...profile, timeZone: 'Asia/Shanghai' });
    const version = (await db.v8PlanVersions.toArray())[0], template = version.templates[0];
    const days: [string, string, number][] = [['2026-10-19T11:00:00Z', 'complete', 32], ['2026-10-21T11:00:00Z', 'partial', 18], ['2026-10-22T11:00:00Z', 'complete', 41], ['2026-10-14T11:00:00Z', 'complete', 30], ['2026-10-07T11:00:00Z', 'complete', 28]];
    await db.v8Workouts.bulkAdd(days.map(([startedAt, status, minutes]) => {
      const items = template.items.slice(0, status === 'partial' ? 1 : template.items.length);
      const sets = items.flatMap((item: { exerciseId: string }, itemIndex: number) => [0, 1].map(setIndex => ({ exerciseId: item.exerciseId, itemIndex, setIndex, reps: 10, loadGrams: itemIndex === 0 ? 8000 : null, completedAt: new Date(Date.parse(startedAt) + (itemIndex * 2 + setIndex + 1) * 60000).toISOString() })));
      return { id: crypto.randomUUID(), planVersionId: version.id, templateId: template.id, startedAt, endedAt: new Date(Date.parse(startedAt) + minutes * 60000).toISOString(), localDate: startedAt.slice(0, 10), timeZone: 'Asia/Shanghai', status, plannedSetCount: template.items.length * 2, sets, feedback: { reasons: status === 'partial' ? ['time'] : [] } };
    }));
  });
}

test('empty review shows 芽芽 and no zero grid; with records it shows ring, bars and body parts', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-23T04:00:00Z'));
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: '本周回顾', exact: true })).toBeVisible();
  await expect(page.locator('.rv-empty img')).toHaveCount(1);
  await expect(page.locator('.rv-facts')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /本周每天/ })).toHaveCount(0);

  await plan(page); await seed(page);
  await page.goto('/review');
  await expect(page.getByRole('progressbar', { name: '本周目标 3 次，已练 3 次，目标达成了。', exact: true })).toBeVisible();
  await expect(page.locator('.rv-facts dd')).toHaveText(['2', '1', '3', '91', '0']);
  await expect(page.getByText('连续 3 周', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /本周每天/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '练到的部位' })).toBeVisible();
  await expect(page.getByText(/如实记下来/)).toHaveCount(1);
  await page.getByRole('radio', { name: '本月', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本月回顾', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /本月每周/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('390px review screenshots in all five themes, empty and with records', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'Screenshots are a chromium self-check');
  test.setTimeout(180_000);
  mkdirSync('outputs/v9-review', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-10-23T04:00:00Z'));
  const shot = async (name: string) => {
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `outputs/v9-review/${name}.png`, fullPage: true });
  };
  const visit = async (theme: string) => { await page.evaluate(value => localStorage.setItem('fitness-theme', value), theme); await page.goto('/review'); await expect(page.getByRole('heading', { name: '本周回顾', exact: true })).toBeVisible(); await page.waitForTimeout(300); };
  await page.goto('/review');
  for (const theme of themes) { await visit(theme); await shot(`${theme}-empty`); }
  await plan(page); await seed(page);
  for (const theme of themes) {
    await visit(theme); await shot(`${theme}-week`);
    if (theme === 'pop') {
      await page.getByRole('radio', { name: '本月', exact: true }).click(); await shot('pop-month');
      await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole('radio', { name: '本周', exact: true }).click(); await shot('pop-week-1440');
      await page.setViewportSize({ width: 390, height: 844 });
    }
  }
});
