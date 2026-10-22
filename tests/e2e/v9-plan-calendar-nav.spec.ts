import { expect, test, type Page } from '@playwright/test';
import { answerTexts, engineSafety, nextButton, pickTrainingDays, shanghaiDate, startOnboarding } from './helpers/onboarding-v9';

/**
 * Bo 2026-10-19: training days on a month calendar (tap or drag, 1–30 days) then a start time; the draft is a
 * month calendar; labelled 上一步 and 回到今天 on sub-pages; birth month by tapping or typing; 自己写一句 on the
 * goal stays on the goal; 重新制定计划 starts fresh but keeps records.
 */
test.setTimeout(150000);
const flags = (page: Page) => page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { trainingEngine: true, bodyProfile: true, planLifecycle: true }, expiresAt: Date.now() + 3600000 } }));
const noAccess = (page: Page) => page.route('**/api/v1/trial/**', route => {
  const url = route.request().url();
  if (url.endsWith('/access-status')) return route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } });
  if (url.endsWith('/application-config')) return route.fulfill({ json: { available: false, siteKey: null } });
  return route.fulfill({ json: [] });
});
const snapshot = (page: Page) => page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot(); return { version: data.version, versions: data.versions.length, plans: data.plans.length, workouts: data.workouts.length }; });

async function toSchedule(page: Page) {
  await startOnboarding(page);
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await nextButton(page).click();
  await page.getByLabel('说说你的身体情况').fill('女，34岁，165厘米，60公斤');
  await nextButton(page).click();
  await expect(page.getByRole('heading', { name: '什么时候练？' })).toBeVisible();
}
async function fromScheduleToDraft(page: Page) {
  await nextButton(page).click();
  await answerTexts(page, ['在家，有一对哑铃']);
  await engineSafety(page);
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();
}
const calendarOf = (page: Page) => page.getByRole('region', { name: /训练日$/ });
/** Presses on one day and releases on another, through the days in between (mouse drag). */
async function drag(page: Page, from: string, to: string) {
  const calendar = calendarOf(page);
  const a = await calendar.locator(`[data-date="${from}"]`).boundingBox(), b = await calendar.locator(`[data-date="${to}"]`).boundingBox();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
  await page.mouse.down();
  await page.mouse.move((a!.x + b!.x) / 2 + a!.width / 2, (a!.y + b!.y) / 2 + a!.height / 2, { steps: 4 });
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 4 });
  await page.mouse.up();
}

test('one tapped day makes a one-day plan with a start time; the draft is a month calendar', async ({ page }) => {
  await flags(page); await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toSchedule(page);
  // No fixed weekly count any more: the calendar is the schedule.
  await expect(page.getByRole('button', { name: '3 次', exact: true })).toHaveCount(0);
  const day = shanghaiDate(0);
  const cell = calendarOf(page).locator(`[data-date="${day}"]`);
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/已选 1 天/)).toBeVisible();
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
  // Keyboard: Enter toggles the focused day.
  await cell.focus(); await page.keyboard.press('Enter');
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  // Earlier days cannot be picked.
  const yesterday = calendarOf(page).locator(`[data-date="${shanghaiDate(-1)}"]`);
  if (await yesterday.count()) await expect(yesterday).toHaveAttribute('aria-disabled', 'true');
  await expect(nextButton(page)).toBeDisabled();
  await page.getByRole('button', { name: '30 分钟', exact: true }).click();
  // Days first, then the time question.
  await expect(page.getByText('打算几点开始练？')).toBeVisible();
  await page.getByRole('button', { name: '晚上 7:00', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('schedule-calendar-pop-390.png'), fullPage: true });
  await fromScheduleToDraft(page);
  await expect(page.getByTestId('draft-days')).toContainText('共 1 天 ·');
  await expect(page.getByTestId('draft-days')).toContainText('每次 19:00 开始');
  await expect(page.getByRole('radiogroup', { name: '计划视图' }).getByRole('radio', { name: '月', exact: true })).toHaveAttribute('aria-checked', 'true');
  const month = page.locator('section.v9-month-plan');
  await expect(month.locator('.v9-month-day[data-state="planned"]')).toHaveCount(1);
  await expect(month.locator(`.v9-month-day[data-date="${day}"]`)).toHaveAttribute('data-state', 'planned');
  await expect(month.locator('.v9-month-detail').getByRole('heading', { name: '这天的计划' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('draft-month-pop-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: test.info().outputPath('draft-month-pop-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click(); await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const saved = await snapshot(page);
  expect(saved.version.trainingDates).toEqual([day]);
  expect(saved.version.startTime).toBe('19:00');
  expect(saved.version.startDate).toBe(day);
  expect(saved.version.weeklyTarget).toBe(1);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '计划' }).click();
  await expect(page.getByTestId('plan-days')).toContainText('共 1 天 ·');
  await expect(page.locator('section.v9-month-plan .v9-month-day[data-state="planned"]')).toHaveCount(1);
});

test('dragging across 30 days keeps a rest day in every 7, says so, and plans the rest', async ({ page }) => {
  await flags(page); await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toSchedule(page);
  const calendar = calendarOf(page);
  // Drag within this month first: a run of 3 days.
  const first = shanghaiDate(0), third = shanghaiDate(2);
  if (first.slice(0, 7) === third.slice(0, 7)) {
    await drag(page, first, third);
    for (const date of [first, shanghaiDate(1), third]) await expect(calendar.locator(`[data-date="${date}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/已选 3 天/)).toBeVisible();
    // Dragging over picked days unpicks them.
    await drag(page, first, shanghaiDate(1));
    await expect(calendar.locator(`[data-date="${first}"]`)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(/已选 1 天/)).toBeVisible();
    await page.getByRole('button', { name: '清空重选', exact: true }).click();
  }
  // 30 days in a row: drag to the end of this month, then on through the next month.
  const last = shanghaiDate(29), monthEnd = (() => { for (let i = 29; i >= 0; i--) if (shanghaiDate(i).slice(0, 7) === first.slice(0, 7)) return shanghaiDate(i); return first; })();
  await drag(page, first, monthEnd);
  if (monthEnd !== last) {
    await calendar.getByRole('button', { name: '下个月' }).click();
    await drag(page, `${last.slice(0, 7)}-01`, last);
  }
  await expect(page.getByText(/每连续 7 天至少留 1 天休息/)).toBeVisible();
  await expect(page.getByText(/已选 26 天/)).toBeVisible();
  await page.getByRole('button', { name: '45 分钟', exact: true }).click();
  await fromScheduleToDraft(page);
  await expect(page.getByTestId('draft-days')).toContainText('共 26 天');
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click(); await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const saved = await snapshot(page);
  expect(saved.version.trainingDates).toHaveLength(26);
  expect(saved.version.weeklyTarget).toBe(6);
  expect(saved.version.trainingDates).not.toContain(shanghaiDate(6));
});

test('labelled 上一步 on every step; 回到今天 asks, clears the answers and opens 今天; 自己写一句 stays on the goal', async ({ page }) => {
  await flags(page); await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await startOnboarding(page);
  const goal = page.getByRole('heading', { name: '你想练成什么样？' });
  await expect(goal).toBeVisible();
  // 自己写一句 opens a text box and does not jump anywhere (it used to fall back to the welcome screen).
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await page.getByRole('button', { name: '自己写一句', exact: true }).click();
  await expect(goal).toBeVisible();
  await expect(page.getByRole('heading', { name: '动起来，刚刚好' })).toHaveCount(0);
  await page.getByLabel('你的回答', { exact: true }).fill('想把腰背练得结实一点');
  await expect(page.getByLabel('你的回答', { exact: true })).toHaveValue('想把腰背练得结实一点');
  await nextButton(page).click();
  // The body step: 上一步 is a labelled button beside 下一步, not a bare “<”.
  const back = page.getByRole('button', { name: '上一步', exact: true });
  await expect(back).toBeVisible();
  await expect(back).toHaveText(/上一步/);
  await back.click();
  await expect(goal).toBeVisible();
  await expect(page.getByLabel('你的回答', { exact: true })).toHaveValue('想把腰背练得结实一点');
  await nextButton(page).click();
  // 回到今天 with answers: confirm first, then 今天 and a clean start.
  await page.getByRole('button', { name: '回到今天', exact: true }).click();
  const ask = page.getByRole('dialog', { name: '回到今天？' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: '清空并回到今天', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(goal).toBeVisible();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByLabel('你的回答', { exact: true })).toHaveCount(0);
  // Other sub-pages carry 回到今天 too.
  await page.goto('/manual');
  await page.getByRole('button', { name: '回到今天', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
});

test('birth month: tap a month on a year page (‹ › and a year grid), or type it', async ({ page }) => {
  await flags(page); await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toSchedule(page);
  await pickTrainingDays(page, [shanghaiDate(0)], 30);
  await nextButton(page).click();
  await answerTexts(page, ['在家，有一对哑铃']);
  await page.getByRole('button', { name: '我已年满 18 岁' }).click();
  await page.getByRole('button', { name: /同意将运动前自查/ }).click();
  await nextButton(page).click();
  const group = page.getByRole('group', { name: '出生年月', exact: true });
  await expect(group.getByRole('button', { name: '点选', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const year = new Date().getFullYear() - 30;
  await expect(group.getByRole('button', { name: `${year} 年`, exact: true })).toBeVisible();
  await group.getByRole('button', { name: '上一年', exact: true }).click();
  await group.getByRole('button', { name: '下一年', exact: true }).click();
  await group.getByRole('button', { name: '上一年', exact: true }).click();
  await expect(group.getByRole('button', { name: `${year - 1} 年`, exact: true })).toBeVisible();
  // The year button opens a 12-year grid; ‹ › there move 12 years for older birth years.
  await group.getByRole('button', { name: `${year - 1} 年`, exact: true }).click();
  await group.getByRole('button', { name: '往前 12 年', exact: true }).click();
  await group.getByRole('button', { name: '往前 12 年', exact: true }).click();
  const target = year - 1 - 24;
  await group.getByRole('button', { name: `${target} 年`, exact: true }).click();
  await group.getByRole('button', { name: `${target} 年 6 月`, exact: true }).click();
  await expect(group.getByText(`已选 ${target} 年 6 月`)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('birth-picker-pop-390.png'), fullPage: true });
  // Manual entry shows the same value and can change it.
  await group.getByRole('button', { name: '手动输入', exact: true }).click();
  await expect(group.getByLabel('出生年份', { exact: true })).toHaveValue(String(target));
  await group.getByLabel('出生年份', { exact: true }).fill('1988');
  await group.getByLabel('月份', { exact: true }).selectOption('03');
  await group.getByRole('button', { name: '点选', exact: true }).click();
  await expect(group.getByText('已选 1988 年 3 月')).toBeVisible();
  await expect(nextButton(page)).toBeEnabled();
});

test('重新制定计划 asks, then starts every question fresh; finished records and earlier plans stay', async ({ page }) => {
  await flags(page); await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toSchedule(page);
  await pickTrainingDays(page, [shanghaiDate(0)], 30);
  await fromScheduleToDraft(page);
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click(); await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const before = await snapshot(page);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '计划' }).click();
  await page.getByRole('button', { name: '重新制定计划', exact: true }).click();
  const ask = page.getByRole('dialog', { name: '重新制定计划？' });
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('已经完成的训练记录和以前的计划都会保留');
  await ask.getByRole('button', { name: '清空并重新开始', exact: true }).click();
  await expect(page).toHaveURL(/onboarding/);
  const goal = page.getByRole('heading', { name: '你想练成什么样？' }), start = page.getByRole('button', { name: '开始', exact: true });
  await expect(goal.or(start)).toBeVisible();
  if (await start.isVisible()) await start.click();
  await expect(goal).toBeVisible();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await nextButton(page).click();
  await nextButton(page).click();
  await expect(page.getByRole('heading', { name: '什么时候练？' })).toBeVisible();
  await expect(page.locator('.v9-days-day[aria-pressed="true"]')).toHaveCount(0);
  const after = await snapshot(page);
  // Nothing saved is touched: the plan (still current until a new one is confirmed) and every record stay.
  expect(after.workouts).toBe(before.workouts);
  expect(after.versions).toBe(before.versions);
  expect(after.plans).toBe(before.plans);
  expect(after.version.id).toBe(before.version.id);
});
