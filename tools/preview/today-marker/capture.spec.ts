import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { answerTexts, engineSafety, nextButton, startOnboarding, weeklySchedule } from '../../../tests/e2e/helpers/onboarding-v9';

/**
 * Preview only: today-marker candidates A–D (today-variants.css, injected here, never shipped) plus the current marker,
 * on 计划 › 月 in all five themes, with today next to done / partial / missed / planned days.
 * Run: npx playwright test -c tools/preview/today-marker/capture.config.ts
 * Writes outputs/today-marker/img/*.webp (calendar crops for every theme; full 390×844 shots in pop).
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const out = join(root, 'outputs/today-marker/img');
const css = readFileSync(join(here, 'today-variants.css'), 'utf8');
const themes = ['pop', 'vivid', 'gentle', 'data', 'fire'] as const;
const variants = ['current', 'a', 'b', 'c', 'd'] as const;
const at = (iso: string) => new Date(`${iso}+08:00`);
let engineOn = true;
const flags = (page: Page) => page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { trainingEngine: engineOn, bodyProfile: true, planLifecycle: true }, expiresAt: Date.now() + 30 * 86400000 } }));
const noAccess = (page: Page) => page.route('**/api/v1/trial/**', route => {
  const url = route.request().url();
  if (url.endsWith('/access-status')) return route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } });
  if (url.endsWith('/application-config')) return route.fulfill({ json: { available: false, siteKey: null } });
  return route.fulfill({ json: [] });
});

/** Records every set of the first session (or only two sets when partial) through the real workflow. */
async function train(page: Page, partial: boolean) {
  await page.evaluate(async (partial) => {
    const path = '/src/ui/mainline/context.tsx';
    const { workflow } = await import(/* @vite-ignore */ path);
    const data = await workflow.snapshot();
    const record = await workflow.start(data.version.templates[0].id);
    let count = 0;
    for (const [i, item] of record.templateSnapshot.items.entries()) {
      const target = item.target;
      const values = target.metricType === 'reps_load' ? { reps: target.reps, loadGrams: target.loadGrams } : target.metricType === 'reps' ? { reps: target.reps } : { durationSeconds: target.durationSeconds };
      for (let s = 0; s < (item.sets ?? 1); s++) {
        if (partial && count >= 2) break;
        try { await workflow.recordSet(record.id, i, s, values); } catch { await workflow.recordSet(record.id, i, s, { ...values, loadGrams: 4000 }); }
        count++;
      }
    }
    await workflow.finish(record.id, { reasons: [] });
  }, partial);
}

const nav = (page: Page) => page.getByRole('navigation', { name: '主导航' });
async function openMonth(page: Page) {
  await nav(page).getByRole('button', { name: '计划' }).click();
  await page.getByRole('radiogroup', { name: '计划视图' }).getByRole('radio', { name: '月', exact: true }).click();
  await expect(page.locator('section.v9-month-plan')).toBeVisible();
}
async function closeTip(page: Page) {
  const tip = page.locator('button.v9-orb-icon').first();
  if (await tip.isVisible()) { await tip.click(); await page.waitForTimeout(300); }
}
async function setTheme(page: Page, id: string) {
  await page.evaluate(id => localStorage.setItem('fitness-theme', id), id);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const webp = (png: Buffer, file: string, width?: number) => (width ? sharp(png).resize({ width }) : sharp(png)).webp({ quality: 82, effort: 6 }).toFile(join(out, file));

test('today marker candidates', async ({ page }) => {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await flags(page); await noAccess(page);
  await page.addInitScript(() => { if (!localStorage.getItem('fitness-theme')) localStorage.setItem('fitness-theme', 'pop'); });
  await page.clock.install({ time: at('2026-10-12T08:00:00') });

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
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();

  await openMonth(page);
  const planned = await page.locator('.v9-month-day[data-state="planned"]').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-date')!));
  expect(planned.length).toBeGreaterThan(5);
  // done, partial, (missed), done; today is the next planned day.
  engineOn = false;
  for (const [date, partial] of [[planned[0], false], [planned[1], true], [planned[3], false]] as const) {
    await page.clock.setSystemTime(at(`${date}T18:30:00`));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
    await train(page, partial);
  }
  await page.clock.setSystemTime(at(`${planned[4]}T08:30:00`));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();

  for (const id of themes) {
    await setTheme(page, id);
    await page.addStyleTag({ content: css });
    await openMonth(page);
    await closeTip(page);
    const card = page.locator('.v9-month-card');
    await expect(card.locator('[aria-current="date"]')).toHaveCount(1);
    for (const state of ['done', 'partial', 'missed', 'planned']) expect(await card.locator(`.v9-month-day[data-state="${state}"]`).count(), `${id} ${state}`).toBeGreaterThan(0);
    await page.evaluate(() => { const el = document.querySelector('.v9-month-card'); if (el) window.scrollBy(0, el.getBoundingClientRect().top - 16); });
    for (const v of variants) {
      await page.evaluate(v => { if (v === 'current') delete document.documentElement.dataset.todayVariant; else document.documentElement.dataset.todayVariant = v; }, v);
      await page.waitForTimeout(250);
      // Crop: month title, grid and legend with a little air for ribbons, seals and glows.
      const box = await page.evaluate(() => {
        const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const card = r('.v9-month-card'), head = r('.v9-month-head'), legend = r('.v9-month-legend');
        return { x: card.left, y: head.top - 8, width: card.width, height: legend.bottom - head.top + 20 };
      });
      await webp(await page.screenshot({ clip: box, animations: 'disabled' }), `${v}-${id}.webp`);
      if (id === 'pop') await webp(await page.screenshot({ animations: 'disabled' }), `${v}-pop-full.webp`, 585);
    }
  }
});
