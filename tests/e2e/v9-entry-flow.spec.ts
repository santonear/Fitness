import { expect, test } from '@playwright/test';
import { answerTexts, engineSafety, nextButton, startOnboarding, weeklySchedule } from './helpers/onboarding-v9';

test.setTimeout(90000);
test('fresh user: welcome → tap onboarding → one-question health check → plan applied → home', async ({ page }) => {
  await page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { trainingEngine: true, bodyProfile: true, planLifecycle: true }, expiresAt: Date.now() + 3600000 } }));
  await page.route('**/api/v1/trial/access-status', route => route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } }));
  let modelCalls = 0; await page.route('**/api/v1/assistant/**', route => { modelCalls++; return route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  const started = Date.now();
  await page.goto('/');
  // One welcome screen says what the app does; no question before 开始, and no “这一次”.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('动起来，刚刚好');
  await expect(page.getByText(/这一次/)).toHaveCount(0);
  await page.getByRole('button', { name: '开始', exact: true }).click();
  // Tap choices: the selected suggestion is marked selected, not left as a placeholder.
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await expect(page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('textarea')).toHaveCount(0);
  await nextButton(page).click();
  await page.getByLabel('说说你的身体情况').fill('女，34岁，165厘米，60公斤');
  await nextButton(page).click();
  await weeklySchedule(page, 3, 45);
  await nextButton(page).click();
  await answerTexts(page, ['在家，有一对哑铃']);
  // Health check: one question per screen; follow-ups only after 是; “以上都没有” answers a group at once.
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await engineSafety(page);
  await expect(page.locator('select')).toHaveCount(0);
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  // Draft: week calendar, named sessions, non-empty why, no stacked warnings on top.
  await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: '一周安排' })).toHaveCount(1);
  const names = await page.locator('.v9-session-name').allInnerTexts();
  expect(names.length).toBe(3);
  for (const name of names) expect(name).not.toBe('训练');
  await expect(page.getByRole('heading', { name: '为什么这样排' })).toBeVisible();
  expect(await page.locator('.v9-reasons li').count()).toBeGreaterThan(0);
  expect(await page.locator('.v9-plan-tip').count()).toBeLessThanOrEqual(1);
  await expect(page.getByText('基础计划', { exact: true })).toHaveCount(0);
  await expect(page.getByText('开启 AI 后可以得到更贴合的计划')).toHaveCount(0);
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  // Home: applied feedback, today's session first, start before the status check.
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '计划已经用上了' })).toBeVisible();
  const start = page.getByRole('button', { name: '开始训练', exact: true });
  await expect(start).toBeEnabled();
  const checkin = page.getByRole('region', { name: '练之前，看看状态' });
  if (await checkin.count()) expect((await start.boundingBox())!.y).toBeLessThan((await checkin.boundingBox())!.y);
  await expect(page.locator('.v9-home-next')).toContainText(/周[一二三四五六日]/);
  // Bottom navigation includes 我的; settings have each entry once.
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的' }).click();
  await expect(page.getByRole('heading', { name: '我的', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '运动前自查与训练偏好' })).toHaveCount(1);
  // Bo 2026-10-19: themes change from 今天's 换风格 only; 我的 has no 界面风格 entry.
  await expect(page.getByRole('radiogroup', { name: '界面风格' })).toHaveCount(0);
  expect(modelCalls).toBe(0);
  // Target: a new user gets a plan in about three minutes; scripted taps are far quicker.
  expect(Date.now() - started).toBeLessThan(180000);
});
