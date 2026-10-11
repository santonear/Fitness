import { expect, test } from '@playwright/test';

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
  const workout = await page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active; });
  expect(workout.plannedExercises).toHaveLength(2);
  expect(workout.plannedSetCount).toBe(4);
});

test('empty and local helper states stay editable without a network AI request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/plans/generate', async route => { calls++; await route.abort(); });
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

test('confirmed onboarding filters are editable and local selection uses them', async ({ page }) => {
  await page.goto('/manual');
  await expect(page.getByRole('heading', { name: '手动训练', exact: true })).toBeVisible();
  const plannedSets = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx'; const { workflow } = await import(/* @vite-ignore */ path);
    const candidate = await workflow.propose({ goalText: '体能', scheduleOriginalText: '每周2次，每次30分钟', weeklyTarget: 2, sessionMinutes: 30, place: 'home', equipment: ['none'], adultConfirmed: true, cautions: [], confirmedAt: new Date().toISOString() });
    candidate.proposal.templates[0].items[0].sets = 3;
    candidate.proposal.templates[0].items[0].target = { metricType: 'reps', reps: 12 };
    await workflow.adopt(candidate);
    return candidate.proposal.templates[0].items.reduce((total: number, item: { sets: number }) => total + item.sets, 0);
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '在家', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '无器械', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '芽芽帮配', exact: true }).click();
  await expect(page.locator('.manual-start')).toContainText('已选 4 个动作');
  await expect(page.getByRole('status')).toContainText('按当前筛选本地搭配');
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
  const workout = await page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active; });
  expect(workout.plannedSetCount).toBe(plannedSets);
  expect(workout.templateSnapshot.items[0]).toMatchObject({ sets: 3, target: { reps: 12 } });
});

for (const scope of ['valid', 'stale-version', 'stale-template'] as const) test(`manual plan shortcut resolves ${scope} one-session override consistently`, async ({ page }) => {
  await page.goto('/manual');
  await expect(page.getByRole('heading', { name: '手动训练', exact: true })).toBeVisible();
  const expected = await page.evaluate(async scope => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { workflow } = await load('/src/ui/mainline/context.tsx');
    const { repository } = await load('/src/persistence/repository.ts');
    const { estimatePlannedMinutes } = await load('/src/application/rules/duration-estimate.ts');
    const candidate = await workflow.propose({ goalText: '体能', scheduleOriginalText: '每周2次，每次30分钟', weeklyTarget: 2, sessionMinutes: 30, place: 'home', equipment: ['none'], adultConfirmed: true, cautions: [], confirmedAt: new Date().toISOString() });
    await workflow.adopt(candidate);
    const { version, state } = await workflow.snapshot(); const original = version.templates[0];
    const adjusted = { ...original, name: '今天调整的训练单', items: [{ ...original.items[0], sets: 1, target: { metricType: 'reps', reps: 6 } }] };
    await repository.write(async () => repository.db.v8State.put({ ...state, nextWorkoutOverride: { planVersionId: scope === 'stale-version' ? crypto.randomUUID() : version.id, templateId: scope === 'stale-template' ? 'unavailable-template' : original.id, template: adjusted, requestId: crypto.randomUUID() } }));
    const effective = scope === 'valid' ? adjusted : original;
    return { name: effective.name, ids: effective.items.map((item: { exerciseId: string }) => item.exerciseId), minutes: estimatePlannedMinutes(effective.items), items: effective.items };
  }, scope);
  await page.reload();
  await page.getByRole('button', { name: '按计划来一份', exact: true }).click();
  await page.getByRole('button', { name: expected.name, exact: true }).click();
  await expect(page.locator('.manual-start')).toContainText(`已选 ${new Set(expected.ids).size} 个动作`);
  await expect(page.locator('.manual-start')).toContainText(`约 ${expected.minutes} 分钟`);
  await expect(page.locator('section.manual-chips button')).toHaveCount(new Set(expected.ids).size);
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page).toHaveURL(/\/workout\//);
  const actual = await page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active; });
  expect(actual.templateSnapshot.items).toEqual(expected.items);
  expect(actual.templateSnapshot.name).toBe(expected.name);
});
