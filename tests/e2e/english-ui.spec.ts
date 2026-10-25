import { expect, test, type Page } from '@playwright/test';
import { answerText, engineSafety, generate, nextButton, startOnboarding } from './helpers/onboarding-v9';
import { startToday } from './helpers/home-start';

const explore = process.env.EXPLORE === '1';
const flags = {
  trainingEngine: true,
  bodyProfile: true,
  planLifecycle: true,
  exercisePanel: true,
  nutrition: true,
  activityImport: true,
  trainingReminders: true,
};
const cjk = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
/** Typed by the user in this test (kept as written), and the language option written in its own language. */
const typedGoal = '我想试试';
const allowed = [typedGoal, '中文'];

/** WebKit occasionally reports "internal error" on a navigation while the previous page is still busy; retry that one case. */
async function goto(page: Page, path: string) {
  try {
    await page.goto(path);
  } catch (error) {
    if (!String(error).includes('WebKit encountered an internal error')) throw error;
    await page.goto(path);
  }
}

async function leaks(page: Page) {
  return page.evaluate(
    ([pattern, allow]) => {
      const re = new RegExp(pattern as string),
        list = allow as string[];
      const visible = (el: Element) => {
        const box = (el as HTMLElement).getBoundingClientRect();
        const style = getComputedStyle(el);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const found = new Set<string>();
      const clean = (text: string) => {
        let rest = text;
        for (const item of list) rest = rest.split(item).join('');
        return rest;
      };
      for (const line of document.body.innerText.split('\n')) if (re.test(clean(line))) found.add(line.trim());
      for (const el of Array.from(document.querySelectorAll('[aria-label],[placeholder],[title],img[alt]'))) {
        if (!visible(el)) continue;
        for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
          const value = el.getAttribute(name);
          if (value && re.test(clean(value))) found.add(`@${name}: ${value}`);
        }
      }
      return [...found];
    },
    [cjk.source, allowed] as const,
  );
}
/** Self-check screenshots for the PR (ENGLISH_SHOTS=1); not part of the assertion. */
const shotNames = new Set([
  'switched today',
  'switched plan week',
  'switched plan month',
  'switched me',
  'switched workout',
  'switched rest',
  'switched finish',
  'switched after workout review',
  'switched exercise guide',
  'wide today',
  'wide plan',
  'wide me',
]);
async function check(page: Page, where: string) {
  await page.waitForTimeout(250);
  const found = await leaks(page);
  if (process.env.ENGLISH_SHOTS && shotNames.has(where))
    await page.screenshot({
      path: `test-results-review/english-leaks/${where.replace(/ +/g, '-')}-${page.viewportSize()?.width}.png`,
    });
  if (explore) {
    if (found.length) console.log(`\n== ${where}\n${found.map(line => '  ' + line.slice(0, 220)).join('\n')}`);
    return;
  }
  expect(found, `Chinese text on ${where}`).toEqual([]);
}

test.setTimeout(240000);
test('English UI shows no Chinese across the main flow', async ({ page }) => {
  await page.route('**/api/v1/features', route =>
    route.fulfill({ json: { version: 1, flags, expiresAt: Date.now() + 3600000 } }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } }),
  );
  await page.route('**/api/v1/assistant/**', route => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem('fitness.language')) localStorage.setItem('fitness.language', 'en');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, '/');
  await expect(page).toHaveURL(/onboarding/, { timeout: 20000 });
  await check(page, 'welcome');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await check(page, 'goal');
  // Bo's example: a goal the user typed in Chinese stays exactly as typed; every preset follows the language.
  await page.getByRole('button', { name: 'Write my own', exact: true }).click();
  await page.getByLabel('Your answer', { exact: true }).fill(typedGoal);
  await check(page, 'goal typed');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await check(page, 'body');
  await page.getByRole('textbox').first().fill('female, 34 years, 165 cm, 60 kg');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await check(page, 'schedule');
  const calendar = page.getByRole('region', { name: /training days$/ });
  const days = calendar.locator('[data-date]:not([aria-disabled="true"])');
  // Today is a training day: before the first picked day 今天 has no start button (Bo 2026-10-23).
  for (const index of [0, 2, 4]) await days.nth(index).click();
  await page.getByRole('button', { name: '30 min', exact: true }).click();
  await check(page, 'schedule picked');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await check(page, 'place');
  await page.getByRole('radio', { name: 'At home, with a pair of dumbbells', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await check(page, 'health intro');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await page.getByRole('button', { name: 'I am at least 18 years old' }).click();
  await page.getByRole('button', { name: /Allow screening/ }).click();
  await next.click();
  await check(page, 'birth month');
  const birth = page.getByRole('group', { name: 'Year and month of birth', exact: true });
  await birth.getByRole('button', { name: 'Type it', exact: true }).click();
  await birth.getByLabel('Birth year', { exact: true }).fill('1991');
  await birth.getByLabel('Month', { exact: true }).selectOption('06');
  await next.click();
  await check(page, 'parq');
  for (let group = 0; group < 3; group++) {
    await page.getByRole('button', { name: 'None of these', exact: true }).click();
    await check(page, `screening group ${group + 2}`);
  }
  await page.getByRole('radio', { name: 'Yes', exact: true }).click();
  await check(page, 'blood pressure');
  await page.getByRole('radio', { name: 'Below 160/90', exact: true }).click();
  await check(page, 'route');
  await page.getByRole('radio', { name: 'Health', exact: true }).click();
  await check(page, 'population');
  await page.getByRole('radio', { name: 'Neither', exact: true }).click();
  const intensity = page.getByRole('heading', { name: 'About intensity' }),
    care = page.getByRole('heading', { name: 'Any areas that need care?' });
  await expect(intensity.or(care)).toBeVisible();
  if (await intensity.isVisible()) {
    await check(page, 'intensity');
    await next.click();
  }
  await check(page, 'cautions');
  await page.getByRole('radio', { name: 'Yes, choose areas' }).click();
  await check(page, 'caution areas');
  await page.getByRole('button', { name: 'Knees', exact: true }).click();
  await next.click();
  await check(page, 'red flags');
  await page.getByRole('button', { name: 'None of these', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Last, your training conditions' })).toBeVisible();
  await check(page, 'preferences');
  await page
    .getByRole('button', { name: 'Just starting', exact: true })
    .click()
    .catch(() => undefined);
  await next.click();
  await check(page, 'ready');
  await page.getByRole('button', { name: 'Create my plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your first plan', exact: true })).toBeVisible();
  await check(page, 'plan draft');
  await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await check(page, 'today');
  await walkEnglish(page, 'fresh');
  await workout(page, 'fresh');
  await walkEnglish(page, 'fresh after workout');
});

const nav = (page: Page, name: 'Today' | 'Plan' | 'Review' | 'Me') =>
  page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name }).click();
/** Walks every main English screen from 今天 with an applied plan. */
async function walkEnglish(page: Page, tag: string) {
  await nav(page, 'Today');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await check(page, `${tag} today`);
  // Day view: open every step of today's timeline.
  for (const summary of await page.locator('.v9-day-step summary').all()) await summary.click();
  await check(page, `${tag} today day view`);
  await nav(page, 'Plan');
  await expect(page.getByRole('radiogroup', { name: 'Plan view' })).toBeVisible();
  for (const summary of await page.locator('main summary').all()) await summary.click().catch(() => undefined);
  await check(page, `${tag} plan week`);
  await page.getByRole('radio', { name: 'Month', exact: true }).click();
  await check(page, `${tag} plan month`);
  for (const day of (await page.locator('main [data-date]').all()).slice(0, 12)) {
    await day.click().catch(() => undefined);
  }
  await check(page, `${tag} plan month days`);
  await goto(page, '/plans/versions');
  await check(page, `${tag} plan versions`);
  await goto(page, '/');
  await nav(page, 'Review');
  await check(page, `${tag} review`);
  await nav(page, 'Me');
  await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
  await check(page, `${tag} me`);
  for (const row of [
    'What Yaya can see',
    'Backup and restore',
    'Deleted plans',
    'Yaya saved preferences',
    'Send us a message',
    'Reminders',
  ]) {
    const button = page
      .locator('main')
      .getByRole('button', { name: new RegExp(row, 'i') })
      .first();
    if (await button.count()) {
      await button.click();
      await check(page, `${tag} me · ${row}`);
      await button.click();
    }
  }
  for (const [row, path] of [
    ['My records', '/settings/changes'],
    ['Body details', '/settings/body'],
    ['Screening and training preferences', '/settings/engine'],
    ['Nutrition advice', '/settings/nutrition'],
  ] as const) {
    await page
      .locator('main')
      .getByRole('button', { name: new RegExp(`^${row}`) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(path));
    await check(page, `${tag} ${row}`);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
  }
  for (const path of ['/activity', '/manual', '/trial']) {
    await goto(page, path);
    await check(page, `${tag} ${path}`);
  }
  await goto(page, '/exercises');
  await check(page, `${tag} exercise library`);
  await page.locator('.manual-pick').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await check(page, `${tag} exercise guide`);
  await page.keyboard.press('Escape');
  await goto(page, '/');
}

async function workout(page: Page, tag: string) {
  await nav(page, 'Today');
  await startToday(page);
  await expect(page).toHaveURL(/\/workout\//);
  await check(page, `${tag} workout`);
  await page.getByRole('button', { name: 'Complete this set', exact: true }).click();
  await check(page, `${tag} rest`);
  await page.getByRole('button', { name: 'Skip rest', exact: true }).click();
  await check(page, `${tag} after rest`);
  await page.getByRole('button', { name: 'Feeling unwell?', exact: true }).click();
  await check(page, `${tag} unwell sheet`);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pause or finish' }).click();
  await check(page, `${tag} pause`);
  await page.getByRole('button', { name: 'Finish and record' }).first().click();
  await expect(page).toHaveURL(/finish/);
  await check(page, `${tag} finish`);
  await page.getByRole('button', { name: 'Save this workout' }).click();
  await check(page, `${tag} after save`);
}

test('plan made in Chinese with preset choices reads fully in English after switching', async ({ page }) => {
  await page.route('**/api/v1/features', route =>
    route.fulfill({ json: { version: 1, flags, expiresAt: Date.now() + 3600000 } }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } }),
  );
  await page.route('**/api/v1/assistant/**', route => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem('fitness.language')) localStorage.setItem('fitness.language', 'zh');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await startOnboarding(page);
  await answerText(page, '想瘦下来，身体轻一点');
  await page.getByLabel('说说你的身体情况').fill('女，34岁，165厘米，60公斤');
  await nextButton(page).click();
  const open = page.getByRole('region', { name: /训练日$/ }).locator('[data-date]:not([aria-disabled="true"])');
  for (const index of [0, 2, 4]) await open.nth(index).click();
  await page.getByRole('button', { name: '45 分钟', exact: true }).click();
  await nextButton(page).click();
  await answerText(page, '去健身房');
  await engineSafety(page, { caution: '膝盖' });
  await generate(page);
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的' }).click();
  // The detector itself sees Chinese on the Chinese screen.
  expect((await leaks(page)).length).toBeGreaterThan(0);
  await page
    .locator('select')
    .filter({ has: page.locator('option[value="en"]') })
    .selectOption('en');
  await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
  await walkEnglish(page, 'switched');
  await workout(page, 'switched');
  await walkEnglish(page, 'switched after workout');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const tab of ['Today', 'Plan', 'Me'] as const) {
    await nav(page, tab);
    await check(page, `wide ${tab.toLowerCase()}`);
  }
});
