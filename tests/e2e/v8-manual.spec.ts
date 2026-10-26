import { expect, test } from '@playwright/test';
import { showShared } from './helpers/home-coach';

test('manual search, multi-select, filters and shared estimate lead to a multi-action workout', async ({ page }) => {
  await page.goto('/manual');
  await expect(page.getByRole('heading', { name: '手动训练', exact: true })).toBeVisible();
  const start = page.getByRole('button', { name: '开始', exact: true });
  await expect(start).toBeDisabled();
  const search = page.getByRole('searchbox', { name: '搜索动作' });
  await search.fill('squat');
  await page.getByRole('button', { name: '徒手深蹲', exact: true }).first().click();
  await search.fill('plank');
  await page.getByRole('button', { name: '平板支撑', exact: true }).first().click();
  await expect(page.locator('.manual-start')).toContainText('已选 2 个动作');
  await expect(page.locator('.manual-start')).toContainText('约 15 分钟');
  await page.getByRole('button', { name: '康复', exact: true }).click();
  await expect(page.getByText('请先咨询专业人士', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.manual-start')).toContainText('已选 2 个动作');
  await page.getByRole('button', { name: '健身房器械', exact: true }).click();
  await expect(page.getByRole('button', { name: '高位下拉机', exact: true })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);
  await start.click();
  await expect(page).toHaveURL(/\/workout\//);
  const workout = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active;
  });
  expect(workout.plannedExercises).toHaveLength(2);
  expect(workout.plannedSetCount).toBe(4);
});

test('empty and local helper states stay editable without a network AI request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/plans/generate', async route => {
    calls++;
    await route.abort();
  });
  await page.goto('/manual');
  await page.getByRole('button', { name: '最近动作', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('还没有最近完成的动作');
  await page.getByRole('searchbox').fill('zzzzzzzzzz');
  await expect(page.getByText('暂时没有符合条件的动作，试试换个词或清空筛选。')).toBeVisible();
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await page.getByRole('button', { name: '芽芽帮配', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('确认已满18岁');
  await expect(page.locator('.manual-start')).toContainText('已选 0 个动作');
  expect(calls).toBe(0);
});

test('confirmed onboarding filters are editable and plan selection keeps its targets', async ({ page }) => {
  await page.goto('/manual');
  await expect(page.getByRole('heading', { name: '手动训练', exact: true })).toBeVisible();
  const plannedSets = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const { workflow } = await import(/* @vite-ignore */ path);
    const candidate = await workflow.propose({
      goalText: '体能',
      scheduleOriginalText: '每周2次，每次30分钟',
      weeklyTarget: 2,
      sessionMinutes: 30,
      place: 'home',
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
      confirmedAt: new Date().toISOString(),
    });
    candidate.proposal.templates[0].items[0].sets = 3;
    candidate.proposal.templates[0].items[0].target = { metricType: 'reps', reps: 12 };
    await workflow.adopt(candidate);
    return candidate.proposal.templates[0].items.reduce(
      (total: number, item: { sets: number }) => total + item.sets,
      0,
    );
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '在家', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '无器械', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '芽芽帮配', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '按计划来一份', exact: true }).click();
  await page.locator('.manual-plans button').first().click();
  await expect(page.locator('.manual-start')).toContainText('已选 4 个动作');
  await page.getByRole('button', { name: '清空已选', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '在家', exact: true }).click();
  await expect(page.getByRole('button', { name: '在家', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '按计划来一份', exact: true }).click();
  await expect(page.getByRole('heading', { name: '选择一份训练单', exact: true })).toBeVisible();
  await page.locator('.manual-plans button').first().click();
  await expect(page.getByRole('status')).toContainText('保留这份训练单的组数和目标');
  await page.locator('section.manual-chips button').first().click();
  await expect(page.getByRole('status')).toContainText('已切换为手动训练');
  await page.getByRole('button', { name: '按计划来一份', exact: true }).click();
  await page.locator('.manual-plans button').first().click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page).toHaveURL(/\/workout\//);
  const workout = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active;
  });
  expect(workout.plannedSetCount).toBe(plannedSets);
  expect(workout.templateSnapshot.items[0]).toMatchObject({ sets: 3, target: { reps: 12 } });
});

for (const scope of ['valid', 'stale-version', 'stale-template'] as const)
  test(`manual plan shortcut resolves ${scope} one-session override consistently`, async ({ page }) => {
    await page.goto('/manual');
    await expect(page.getByRole('heading', { name: '手动训练', exact: true })).toBeVisible();
    const expected = await page.evaluate(async scope => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const { workflow } = await load('/src/ui/mainline/context.tsx');
      const { repository } = await load('/src/persistence/repository.ts');
      const { estimatePlannedMinutes } = await load('/src/domain/duration-estimate.ts');
      const candidate = await workflow.propose({
        goalText: '体能',
        scheduleOriginalText: '每周2次，每次30分钟',
        weeklyTarget: 2,
        sessionMinutes: 30,
        place: 'home',
        equipment: ['none'],
        adultConfirmed: true,
        cautions: [],
        confirmedAt: new Date().toISOString(),
      });
      await workflow.adopt(candidate);
      const { version, state } = await workflow.snapshot();
      const original = version.templates[0];
      const adjusted = {
        ...original,
        name: '今天调整的训练单',
        items: [{ ...original.items[0], sets: 1, target: { metricType: 'reps', reps: 6 } }],
      };
      await repository.write(async () =>
        repository.db.v8State.put({
          ...state,
          nextWorkoutOverride: {
            planVersionId: scope === 'stale-version' ? crypto.randomUUID() : version.id,
            templateId: scope === 'stale-template' ? 'unavailable-template' : original.id,
            template: adjusted,
            requestId: crypto.randomUUID(),
          },
        }),
      );
      const { templateLabel } = await load('/src/i18n/features/plan/labels.ts');
      const effective = scope === 'valid' ? adjusted : original;
      return {
        name: effective.name,
        // Shown name: the basic plan's bare "A" reads as its content name (V9.20).
        label: templateLabel(effective, 'zh', version.templates),
        ids: effective.items.map((item: { exerciseId: string }) => item.exerciseId),
        minutes: estimatePlannedMinutes(effective.items),
        items: effective.items,
      };
    }, scope);
    await page.reload();
    await page.getByRole('button', { name: '按计划来一份', exact: true }).click();
    await page.getByRole('button', { name: expected.label, exact: true }).click();
    await expect(page.locator('.manual-start')).toContainText(`已选 ${new Set(expected.ids).size} 个动作`);
    await expect(page.locator('.manual-start')).toContainText(`约 ${expected.minutes} 分钟`);
    await expect(page.locator('section.manual-chips button')).toHaveCount(new Set(expected.ids).size);
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await expect(page).toHaveURL(/\/workout\//);
    const actual = await page.evaluate(async () => {
      const path = '/src/ui/mainline/context.tsx';
      return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active;
    });
    expect(actual.templateSnapshot.items).toEqual(expected.items);
    expect(actual.templateSnapshot.name).toBe(expected.name);
  });

async function seedManual(page: import('@playwright/test').Page) {
  await page.goto('/manual');
  await expect(page.getByRole('heading', { name: '手动训练', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const { workflow } = await import(/* @vite-ignore */ path);
    await workflow.adopt(
      await workflow.propose({
        goalText: '体能',
        scheduleOriginalText: '每周2次，每次30分钟',
        weeklyTarget: 2,
        sessionMinutes: 30,
        place: 'home',
        equipment: ['none'],
        adultConfirmed: true,
        cautions: [],
        confirmedAt: new Date().toISOString(),
      }),
    );
  });
  await page.reload();
}
for (const mode of ['success', 'denied', 'failure', 'reject', 'stale', 'stale-start'] as const)
  test(`manual coach ${mode} keeps plan unchanged and requires explicit selection`, async ({ page }) => {
    let calls = 0;
    await page.route('**/api/v1/trial/access-status', route =>
      route.fulfill({
        json: {
          qualification: mode === 'denied' ? 'none' : 'active',
          sessionValid: true,
          expiresAt: Date.now() + 3600000,
          aiEnabled: true,
          summaryAvailable: true,
        },
      }),
    );
    await page.route('**/api/v1/features', route =>
      route.fulfill({ json: { version: 1, flags: { aiAssistantV2: true }, expiresAt: Date.now() + 60000 } }),
    );
    await page.route('**/api/v1/assistant/chat', async route => {
      calls++;
      if (mode === 'denied') {
        await route.fulfill({ status: 403, json: { error: 'QUALIFICATION_REQUIRED' } });
        return;
      }
      if (mode === 'failure') {
        await route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } });
        return;
      }
      const envelope = route.request().postDataJSON(),
        r = envelope.context;
      expect(r.task).toBe('ONBOARD_PLAN');
      expect(r.body).toBeUndefined();
      expect(r.history).toBeUndefined();
      expect(r.nutrition).toBeUndefined();
      const proposal = await page.evaluate(async profile => {
        const path = '/src/application/v8-workflow.ts';
        return (await import(/* @vite-ignore */ path)).basicProposal({
          ...profile,
          confirmedAt: new Date().toISOString(),
        });
      }, r.profile);
      const exercise = await page.evaluate(async request => {
        const path = '/src/coach/response-adapter.ts';
        return (await import(/* @vite-ignore */ path))
          .coachV8Exercises(request)
          .find((e: any) => e.metricType === 'reps');
      }, r);
      proposal.templates.forEach((t: any) => {
        t.estimatedMinutes = r.profile.sessionMinutes;
        t.items = [
          { exerciseId: exercise.id, equipment: exercise.equipment, sets: 3, target: { metricType: 'reps', reps: 11 } },
          { exerciseId: exercise.id, equipment: exercise.equipment, sets: 1, target: { metricType: 'reps', reps: 6 } },
        ];
      });
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          { type: 'text_delta', delta: '可以先查看这份训练安排。' },
          {
            type: 'attachment',
            attachment: {
              requestId: r.requestId,
              restoreGeneration: r.restoreGeneration,
              mutationAllowed: false,
              type: 'plan_proposal',
              proposal,
            },
          },
          { type: 'done', success: true, usage: { inputTokens: 1, outputTokens: 1 }, promptVersion: 'test' },
        ]
          .map(event => 'data: ' + JSON.stringify(event) + '\n\n')
          .join(''),
      });
    });
    await seedManual(page);
    const snapshot = () =>
      page.evaluate(async () => {
        const path = '/src/ui/mainline/context.tsx';
        const s = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
        return { versions: s.versions, active: s.active };
      });
    const before = await snapshot();
    await page.getByRole('button', { name: '芽芽帮配', exact: true }).click();
    expect(calls).toBe(0);
    await showShared(page);
    await expect(page.getByRole('dialog').getByText('查看发送内容', { exact: true })).toBeVisible();
    if (mode === 'reject') {
      await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
      expect(calls).toBe(0);
      expect(await snapshot()).toEqual(before);
      return;
    }
    await page.getByRole('dialog').getByRole('textbox').fill('搭配本次训练');
    await page.getByRole('dialog').getByRole('button', { name: '发送', exact: true }).click();
    if (mode === 'denied' || mode === 'failure') {
      if (mode === 'denied')
        await expect(page.getByRole('dialog').getByRole('status')).toContainText(
          '现在用的是本地建议 · 还没开通 AI 助手芽芽',
        );
      await page.getByRole('dialog').getByRole('button', { name: '先排一份计划', exact: true }).click();
      expect(calls).toBe(mode === 'denied' ? 0 : 1);
    } else {
      await expect(page.getByRole('button', { name: '带回手动训练页选择', exact: true })).toBeVisible();
      if (mode === 'success')
        await expect(page.getByRole('dialog').getByText('15 分钟', { exact: true })).toHaveCount(2);
      if (mode === 'success' && process.env.MANUAL_AI_SCREENSHOTS === '1') {
        for (const width of [375, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.getByRole('dialog').locator('.assistant-attachment').first().scrollIntoViewIfNeeded();
          await page.screenshot({
            path: `test-results-review/mainline-polish/mock-${width}-manual-ai-candidate.png`,
            animations: 'disabled',
          });
        }
      }
      if (mode === 'stale') {
        await page.evaluate(async () => {
          const path = '/src/persistence/repository.ts';
          const { repository } = await import(/* @vite-ignore */ path);
          const m = await repository.readMetadata();
          await repository.db.metadata.put({ ...m, restoreGeneration: (m.restoreGeneration ?? 0) + 1 });
        });
        await expect(page.getByRole('button', { name: '带回手动训练页选择', exact: true })).toHaveCount(0);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(await snapshot()).toEqual(before);
        return;
      }
      await page.getByRole('button', { name: '带回手动训练页选择', exact: true }).click();
    }
    expect(await snapshot()).toEqual(before);
    await expect(page.getByRole('button', { name: '开始', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '选择这份训练单', exact: true }).first().click();
    expect(await snapshot()).toEqual(before);
    if (mode === 'success') {
      await expect(page.locator('.manual-start')).toContainText('已选 1 个动作');
      await expect(page.locator('.manual-start')).toContainText('约 15 分钟');
    }
    if (mode === 'stale-start') {
      await page.evaluate(async () => {
        const path = '/src/persistence/repository.ts';
        const { repository } = await import(/* @vite-ignore */ path);
        await repository.write(async () => {});
      });
      await page.getByRole('button', { name: '开始', exact: true }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      expect(await snapshot()).toEqual(before);
      return;
    }
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await expect(page).toHaveURL(/\/workout\//);
    const after = await snapshot();
    expect(after.versions).toEqual(before.versions);
    expect(after.active.planVersionId).toBeUndefined();
    expect(after.active.templateSnapshot.items[0].sets).toBe(
      mode === 'success' ? 3 : before.versions[0].templates[0].items[0].sets,
    );
    if (mode === 'success') {
      expect(
        after.active.templateSnapshot.items.map((item: any) => ({ sets: item.sets, target: item.target })),
      ).toEqual([
        { sets: 3, target: { metricType: 'reps', reps: 11 } },
        { sets: 1, target: { metricType: 'reps', reps: 6 } },
      ]);
      expect(after.active.plannedExercises).toHaveLength(2);
      expect(after.active.plannedSetCount).toBe(4);
      expect(after.active.templateSnapshot.estimatedMinutes).toBe(15);
    }
    await page.reload();
    expect((await snapshot()).active.templateSnapshot).toEqual(after.active.templateSnapshot);
  });
test('manual typo suggestions retain filters and open the complete shared guide', async ({ page }) => {
  await seedManual(page);
  await page.getByRole('searchbox').fill('徒手伸尊');
  await expect(page.getByRole('heading', { name: '相近动作（保留当前筛选）' })).toBeVisible();
  await expect(page.getByRole('button', { name: '在家', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.manual-card').first().getByRole('button', { name: '动作提示' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('动作要点');
  await expect(dialog).toContainText('常见错误');
  await expect(dialog.getByRole('link', { name: 'RepDB' })).toHaveAttribute('href', 'https://repdb.co/');
});

test('home equipment defaults remain editable and empty-state clear count matches its effect', async ({ page }) => {
  await seedManual(page);
  for (const name of ['无器械', '瑜伽垫'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '无器械', exact: true }).click();
  await page.getByRole('button', { name: '哑铃', exact: true }).click();
  await page.getByRole('searchbox').fill('徒手深蹲');
  await expect(page.getByRole('button', { name: '无器械', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '哑铃', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '徒手深蹲', exact: true }).first().click();
  const count = await page.evaluate(async () => {
    const path = '/src/catalog/catalog-service.ts';
    return (await import(/* @vite-ignore */ path)).searchExercises('', {}).length;
  });
  await page.getByRole('button', { name: '胸', exact: true }).click();
  await expect(page.locator('.manual-empty')).toContainText(`清空筛选后有 ${count} 个动作`);
  await expect(page.getByRole('searchbox')).toHaveValue('徒手深蹲');
  await page.getByRole('searchbox').fill('zzzzzzzz');
  await expect(page.locator('.manual-empty')).toContainText(`清空筛选后有 ${count} 个动作`);
  await expect(page.locator('.manual-empty')).toContainText('同时清空搜索词');
  await page.locator('.manual-empty').getByRole('button', { name: '清空筛选', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.locator('.manual-results-heading')).toContainText(String(count));
  await expect(page.locator('.manual-filters button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.manual-start')).toContainText('已选 1 个动作');
});
