import { test, expect, type Page, type Route } from '@playwright/test';
import { showShared } from './helpers/home-coach';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';

// 徒手深蹲 was merged into 自重深蹲 (Bo 2026-10-31); AI candidates offer only the kept ID.
const AIR_SQUAT = 'fe06a323-6426-5771-893c-b99a2ca1978d';
async function enableAssistant(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/application/feature-flags.ts';
    await (
      await import(/* @vite-ignore */ path)
    ).refreshFeatureFlags(async () =>
      Response.json({ version: 1, flags: { aiAssistantV2: true }, expiresAt: Date.now() + 60000 }),
    );
  });
}
async function reply(route: Route, payload: { json: any }) {
  const result = payload.json.result;
  if (!result) return route.fulfill(payload);
  const prose =
    result.type === 'clarify'
      ? result.question
      : result.type === 'refused'
        ? result.reason
        : (result.proposal?.reasons?.join(' ') ?? result.summary ?? '');
  const events = [
    { type: 'text_delta', delta: prose },
    ...(!['clarify', 'refused'].includes(result.type) ? [{ type: 'attachment', attachment: result }] : []),
    { type: 'done', success: true, usage: { inputTokens: 1, outputTokens: 1 }, promptVersion: 'test' },
  ];
  return route.fulfill({
    contentType: 'text/event-stream',
    body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''),
  });
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/trial/access-status', async route => {
    await reply(route, {
      json: { qualification: 'active', sessionValid: true, expiresAt: Date.now() + 60000, aiEnabled: true },
    });
  });
});
test('explicit send omits optional data, validates response, and keeps draft when closed', async ({ page }) => {
  let sent: any;
  await page.route('**/api/v1/assistant/chat', async route => {
    sent = route.request().postDataJSON();
    await reply(route, {
      json: {
        requestId: sent.requestId,
        context: { restoreGeneration: 0, inputDigest: sent.sendConfirmation },
        accounting: 'settled',
        result: {
          requestId: sent.requestId,
          restoreGeneration: 0,
          mutationAllowed: false,
          type: 'clarify',
          question: '想在哪里练？',
        },
      },
    });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await enableAssistant(page);
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await page.getByRole('textbox').fill('想在家练');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('想在哪里练？', { exact: true })).toBeVisible();
  expect(sent.context.body).toBeUndefined();
  expect(sent.context.history).toBeUndefined();
  await page.getByRole('textbox').fill('还想再问一句');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveValue('还想再问一句');
  await expect(page.getByText('想在哪里练？', { exact: true })).toBeVisible();
});
for (const width of [390, 1440])
  test(`coach pop ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/tests/fixtures/v8-coach/index.html');
    await enableAssistant(page);
    await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results-review/v8-coach/qingci-${width}.png` });
  });
test('qualification denial offers an actionable local plan without another request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/assistant/chat', async route => {
    calls++;
    await route.fulfill({ status: 403, json: { error: 'QUALIFICATION_REQUIRED' } });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await enableAssistant(page);
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await page.getByRole('textbox').fill('想在家练');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByRole('button', { name: '先排一份计划' }).click();
  await expect(page.getByText('基础计划入口已打开')).toBeVisible();
  expect(calls).toBe(1);
});
test('legacy profile without coach details still offers local planning', async ({ page }) => {
  await page.goto('/tests/fixtures/v8-coach/index.html?missing');
  await enableAssistant(page);
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await page.getByRole('button', { name: '先排一份计划' }).click();
  await expect(page.getByText('基础计划入口已打开')).toBeVisible();
});
test('candidate preview shows repetitions load duration and distance before confirmation', async ({ page }) => {
  await page.route('**/api/v1/assistant/chat', async route => {
    const sent = route.request().postDataJSON(),
      p = sent.context.profile;
    const items = [
      {
        exerciseId: EXERCISE_IDS.gobletSquat,
        equipment: 'dumbbell',
        sets: 2,
        target: { metricType: 'reps_load', reps: 8, loadGrams: 12500 },
      },
      {
        exerciseId: EXERCISE_IDS.walking,
        equipment: 'none',
        sets: 1,
        target: { metricType: 'duration_distance', durationSeconds: 600, distanceMeters: 750 },
      },
      {
        exerciseId: AIR_SQUAT,
        equipment: 'none',
        sets: 3,
        target: { metricType: 'reps', reps: 10 },
      },
      {
        exerciseId: EXERCISE_IDS.plank,
        equipment: 'none',
        sets: 2,
        target: { metricType: 'duration', durationSeconds: 25 },
      },
    ];
    await reply(route, {
      json: {
        requestId: sent.requestId,
        context: { restoreGeneration: 0, inputDigest: sent.sendConfirmation },
        accounting: 'settled',
        result: {
          requestId: sent.requestId,
          restoreGeneration: 0,
          mutationAllowed: false,
          type: 'plan_proposal',
          proposal: {
            goalText: p.goalText,
            weeklyTarget: p.weeklyTarget,
            sessionMinutes: p.sessionMinutes,
            scheduleOriginalText: p.scheduleOriginalText,
            reasons: ['a', 'b', 'c'],
            templates: [
              { id: 'A', name: 'A', estimatedMinutes: 20, items },
              { id: 'B', name: 'B', estimatedMinutes: 20, items },
            ],
          },
        },
      },
    });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await enableAssistant(page);
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await page.getByRole('textbox').fill('帮我看看');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('高脚杯深蹲 · 2 组 · 8 次 · 12.5 公斤').first()).toBeVisible();
  await expect(page.getByText('步行 · 1 组 · 约 10 分钟 · 750 米').first()).toBeVisible();
  await expect(page.getByText('自重深蹲 · 3 组 · 10 次').first()).toBeVisible();
  await expect(page.getByText('平板支撑 · 2 组 · 25 秒').first()).toBeVisible();
});
test('duplicate apply is locked and a failed save retains the candidate without regenerating', async ({ page }) => {
  let modelCalls = 0,
    applyCalls = 0;
  let finishApply: (() => void) | undefined;
  await page.route('**/api/v1/assistant/chat', async route => {
    modelCalls++;
    const sent = route.request().postDataJSON(),
      p = sent.context.profile;
    const item = {
      exerciseId: AIR_SQUAT,
      equipment: 'none',
      sets: 2,
      target: { metricType: 'reps', reps: 8 },
    };
    await reply(route, {
      json: {
        requestId: sent.requestId,
        context: { restoreGeneration: 0, inputDigest: sent.sendConfirmation },
        accounting: 'settled',
        result: {
          requestId: sent.requestId,
          restoreGeneration: 0,
          mutationAllowed: false,
          type: 'plan_proposal',
          proposal: {
            goalText: p.goalText,
            weeklyTarget: p.weeklyTarget,
            sessionMinutes: p.sessionMinutes,
            scheduleOriginalText: p.scheduleOriginalText,
            reasons: ['a', 'b', 'c'],
            templates: [
              { id: 'A', name: 'A', estimatedMinutes: 20, items: [item] },
              { id: 'B', name: 'B', estimatedMinutes: 20, items: [item] },
            ],
          },
        },
      },
    });
  });
  await page.route('**/fixture/apply', async route => {
    applyCalls++;
    if (applyCalls === 1) {
      await new Promise<void>(resolve => {
        finishApply = resolve;
      });
      await route.fulfill({ status: 409, body: 'conflict' });
    } else await route.fulfill({ status: 200, body: 'saved' });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html?apply-test');
  await enableAssistant(page);
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await page.getByRole('textbox').fill('帮我看看');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  const apply = page.getByRole('button', { name: '应用建议' });
  await expect(apply).toBeVisible();
  await apply.evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });
  await expect(apply).toBeDisabled();
  await expect.poll(() => applyCalls).toBe(1);
  finishApply!();
  await expect(page.getByRole('alert')).toHaveText('这次应用尚未确认，请重试。');
  await expect(apply).toBeEnabled();
  await expect(page.getByText('自重深蹲 · 2 组 · 8 次').first()).toBeVisible();
  expect(modelCalls).toBe(1);
  await apply.click();
  await expect(page.getByText('已应用', { exact: true })).toBeVisible();
  expect(applyCalls).toBe(2);
  expect(modelCalls).toBe(1);
});
test('settings language persists and keeps the backup panel in the same language', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('combobox', { name: '语言' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Backup and restore', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup and restore', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
  await expect(page.getByRole('heading', { name: '我的', exact: true })).toBeVisible();
});
test('an explicitly authorized home send is consumed once and excludes optional fields', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/assistant/chat', async route => {
    calls++;
    const sent = route.request().postDataJSON();
    expect(sent.context.body).toBeUndefined();
    expect(sent.context.history).toBeUndefined();
    expect(sent.context.messages.at(-1).content).toBe('首页已确认的话');
    await reply(route, {
      json: {
        requestId: sent.requestId,
        context: { restoreGeneration: 0, inputDigest: sent.sendConfirmation },
        accounting: 'settled',
        result: {
          requestId: sent.requestId,
          restoreGeneration: 0,
          mutationAllowed: false,
          type: 'clarify',
          question: '想在哪里练？',
        },
      },
    });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await enableAssistant(page);
  await page.getByRole('button', { name: '首页发送' }).click();
  await expect(page.getByText('想在哪里练？', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '首页发送' }).click();
  await expect(page.getByText('想在哪里练？', { exact: true })).toBeVisible();
  await page.getByRole('textbox').fill('仅修改草稿');
  expect(calls).toBe(1);
});
test('reminder settings expose quiet-time conflicts and legacy zero caps', async ({ page }) => {
  // Training reminders are behind an off-by-default flag (Bo 2026-10-19).
  await page.route('**/api/v1/features', route =>
    route.fulfill({ json: { version: 1, flags: { trainingReminders: true }, expiresAt: Date.now() + 60000 } }),
  );
  await page.goto('/settings#reminders');
  await page.getByLabel('时间', { exact: true }).fill('06:00');
  await expect(
    page.getByText('这个提醒时间在静默时段内，静默期间不会显示提醒。可以调整提醒时间或静默时段。'),
  ).toBeVisible();
  await page.getByLabel('静默结束时间').fill('06:00');
  await expect(
    page.getByText('这个提醒时间在静默时段内，静默期间不会显示提醒。可以调整提醒时间或静默时段。'),
  ).not.toBeVisible();
  await page.getByLabel('每天最多提醒几次').selectOption('0');
  await expect(page.getByText('每日上限为0，不会显示提醒。')).toBeVisible();
  await expect(page.getByRole('button', { name: /AI 助手芽芽/ })).toBeVisible();
});
test('body fields are individually opt-in and only the selected subset is sent', async ({ page }) => {
  let body: unknown;
  await page.route('**/api/v1/assistant/chat', async route => {
    const sent = route.request().postDataJSON();
    body = sent.context.body;
    expect(sent.context.history).toBeUndefined();
    await reply(route, {
      json: {
        requestId: sent.requestId,
        context: { restoreGeneration: 0, inputDigest: sent.sendConfirmation },
        accounting: 'settled',
        result: {
          requestId: sent.requestId,
          restoreGeneration: 0,
          mutationAllowed: false,
          type: 'clarify',
          question: '想在哪里练？',
        },
      },
    });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await enableAssistant(page);
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await showShared(page);
  const age = page.getByRole('checkbox', { name: '年龄 · 25' }),
    height = page.getByRole('checkbox', { name: '身高（厘米） · 180' });
  await expect(age).not.toBeChecked();
  await expect(height).not.toBeChecked();
  await age.check();
  await page.getByRole('textbox').fill('帮我看看');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('想在哪里练？', { exact: true })).toBeVisible();
  expect(body).toEqual({ age: 25 });
});
test('a second turn includes the actual first user and displayed assistant reply after reopening', async ({ page }) => {
  const requests: any[] = [];
  await page.route('**/api/v1/assistant/chat', async route => {
    const sent = route.request().postDataJSON();
    requests.push({ ...sent.context, messages: sent.messages });
    await reply(route, {
      json: {
        requestId: sent.requestId,
        context: { restoreGeneration: 0, inputDigest: sent.sendConfirmation },
        accounting: 'settled',
        result: {
          requestId: sent.requestId,
          restoreGeneration: 0,
          mutationAllowed: false,
          type: 'clarify',
          question: requests.length === 1 ? '想在哪里练？' : '每次有多少时间？',
        },
      },
    });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await enableAssistant(page);
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await page.getByRole('textbox').fill('想开始训练');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('想在哪里练？', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await page.getByRole('textbox').fill('在家里');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('每次有多少时间？', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toEqual([
    { role: 'user', content: '想开始训练' },
    { role: 'assistant', content: '想在哪里练？' },
    { role: 'user', content: '在家里' },
  ]);
  for (const request of requests) {
    expect(request.body).toBeUndefined();
    expect(request.history).toBeUndefined();
  }
});

test('diet consent is separate and withdrawing it removes diet-derived conversation', async ({ page }) => {
  const requests: any[] = [];
  await page.route('**/api/v1/assistant/chat', async route => {
    const sent = route.request().postDataJSON();
    requests.push({ ...sent.context, messages: sent.messages });
    await reply(route, {
      json: {
        requestId: sent.requestId,
        context: { restoreGeneration: 0, inputDigest: sent.sendConfirmation },
        accounting: 'settled',
        result: {
          requestId: sent.requestId,
          restoreGeneration: 0,
          mutationAllowed: false,
          type: 'clarify',
          question: sent.context.nutrition ? '饮食测试回声' : '普通测试回复',
        },
      },
    });
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await enableAssistant(page);
  await page.evaluate(async () => {
    const fp = '/src/application/feature-flags.ts',
      dp = '/src/persistence/repository.ts';
    await (
      await import(/* @vite-ignore */ fp)
    ).refreshFeatureFlags(
      async () =>
        new Response(
          JSON.stringify({
            version: 1,
            flags: { nutrition: true, aiAssistantV2: true },
            expiresAt: Date.now() + 60000,
          }),
        ),
    );
    await (
      await import(/* @vite-ignore */ dp)
    ).repository.db.nutritionRecords.add({
      id: crypto.randomUUID(),
      localDate: '2026-01-01',
      timeZone: 'Asia/Shanghai',
      meal: 'lunch',
      portion: '合成饮食资料',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await showShared(page);
  const diet = page.locator('label').filter({ hasText: '饮食记录' }).getByRole('checkbox');
  await expect(diet).not.toBeChecked();
  const send = async (text: string, reply: string) => {
    const prior = await page.getByRole('log').getByText(reply, { exact: true }).count();
    await page.getByRole('textbox').fill(text);
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(page.getByRole('log').getByText(reply, { exact: true })).toHaveCount(prior + 1);
    await expect(page.getByRole('log').getByText(reply, { exact: true }).last()).toBeVisible();
  };
  await send('第一轮', '普通测试回复');
  expect(requests[0].nutrition).toBeUndefined();
  expect(requests[0].body).toBeUndefined();
  expect(requests[0].history).toBeUndefined();
  await diet.check();
  await send('第二轮', '饮食测试回声');
  expect(requests[1].nutrition).toEqual([{ localDate: '2026-01-01', meal: 'lunch', portion: '合成饮食资料' }]);
  await diet.uncheck();
  await send('第三轮', '普通测试回复');
  expect(requests[2].nutrition).toBeUndefined();
  expect(requests[2].messages).toEqual([{ role: 'user', content: '第三轮' }]);
  await diet.check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '跟芽芽说', exact: true }).click();
  await showShared(page);
  await expect(diet).not.toBeChecked();
});
