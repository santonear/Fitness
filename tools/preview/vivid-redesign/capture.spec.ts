import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerTexts, engineSafety, nextButton, startOnboarding, weeklySchedule } from '../../../tests/e2e/helpers/onboarding-v9';

/**
 * Preview-only screenshots for Bo's 山野暖阳 redesign (2026-10-20 in Asia/Shanghai):
 * 今天 / 计划·月 / 训练中 / 回顾 for the current vivid theme and vivid-a…d.
 * Variants are CSS layers on data-theme="vivid" switched by data-vivid-variant (see src/themes/vivid-previews).
 * Run: npx playwright test -c tools/preview/vivid-redesign/capture.config.ts
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = join(root, 'outputs/vivid-redesign/img');
const variantDir = join(root, 'src/themes/vivid-previews');
const variantCss = readdirSync(variantDir).filter(f => f.endsWith('.css')).sort().map(f => readFileSync(join(variantDir, f), 'utf8')).join('\n');
const variants = (process.env.VARIANTS ?? 'current,vivid-a,vivid-b,vivid-c,vivid-d').split(',');

const at = (iso: string) => new Date(`${iso}+08:00`);
let engineOn = true;
const flags = (page: Page) => page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { trainingEngine: engineOn, bodyProfile: true, planLifecycle: true }, expiresAt: Date.now() + 30 * 86400000 } }));
const noAccess = (page: Page) => page.route('**/api/v1/trial/**', route => {
  const url = route.request().url();
  if (url.endsWith('/access-status')) return route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } });
  if (url.endsWith('/application-config')) return route.fulfill({ json: { available: false, siteKey: null } });
  return route.fulfill({ json: [] });
});

/** Records every set of the first template's session (or only two sets when partial) through the real workflow. */
async function train(page: Page, partial = false) {
  await page.evaluate(async (partial) => {
    const path = '/src/ui/mainline/context.tsx';
    const { workflow } = await import(/* @vite-ignore */ path);
    const data = await workflow.snapshot();
    let record;
    try { record = await workflow.start(data.version.templates[0].id); } catch (e) { throw new Error(`start ${String((e as Error).message).slice(0, 800)}`); }
    let count = 0;
    for (const [i, item] of record.templateSnapshot.items.entries()) {
      const target = item.target;
      const values = target.metricType === 'reps_load' ? { reps: target.reps, loadGrams: target.loadGrams } : target.metricType === 'reps' ? { reps: target.reps } : { durationSeconds: target.durationSeconds };
      for (let s = 0; s < (item.sets ?? 1); s++) {
        if (partial && count >= 2) break;
        // Some catalog exercises take a load even when the template target omits it.
        try { await workflow.recordSet(record.id, i, s, values); } catch { await workflow.recordSet(record.id, i, s, { ...values, loadGrams: 4000 }); }
        count++;
      }
    }
    await workflow.finish(record.id, { reasons: [] });
  }, partial);
}

async function setVariant(page: Page, id: string) {
  await page.evaluate(id => { if (id === 'current') delete document.documentElement.dataset.vividVariant; else document.documentElement.dataset.vividVariant = id; }, id);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}
async function shootAll(page: Page, screen: string) {
  // 芽芽's one-line tip is real UI but hides the screen under review; close it like a user would.
  const tip = page.locator('button.v9-orb-icon').first();
  if (await tip.isVisible()) { await tip.click(); await page.waitForTimeout(300); }
  for (const id of variants) {
    await setVariant(page, id);
    await page.screenshot({ path: join(out, `${id}-${screen}.png`), animations: 'disabled' });
  }
}

test('vivid redesign previews', async ({ page }) => {
  mkdirSync(out, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await flags(page); await noAccess(page);
  await page.addInitScript(([css]) => {
    localStorage.setItem('fitness-theme', 'vivid');
    const add = () => { if (document.getElementById('vivid-previews')) return; const s = document.createElement('style'); s.id = 'vivid-previews'; s.textContent = css; document.head.append(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  }, [variantCss]);
  await page.clock.install({ time: at('2026-10-12T08:00:00') });

  // Plan: 3×45 min at home with dumbbells, made on Monday 10-12.
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

  // Seeded history and screenshots run with the engine flag off: the engine blocks seeded sessions on later days.
  engineOn = false;
  // History: done on 10-12, 10-14, 10-16, 10-19; partial on 10-18.
  for (const [day, partial] of [['2026-10-12T18:30:00', false], ['2026-10-14T18:30:00', false], ['2026-10-16T18:30:00', false], ['2026-10-18T10:00:00', true], ['2026-10-19T19:00:00', false]] as const) {
    await page.clock.setSystemTime(at(day));
    await page.reload();
    await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
    await train(page, partial);
  }

  await page.clock.setSystemTime(at('2026-10-20T08:30:00'));
  await page.reload();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  await shootAll(page, 'home');

  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('button', { name: '计划' }).click();
  await page.getByRole('radiogroup', { name: '计划视图' }).getByRole('radio', { name: '月', exact: true }).click();
  const calendar = page.locator('section.v9-month-plan');
  await expect(calendar).toBeVisible();
  await calendar.locator('.v9-month-card').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => { const el = document.querySelector('.v9-month-card'); if (el) window.scrollBy(0, el.getBoundingClientRect().top - 24); });
  await page.waitForTimeout(300);
  await shootAll(page, 'month');

  await nav.getByRole('button', { name: '回顾' }).click();
  await expect(page).toHaveURL(/review/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await shootAll(page, 'review');

  await nav.getByRole('button', { name: '今天' }).click();
  await page.getByRole('button', { name: '开始训练', exact: true }).first().click();
  await expect(page).toHaveURL(/workout/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await shootAll(page, 'player');
});
