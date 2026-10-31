import { fillBirthMonth } from './helpers/birth-month';
import { openHomeCoach, openQuickAdjust } from './helpers/home-coach';
import { Rules } from '../../src/engine/data';
import { answerTexts, basicSafety, engineSafety, generate, startOnboarding } from './helpers/onboarding-v9';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SetFact, SetFeedbackEvent } from '../../src/domain/v8/contracts';
import { homeStart, openDayView, startToday } from './helpers/home-start';

// This file is also discovered by the shared suite: retain the dedicated
// suite's budget for real IndexedDB histories and multi-theme screenshots.
// The full screening and backup journeys run several onboardings; CI runners need the headroom.
test.setTimeout(240000);

async function localFeatures(page: Page) {
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: true, aiAssistantV2: false, bodyProfile: false },
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } }),
  );
  await page.clock.setFixedTime(new Date('2026-10-15T03:00:00.000Z'));
}
async function screenAndDraft(page: Page, loaded = false) {
  await startOnboarding(page);
  await answerTexts(page, [
    '保持健康，规律训练',
    loaded ? '每周3次，每次45分钟' : '每周3次，每次30分钟',
    '在家，有哑铃、弹力带和凳子',
  ]);
  await engineSafety(page);
  // Every screening answer above was explicit; the ready screen only then allows generation.
  const generate = page.getByRole('button', { name: '生成计划', exact: true });
  await expect(generate).toBeEnabled();
  await generate.click();
  try {
    await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();
  } catch (error) {
    const diagnostic = await page.evaluate(async () => {
      const paths = [
        '/src/application/rules/local-profile.ts',
        '/src/application/engine-profile.ts',
        '/src/engine/index.ts',
        '/src/ui/mainline/context.tsx',
        '/src/persistence/repository.ts',
      ];
      const [local, mapping, engine, context, persistence] = await Promise.all(
        paths.map(path => import(/* @vite-ignore */ path)),
      );
      const key = Object.keys(localStorage).find(key => key.startsWith('fitness-v8-draft:'));
      const answers = key ? JSON.parse(localStorage.getItem(key)!).answers : undefined;
      const snapshot = await context.workflow.snapshot(),
        stored = snapshot.profile;
      const timeZone = stored?.timeZone ?? 'Asia/Shanghai';
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const asOfDate = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
      const input = answers ? local.localProfile(answers) : undefined;
      const profile = input
        ? mapping.toEngineProfile(input, {
            asOfDate,
            timeZone,
            locale: stored?.locale ?? 'zh',
            history: snapshot.workouts,
            notes: await persistence.repository.db.aiMemoryNotes.toArray(),
            ageYears: stored?.bodyDetails?.values.age,
            bodyWeightKg: stored?.bodyDetails?.values.weightKg,
          })
        : undefined;
      const plan = profile ? engine.generatePlan(profile) : undefined;
      return {
        diagnosticOnly: true,
        profileMappingFailed: !profile,
        input,
        profile,
        issues: plan ? engine.validatePlan(plan, profile) : null,
        gates: plan?.gates,
        quality: plan?.quality,
      };
    });
    await test.info().attach('synthetic-generation-diagnostic', {
      body: JSON.stringify(diagnostic, null, 2),
      contentType: 'application/json',
    });
    throw error;
  }
  return page.locator('.v9-session-details').allTextContents();
}
function namedValues(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (node && typeof node === 'object')
    for (const [name, value] of Object.entries(node)) {
      if (name === key) out.push(value);
      namedValues(value, key, out);
    }
  return out;
}

async function offlineTempoPage(page: Page, path: string) {
  // Complete the mocked offline response before navigating away. WebKit can
  // otherwise report an access-control error for an interrupted interception.
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/announcement');
  await page.goto(path);
  const response = await pending;
  expect(response.status()).toBe(503);
  await response.finished();
}

async function setupSyntheticMobilityTempo(page: Page) {
  const errors: string[] = [],
    modelAttempts: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    if (/assistant|coach|chat|completion/i.test(new URL(route.request().url()).pathname))
      modelAttempts.push(route.request().url());
    return route.fulfill({ status: 503, json: { error: 'LOCAL_OFFLINE_TEMPO_TEST' } });
  });
  await localFeatures(page);
  await page.clock.setFixedTime(new Date('2026-06-11T03:00:00.000Z'));
  await offlineTempoPage(page, '/manual');
  await expect(page.getByRole('searchbox')).toBeVisible();
  // Canonical source30: explicit synthetic preference for the unit-tested bodyweight squat slot.
  const rules = new Rules(),
    bodyweightSquat = rules.data.exercises.find(exercise => exercise.slug === 'bodyweight-squat')!;
  const synthetic = baseProfile({
    goal: 'mobility',
    level: 'intermediate',
    trainingAgeWeeks: 18,
    daysPerWeek: 6,
    sessionMinutes: 30,
    preferences: {
      excludedExerciseIds: rules.data.exercises
        .filter(exercise => exercise.primary_pattern === 'squat' && exercise.id !== bodyweightSquat.id)
        .map(exercise => exercise.id),
      cannotDo: [],
    },
  });
  // Build the synthetic training-age fact through the real workflow, never a fabricated engine plan.
  await page.evaluate(async source => {
    const paths = [
      '/src/ui/mainline/context.tsx',
      '/src/application/rules/local-profile.ts',
      '/src/catalog/exercise-ids.ts',
    ];
    const [context, local, catalog] = await Promise.all(paths.map(path => import(/* @vite-ignore */ path))),
      at = new Date().toISOString();
    const coach = {
      ...local.localProfile({
        ...source,
        goalText: '合成柔韧验证',
        scheduleOriginalText: '每周6次，每次30分钟',
        placeEquipmentText: '在家，无器械',
        adultConfirmed: true,
        healthStorageConsent: { acceptedAt: at },
      }),
      screening: {
        ...source.screening,
        completedAt: at,
        lastScreenedAt: at,
        redFlagReview: source.screening.redFlagReview
          ? { ...source.screening.redFlagReview, requiredAt: at, answeredAt: at }
          : undefined,
      },
    };
    await context.workflow.adopt(await context.workflow.propose(coach, 'zh'));
    const record = await context.workflow.start(undefined, catalog.EXERCISE_IDS.bodyweightSquat);
    await context.workflow.recordSet(record.id, 0, 0, { reps: 8 });
    await context.workflow.finish(record.id, { reasons: [] });
  }, synthetic);
  // Establish four closed source-qualified weeks through real workflow writes.
  // Five completed sessions satisfy this synthetic six-day profile's 80% quota.
  for (let week = 0; week < 4; week++) {
    for (let day = 0; day < 5; day++) {
      const stamp = new Date(Date.parse('2026-09-15T03:00:00.000Z') + (week * 7 + day) * 86400000);
      await page.clock.setFixedTime(stamp);
      await page.evaluate(
        async ({ source, screen }) => {
          const paths = ['/src/ui/mainline/context.tsx', '/src/catalog/exercise-ids.ts'];
          const [context, catalog] = await Promise.all(paths.map(path => import(/* @vite-ignore */ path))),
            at = new Date().toISOString();
          if (screen) {
            const snapshot = await context.workflow.snapshot();
            await context.workflow.saveEngineSettings(
              {
                ...snapshot.state.coachProfile,
                screening: {
                  ...source.screening,
                  completedAt: at,
                  lastScreenedAt: at,
                  redFlagReview: source.screening.redFlagReview
                    ? { ...source.screening.redFlagReview, requiredAt: at, answeredAt: at }
                    : undefined,
                },
              },
              snapshot.metadata.dataRevision,
            );
          }
          const record = await context.workflow.start(undefined, catalog.EXERCISE_IDS.bodyweightSquat);
          for (const exercise of record.plannedExercises)
            for (let set = 0; set < exercise.plannedSetCount; set++)
              await context.workflow.recordSet(record.id, exercise.itemIndex, set, { reps: 8 });
          await context.workflow.finish(record.id, { reasons: [] });
        },
        { source: synthetic, screen: day === 0 },
      );
    }
  }
  // The approved profile is active, not returning after an eighteen-week gap.
  // Append a recent fact through the same workflow; preserve the first training-age fact.
  await page.clock.setFixedTime(new Date('2026-10-14T03:00:00.000Z'));
  await page.evaluate(async () => {
    const paths = ['/src/ui/mainline/context.tsx', '/src/catalog/exercise-ids.ts'];
    const [context, catalog] = await Promise.all(paths.map(path => import(/* @vite-ignore */ path)));
    const record = await context.workflow.start(undefined, catalog.EXERCISE_IDS.bodyweightSquat);
    await context.workflow.recordSet(record.id, 0, 0, { reps: 8 });
    await context.workflow.finish(record.id, { reasons: [] });
  });
  await page.clock.setFixedTime(new Date('2026-10-15T03:00:00.000Z'));
  const identity = await page.evaluate(async source => {
    const paths = [
      '/src/ui/mainline/context.tsx',
      '/src/application/rules/local-profile.ts',
      '/src/application/engine-profile.ts',
      '/src/engine/source-warmup.ts',
      '/src/engine/data.ts',
      '/src/catalog/exercises.ts',
    ];
    const [context, local, mapping, duration, data, catalog] = await Promise.all(
        paths.map(path => import(/* @vite-ignore */ path)),
      ),
      snapshot = await context.workflow.snapshot(),
      at = new Date().toISOString();
    const coach = local.localProfile({
      ...source,
      goalText: '合成柔韧验证',
      scheduleOriginalText: '每周6次，每次30分钟',
      placeEquipmentText: '在家，无器械',
      adultConfirmed: true,
      healthStorageConsent: { acceptedAt: at },
      screening: {
        ...source.screening,
        completedAt: at,
        lastScreenedAt: at,
        redFlagReview: source.screening.redFlagReview
          ? { ...source.screening.redFlagReview, requiredAt: at, answeredAt: at }
          : undefined,
      },
    });
    const mapped = mapping.toEngineProfile(coach, {
      asOfDate: '2026-10-15',
      timeZone: snapshot.profile.timeZone,
      locale: 'zh',
      history: snapshot.workouts,
      screeningEvidenceEvents: snapshot.state?.screeningEvidenceEvents,
    });
    if (mapped?.trainingAgeWeeks !== 18) throw Error('Synthetic workflow history must replay eighteen weeks');
    let candidate;
    try {
      candidate = await context.workflow.propose(coach, 'zh', { trainingEngine: true });
    } catch (error) {
      throw Error(
        JSON.stringify({
          stage: 'real_workflow_propose',
          quality: (error as { plan?: { quality: unknown } }).plan?.quality,
          message: String(error),
        }),
      );
    }
    if (candidate.enginePlan?.quality?.status !== 'ready')
      throw Error(
        JSON.stringify({
          stage: 'real_mobility_readiness',
          quality: candidate.enginePlan?.quality,
          gates: candidate.enginePlan?.gates,
          trace: candidate.enginePlan?.trace,
          mapped,
          history: snapshot.workouts.map(
            (row: { id: string; startedAt: string; endedAt?: string; status: string }) => ({
              id: row.id,
              startedAt: row.startedAt,
              endedAt: row.endedAt,
              status: row.status,
            }),
          ),
          screeningEvidenceEvents: snapshot.state?.screeningEvidenceEvents,
        }),
      );
    const template = candidate.enginePlan.templates[0],
      ramp = duration
        .sourceWarmupRamps(template, mapped, new data.Rules())
        .find(
          (row: { kind: string; itemIndex: number; seconds: number }) =>
            row.kind === 'bodyweight_main' && template.items[row.itemIndex].prescription?.warmupSeconds === row.seconds,
        );
    if (!ramp || !template.items[ramp.itemIndex].prescription?.tempo)
      throw Error('A genuine bodyweight ramp with source tempo is required');
    await context.workflow.adopt(candidate);
    const preview = await context.workflow.nextTargetPreview(template.id);
    if (preview.blocked) {
      const path = '/src/engine/index.ts',
        engine = await import(/* @vite-ignore */ path),
        projection = engine.nextTargets(snapshot.workouts, candidate.enginePlan, mapped, { templateId: template.id });
      throw Error(
        JSON.stringify({
          stage: 'actual_next_preview',
          notices: preview.notices,
          gates: projection.gates,
          issues: engine.validatePlan(projection.value, mapped, {
            progression: { baseline: candidate.enginePlan, history: snapshot.workouts, templateId: template.id },
          }),
        }),
      );
    }
    const projected = preview.template;
    if (!projected) throw Error('Real source30 preview must provide its template');
    const projectedRamps = duration.sourceWarmupRamps(projected, mapped, new data.Rules()),
      actual = projectedRamps.find(
        (row: { kind: string; itemIndex: number; seconds: number }) =>
          row.kind === 'bodyweight_main' &&
          projected.items[row.itemIndex].prescription?.warmupSeconds === row.seconds &&
          projected.items[row.itemIndex].prescription?.tempo,
      );
    const unauthenticated = projectedRamps.find(
      (row: { kind: string; itemIndex: number; seconds: number }) =>
        row.kind === 'bodyweight_main' && projected.items[row.itemIndex].prescription?.warmupSeconds !== row.seconds,
    );
    if (!actual || !unauthenticated)
      throw Error(JSON.stringify({ stage: 'source30_authentication', projected, projectedRamps }));
    const name = (id: string) => catalog.exercises.find((exercise: { id: string }) => exercise.id === id).name.zh;
    return {
      name: name(actual.exerciseId),
      exerciseId: actual.exerciseId,
      unauthenticatedName: name(unauthenticated.exerciseId),
      profile: mapped,
    };
  }, synthetic);
  return { identity, errors, modelAttempts };
}
test('synthetic source30 preferred-squat Next renders fixed tempo and preserves it in downloaded backup', async ({
  page,
}, info) => {
  const { identity, errors, modelAttempts } = await setupSyntheticMobilityTempo(page);
  await offlineTempoPage(page, '/');
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const phase = /≈3 \/ ≈1 \/ 0 秒/;
  for (const [theme, label] of [
    ['pop', '柔光拟物'],
    ['vivid', '山野暖阳'],
    ['gentle', '温和陪伴'],
    ['data', '专业数据'],
    ['fire', '燃动挑战'],
  ]) {
    await offlineTempoPage(page, '/settings/appearance');
    await page.getByRole('radio', { name: label, exact: true }).click();
    await offlineTempoPage(page, '/');
    await openDayView(page);
    const detail = page
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: identity.name }) })
      .first();
    await expect(detail).toHaveCount(1);
    await detail.locator('summary').click();
    await expect(detail.getByText('离心 / 向心 / 停顿', { exact: true }).first()).toBeVisible();
    await expect(detail.getByText(phase).last()).toBeVisible();
    const warm = detail.getByRole('region', { name: '专项热身组', exact: true });
    await expect(warm).toBeVisible();
    await expect(warm.getByText(phase)).toBeVisible();
    const unauthenticated = page
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: identity.unauthenticatedName }) })
      .first();
    await expect(unauthenticated).toHaveCount(1);
    await expect(
      unauthenticated.getByRole('region', { name: '专项热身组', exact: true, includeHidden: true }),
    ).toHaveCount(0);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({
        path: info.outputPath(`tempo-next-${theme}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
  await offlineTempoPage(page, '/settings');
  await page.getByRole('button', { name: '备份恢复', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  const backupPath = info.outputPath('synthetic-mobility-tempo-backup.json');
  await (await pending).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(namedValues(backup, 'tempo')).toContainEqual({ eccentricSeconds: 3, concentricSeconds: 1, pauseSeconds: 0 });
  expect(namedValues(backup, 'enginePlan').length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(modelAttempts).toEqual([]);
  await info.attach('synthetic-mobility-tempo-scope', {
    body: JSON.stringify(
      {
        scope: 'synthetic workflow, desktop Chromium viewports; not onboarding or phone hardware',
        identity,
        errors,
        modelAttempts,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
});
test('synthetic source30 preferred-squat workout renders authenticated fixed tempo after real start', async ({
  page,
}, info) => {
  const { identity, errors, modelAttempts } = await setupSyntheticMobilityTempo(page),
    phase = /≈3 \/ ≈1 \/ 0 秒/;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await startToday(page);
  await expect(page).toHaveURL(/workout\//);
  const activeUrl = page.url();
  for (const [theme, label] of [
    ['pop', '柔光拟物'],
    ['vivid', '山野暖阳'],
    ['gentle', '温和陪伴'],
    ['data', '专业数据'],
    ['fire', '燃动挑战'],
  ]) {
    await page.goto('/settings/appearance');
    await page.getByRole('radio', { name: label, exact: true }).click();
    await page.goto(activeUrl);
    await page.locator('.v8-capsules').getByRole('button', { name: identity.name, exact: true }).click();
    await expect(page.getByRole('heading', { name: identity.name, exact: true })).toBeVisible();
    await expect(page.getByText(phase).last()).toBeVisible();
    await expect(page.getByRole('region', { name: '专项热身组', exact: true }).getByText(phase)).toBeVisible();
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({
        path: info.outputPath(`tempo-workout-${theme}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.locator('.v8-capsules').getByRole('button', { name: identity.unauthenticatedName, exact: true }).click();
    await expect(page.getByRole('heading', { name: identity.unauthenticatedName, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '专项热身组', exact: true })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(modelAttempts).toEqual([]);
  await info.attach('synthetic-mobility-workout-scope', {
    body: JSON.stringify(
      {
        scope: 'synthetic workflow, desktop Chromium viewports; not onboarding or phone hardware',
        identity,
        errors,
        modelAttempts,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
});
async function openSourceWarmup(page: Page) {
  const region = page
    .getByRole('region', { name: '专项热身组', exact: true, includeHidden: true })
    .filter({ hasText: /(?:50|75)%/ })
    .first();
  const details = page.locator('details').filter({ has: region }).first();
  const templateCount = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).version.templates.length;
  });
  await openDayView(page);
  for (let attempt = 0; attempt < templateCount && (await region.count()) === 0; attempt++) {
    await page.getByRole('button', { name: '换一份', exact: true }).click();
    await expect(homeStart(page)).toBeEnabled();
    await openDayView(page);
  }
  await expect(details).toHaveCount(1);
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  await expect(region).toBeVisible();
  await expect(region.getByRole('listitem').first()).toContainText(/\d+ 次/);
  await expect(region).toContainText(/(?:50|75)%/);
}

test('actual screening UI generates deterministic local drafts and preserves engine fields in backup', async ({
  page,
  browser,
}, info) => {
  // Ten themed screenshot passes; on a shared CI worker this runs past the file-wide four minutes.
  test.setTimeout(480000);
  await localFeatures(page);
  const apiRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(new URL(request.url()).pathname);
  });
  const first = await screenAndDraft(page, true);
  expect(first.length).toBeGreaterThan(0);
  const other = await browser.newContext({ viewport: { width: 375, height: 844 } }),
    otherPage = await other.newPage();
  try {
    await localFeatures(otherPage);
    expect(await screenAndDraft(otherPage, true)).toEqual(first);
  } finally {
    await other.close();
  }
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const saved = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
    return {
      screening: data.state.coachProfile?.screening,
      birth: data.state.coachProfile?.birthYearMonth,
      engine: !!data.version?.enginePlan,
    };
  });
  expect(saved.birth).toBe('1991-06');
  expect(saved.screening?.parqAnswers).toEqual(Array(7).fill(false));
  expect(saved.screening?.completedAt).toBeTruthy();
  expect(saved.engine).toBe(true);
  // Explicit synthetic user-recorded loads make percentage ramps meaningful; no plan is fabricated.
  const syntheticLoadedHistory = await page.evaluate(async () => {
    const paths = [
      '/src/ui/mainline/context.tsx',
      '/src/engine/source-warmup.ts',
      '/src/application/engine-profile.ts',
      '/src/engine/data.ts',
    ];
    const [context, warmup, mapping, data] = await Promise.all(paths.map(path => import(/* @vite-ignore */ path))),
      snapshot = await context.workflow.snapshot(),
      coach = { ...snapshot.state.coachProfile, equipmentLoadsKg: { dumbbell: 5, 'resistance-band': 5 } };
    await context.workflow.saveEngineSettings(coach, snapshot.metadata.dataRevision);
    await context.workflow.adopt(await context.workflow.propose(coach, 'zh', { trainingEngine: true }));
    const adopted = await context.workflow.snapshot(),
      template = adopted.version.templates[0],
      record = await context.workflow.start(template.id);
    // Every fact below is synthetic, appended through the same workflow as user input.
    for (const [itemIndex, item] of record.templateSnapshot.items.entries())
      for (let setIndex = 0; setIndex < item.sets; setIndex++) {
        const values =
          'reps' in item.target
            ? { reps: 15, ...('loadGrams' in item.target ? { loadGrams: item.target.loadGrams } : {}) }
            : { durationSeconds: item.target.durationSeconds };
        await context.workflow.recordSet(record.id, itemIndex, setIndex, values);
        await context.workflow.appendSetFeedback(record.id, {
          id: crypto.randomUUID(),
          exerciseId: item.exerciseId,
          itemIndex,
          setIndex,
          createdAt: new Date().toISOString(),
          effort: 'too_light',
          rir: 4,
        });
      }
    const finished = await context.workflow.finish(record.id, { reasons: [] });
    if (finished.status !== 'complete') throw Error('Synthetic loaded workout must actually be complete');
    const current = await context.workflow.snapshot(),
      projected = await context.workflow.nextTargetPreview(template.id),
      profile = mapping.toEngineProfile(current.state.coachProfile, {
        asOfDate: '2026-10-15',
        timeZone: current.profile.timeZone,
        locale: 'zh',
        history: current.workouts,
        screeningEvidenceEvents: current.state.screeningEvidenceEvents,
      });
    const authenticated =
      projected.template &&
      warmup
        .sourceWarmupRamps(projected.template, profile, new data.Rules())
        .find(
          (ramp: { kind: string; itemIndex: number; seconds: number }) =>
            ramp.kind === 'first_loaded_compound' &&
            projected.template.items[ramp.itemIndex].prescription?.warmupSeconds === ramp.seconds,
        );
    if (projected.blocked || !authenticated)
      throw Error(JSON.stringify({ stage: 'real_loaded_progression', projected, profile }));
    return {
      scope: 'synthetic complete workout through workflow; no direct plan or metadata writes',
      recordId: record.id,
      templateId: template.id,
      authenticated,
    };
  });
  await info.attach('synthetic-loaded-progression', {
    body: JSON.stringify(syntheticLoadedHistory, null, 2),
    contentType: 'application/json',
  });
  await page.goto('/');
  await openSourceWarmup(page);
  for (const [theme, label] of [
    ['pop', '柔光拟物'],
    ['vivid', '山野暖阳'],
    ['gentle', '温和陪伴'],
    ['data', '专业数据'],
    ['fire', '燃动挑战'],
  ]) {
    await page.goto('/settings/appearance');
    await page.getByRole('radio', { name: label, exact: true }).click();
    await page.goto('/');
    await openSourceWarmup(page);
    for (const width of [375, 1280, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${theme}-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
  const adjustment = await openHomeCoach(page);
  await (await openQuickAdjust(page)).getByRole('button', { name: '只练上肢', exact: true }).click();
  const localAdjustment = await page.evaluate(async templateId => {
    const paths = ['/src/ui/mainline/context.tsx', '/src/coach/request-builder.ts', '/src/application/engine-plan.ts'];
    const [context, builder, adapter] = await Promise.all(paths.map(path => import(/* @vite-ignore */ path))),
      snapshot = await context.workflow.snapshot(),
      request = builder.buildCoachRequest({ task: 'ADJUST_TODAY', data: snapshot, templateId });
    if (!request?.engineProfile) throw Error('Current local adjustment request must contain its mapped profile');
    return {
      scope: 'actual persisted synthetic workout and current local request',
      request,
      upper: adapter.engineAction(request, request.engineProfile, { kind: 'adjust', request: { focus: 'upper' } }),
      shorter: adapter.engineAction(request, request.engineProfile, { kind: 'adjust', request: { minutes: 30 } }),
    };
  }, syntheticLoadedHistory.templateId);
  await info.attach('actual-local-adjustment-diagnostic', {
    body: JSON.stringify(localAdjustment, null, 2),
    contentType: 'application/json',
  });
  // This45-minute upper-only request cannot satisfy the source duration boundary; keep its safe no-op.
  expect(localAdjustment.upper.noop).toBe(true);
  await expect(adjustment.getByRole('alert')).toBeVisible();
  await expect(adjustment.locator('.assistant-attachment')).toHaveCount(0);
  // A separate source-legal30-minute local request must still produce an actionable attachment.
  expect(localAdjustment.shorter.noop).toBe(false);
  {
    const tools = await openQuickAdjust(page);
    await tools.getByRole('combobox', { name: '分钟', exact: true }).selectOption('30');
    await tools.getByRole('button', { name: '缩短到所选时长', exact: true }).click();
  }
  await expect(adjustment.locator('.assistant-attachment')).toBeVisible();
  await expect(adjustment.getByRole('button', { name: '应用建议', exact: true })).toBeVisible();
  await adjustment.getByRole('button', { name: '关闭', exact: true }).click();
  await startToday(page);
  await expect(page).toHaveURL(/workout\//);
  const activeUrl = page.url();
  const warmupIdentity = await page.evaluate(async () => {
    const paths = [
      '/src/ui/mainline/context.tsx',
      '/src/application/engine-profile.ts',
      '/src/engine/source-warmup.ts',
      '/src/engine/data.ts',
      '/src/catalog/exercises.ts',
    ];
    const [context, mapping, duration, data, catalog] = await Promise.all(
      paths.map(path => import(/* @vite-ignore */ path)),
    );
    const snapshot = await context.workflow.snapshot(),
      active = snapshot.active,
      template = active?.templateSnapshot;
    if (!active || !template || !snapshot.state?.coachProfile)
      throw new Error('Actual active source snapshot is required');
    const timeZone = snapshot.profile?.timeZone ?? 'Asia/Shanghai',
      asOfDate = data.calendarDay(new Date().toISOString(), timeZone);
    const profile = mapping.toEngineProfile(snapshot.state.coachProfile, {
      asOfDate,
      timeZone,
      locale: 'zh',
      history: snapshot.workouts,
      ageYears: snapshot.profile?.bodyDetails?.values.age,
      bodyWeightKg: snapshot.profile?.bodyDetails?.values.weightKg,
    });
    if (!profile) throw new Error('Actual active profile must map');
    const ramp = duration
      .sourceWarmupRamps(template, profile, new data.Rules())
      .find((row: { kind: string }) => row.kind === 'first_loaded_compound');
    if (!ramp || template.items[ramp.itemIndex]?.prescription?.warmupSeconds !== ramp.seconds)
      throw new Error('An authenticated first loaded source ramp is required');
    const name = (id: string) => catalog.exercises.find((exercise: { id: string }) => exercise.id === id)?.name.zh;
    return { loaded: name(ramp.exerciseId), first: name(active.plannedExercises[0].exerciseId) };
  });
  expect(warmupIdentity.loaded).toBeTruthy();
  expect(warmupIdentity.first).toBeTruthy();
  for (const [theme, label] of [
    ['pop', '柔光拟物'],
    ['vivid', '山野暖阳'],
    ['gentle', '温和陪伴'],
    ['data', '专业数据'],
    ['fire', '燃动挑战'],
  ]) {
    await page.goto('/settings/appearance');
    await page.getByRole('radio', { name: label, exact: true }).click();
    await page.goto(activeUrl);
    await page.locator('.v8-capsules').getByRole('button', { name: warmupIdentity.loaded!, exact: true }).click();
    await expect(page.getByRole('heading', { name: warmupIdentity.loaded!, exact: true })).toBeVisible();
    const source = page.getByRole('region', { name: '专项热身组', exact: true });
    await expect(source).toBeVisible();
    await expect(source).toContainText('50%');
    await expect(source).toContainText('75%');
    await expect(source.getByRole('listitem').first()).toContainText(/\d+ 次/);
    for (const width of [375, 1280, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(source).toBeVisible();
      await page.screenshot({ path: info.outputPath(`workout-${theme}-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
  await page.locator('.v8-capsules').getByRole('button', { name: warmupIdentity.first!, exact: true }).click();
  await expect(page.getByRole('heading', { name: warmupIdentity.first!, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  const feedback = page.getByRole('group', { name: '这一组 · 1', exact: true });
  await expect(feedback).toBeVisible();
  await feedback.getByRole('button', { name: '太轻', exact: true }).click();
  await expect(feedback.getByRole('button', { name: '太轻', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await feedback.getByRole('button', { name: '刚好', exact: true }).click();
  await expect(feedback.getByRole('button', { name: '刚好', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  const recorded = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
    return {
      sets: data.active?.sets as SetFact[] | undefined,
      events: data.active?.setFeedbackEvents as SetFeedbackEvent[] | undefined,
    };
  });
  expect(recorded.sets).toHaveLength(1);
  expect(recorded.events?.map(event => event.effort)).toEqual(['too_light', 'right']);
  expect(
    recorded.events?.every(
      event => event.itemIndex === recorded.sets![0].itemIndex && event.setIndex === recorded.sets![0].setIndex,
    ),
  ).toBe(true);
  await page.locator('main[data-training-active]').getByRole('button', { name: '和芽芽聊聊', exact: true }).click();
  const locked = page.getByRole('dialog', { name: '芽芽', exact: true });
  await (await openQuickAdjust(page)).getByRole('button', { name: '换掉所选动作', exact: true }).click();
  await expect(locked.getByRole('alert')).toHaveText('这次没能生成调整，点重试');
  await expect(locked.locator('.assistant-attachment')).toHaveCount(0);
  await locked.getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/settings');
  await page.getByRole('button', { name: '备份恢复', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  const download = await pending,
    path = info.outputPath('engine-backup.json');
  await download.saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(namedValues(backup, 'birthYearMonth')).toContain('1991-06');
  expect(namedValues(backup, 'screening').length).toBeGreaterThan(0);
  expect(namedValues(backup, 'enginePlan').length).toBeGreaterThan(0);
  expect(
    namedValues(backup, 'setFeedbackEvents').some(value => JSON.stringify(value) === JSON.stringify(recorded.events)),
  ).toBe(true);
  expect(
    apiRequests.filter(
      path => !['/api/v1/features', '/api/v1/announcement', '/api/v1/trial/access-status'].includes(path),
    ),
  ).toEqual([]);
});

test('positive pain review blocks further training and survives the downloaded backup', async ({ page }, info) => {
  await localFeatures(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await screenAndDraft(page);
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await startToday(page);
  await expect(page).toHaveURL(/workout\//);
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  const before = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active;
  });
  await page.getByRole('button', { name: '不舒服', exact: true }).click();
  await page.getByRole('button', { name: '右膝', exact: true }).click();
  await expect(page.getByRole('button', { name: '右膝', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(page.getByText('右膝，有多不舒服？', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '6', exact: true }).click();
  await page.getByRole('button', { name: '记录', exact: true }).click();
  const no = page.getByRole('button', { name: '否', exact: true }),
    yes = page.getByRole('button', { name: '是', exact: true }),
    confirm = page.getByRole('button', { name: '确定', exact: true });
  // One red-flag question per screen.
  await expect(page.getByText('再确认几件事 · 1 / 7', { exact: true })).toBeVisible();
  await expect(no).toHaveCount(1);
  await expect(confirm).toBeDisabled();
  await expect(page.locator('.wk-complete')).toBeDisabled();
  await yes.click();
  for (let index = 1; index < 7; index++) await no.click();
  await expect(page.getByText('再确认几件事 · 7 / 7', { exact: true })).toBeVisible();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.locator('.wk-complete')).toBeDisabled();
  // A disabled training button also covers an in-flight save. Wait for the actual
  // safety transaction before navigating away, then still assert reload durability.
  await expect
    .poll(() =>
      page.evaluate(async id => {
        const path = '/src/persistence/repository.ts';
        return (await (await import(/* @vite-ignore */ path)).repository.db.v8Workouts.get(id))?.painReviewRequired;
      }, before.id),
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator('.wk-complete')).toBeDisabled();
  const after = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
    return { active: data.active, review: data.state.coachProfile?.screening?.redFlagReview };
  });
  expect(after.active.sets).toEqual(before.sets);
  expect(after.active.status).toBe(before.status);
  expect(after.active.plannedSetCount).toBe(before.plannedSetCount);
  expect(after.active.painReviewRequired).toBe(true);
  expect(after.active.painActions).toHaveLength(1);
  expect(Object.values(after.review.answers)).toContain(true);
  for (const width of [375, 1280, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: info.outputPath(`positive-pain-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.goto('/settings');
  await page.getByRole('button', { name: '备份恢复', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  const path = info.outputPath('positive-pain-backup.json');
  await (await pending).saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(namedValues(backup, 'painReviewRequired')).toContain(true);
  expect(
    namedValues(backup, 'painActions').some(
      value => JSON.stringify(value) === JSON.stringify(after.active.painActions),
    ),
  ).toBe(true);
  expect(
    namedValues(backup, 'redFlagReview').some(value => JSON.stringify(value) === JSON.stringify(after.review)),
  ).toBe(true);
  await page.goto(`/workout/${after.active.id}`);
  const attestation = page.getByRole('checkbox', { name: '我已就医，并已确认可以恢复运动', exact: true }),
    resume = page.getByRole('button', { name: '确定', exact: true });
  await expect(attestation).not.toBeChecked();
  await expect(resume).toBeDisabled();
  await attestation.check();
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = '/src/ui/mainline/context.tsx';
        return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active?.painReviewRequired;
      }),
    )
    .toBe(false);
  const recovered = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
    return { active: data.active, review: data.state.coachProfile?.screening?.redFlagReview };
  });
  expect(recovered.review.professionalSeenAt).toBeTruthy();
  expect(recovered.active.sets).toEqual(before.sets);
  expect(recovered.active.painActions).toEqual(after.active.painActions);
  expect(errors).toEqual([]);
});

// Seeded ended-workout recovery only; this is not evidence of plan-generation quality.
test('ended pain remains reviewable with the engine flag off and preserves completed facts', async ({ page }, info) => {
  await localFeatures(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/manual');
  await expect(page.getByRole('searchbox')).toBeVisible();
  const seeded = await page.evaluate(async () => {
    const paths = ['/src/persistence/repository.ts', '/src/application/v8-workflow.ts', '/src/catalog/exercise-ids.ts'];
    const [p, w, c] = await Promise.all(paths.map(path => import(/* @vite-ignore */ path)));
    const repo = p.repository,
      workflow = w.createV8Workflow(repo),
      at = new Date().toISOString();
    const record = await workflow.start(undefined, c.EXERCISE_IDS.bodyweightSquat);
    await workflow.recordSet(record.id, 0, 0, { reps: 8 });
    await repo.write(async () => {
      const state = await repo.db.v8State.get('v8'),
        row = await repo.db.v8Workouts.get(record.id);
      await repo.db.v8State.put({
        ...state,
        planDismissedAt: at,
        coachProfile: {
          goalText: 'synthetic ended-review fixture',
          weeklyTarget: 2,
          sessionMinutes: 30,
          scheduleOriginalText: 'fixture',
          place: 'home',
          equipment: ['none'],
          adultConfirmed: true,
          cautions: [],
          confirmedAt: at,
          healthStorageConsent: { acceptedAt: at },
          screening: {
            parqAllNo: true,
            knownCondition: false,
            symptoms: false,
            completedAt: at,
            parqAnswers: Array(7).fill(false),
          },
        },
      });
      await repo.db.v8Workouts.put({
        ...row,
        setFeedbackEvents: [
          {
            id: 'f2222222-2222-4222-8222-222222222222',
            exerciseId: row.sets[0].exerciseId,
            itemIndex: 0,
            setIndex: 0,
            createdAt: at,
            effort: 'discomfort',
            painScore: 4,
            painArea: 'knee',
          },
        ],
      });
    });
    await workflow.finish(record.id, { reasons: [] });
    return await repo.db.v8Workouts.get(record.id);
  });
  await page.unroute('**/api/v1/features');
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: false, aiAssistantV2: false, bodyProfile: false },
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
  for (const path of ['/settings/engine', '/']) {
    await page.goto(path);
    // Only the pain review's own 是/否 (settings/engine also shows PAR-Q+ tap answers).
    await expect(page.locator('.v9-pain-yesno').getByRole('button', { name: '否', exact: true })).toHaveCount(1);
    await expect(page.getByText('再确认几件事 · 1 / 7', { exact: true })).toBeVisible();
  }
  const rejected = await page.evaluate(async () => {
    const paths = ['/src/persistence/repository.ts', '/src/application/v8-workflow.ts', '/src/catalog/exercise-ids.ts'];
    const [p, w, c] = await Promise.all(paths.map(path => import(/* @vite-ignore */ path)));
    try {
      await w.createV8Workflow(p.repository).start(undefined, c.EXERCISE_IDS.selfResistedRow);
      return false;
    } catch (error) {
      return String(error).includes('PAIN_REVIEW_REQUIRED');
    }
  });
  expect(rejected).toBe(true);
  const no = page.getByRole('button', { name: '否', exact: true }),
    confirm = page.getByRole('button', { name: '确定', exact: true });
  await expect(confirm).toBeDisabled();
  for (let i = 0; i < 7; i++) await no.click();
  await expect(confirm).toBeEnabled();
  await no.click();
  await expect(confirm).toBeDisabled();
  await no.click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect
    .poll(() =>
      page.evaluate(async id => {
        const path = '/src/persistence/repository.ts';
        return (await (await import(/* @vite-ignore */ path)).repository.db.v8Workouts.get(id))?.painActions?.length;
      }, seeded.id),
    )
    .toBe(1);
  const after = await page.evaluate(async id => {
    const path = '/src/persistence/repository.ts';
    return (await import(/* @vite-ignore */ path)).repository.db.v8Workouts.get(id);
  }, seeded.id);
  expect(after.status).toBe(seeded.status);
  expect(after.sets).toEqual(seeded.sets);
  expect(after.plannedSetCount).toBe(seeded.plannedSetCount);
  expect(after.setFeedbackEvents).toEqual(seeded.setFeedbackEvents);
  expect(after.painActions[0].kind).toBe('review');
  expect(after.painActions[0].replacement).toBeUndefined();
  expect(after.painActions[0].excludedItemIndexes).toBeUndefined();
  for (const width of [375, 1280, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: info.outputPath(`ended-review-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('pre-training joint danger persists as a minimal pause until fresh screening and explicit medical recovery', async ({
  page,
}, info) => {
  page.setDefaultTimeout(10000);
  let enabled = false;
  const errors: string[] = [],
    modelAttempts: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-15T03:00:00.000Z'));
  await page.route('**/api/**', route => {
    if (/assistant|coach|chat|completion/i.test(new URL(route.request().url()).pathname))
      modelAttempts.push(route.request().url());
    return route.fulfill({ status: 503, json: { error: 'OFFLINE_SAFETY_TEST' } });
  });
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: enabled, aiAssistantV2: false, bodyProfile: false },
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } }),
  );
  // A normal flag-off basic plan supplies a saved profile; no engine-ready plan or database seed is needed.
  await startOnboarding(page);
  await answerTexts(page, ['保持健康，规律训练', '每周3次，每次30分钟', '在家，只有瑜伽垫']);
  await basicSafety(page);
  await generate(page);
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await page.goto('/manual');
  await page.getByRole('searchbox').fill('站姿自阻力划船');
  await page.getByRole('button', { name: '站姿自阻力划船', exact: true }).click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await page.getByRole('button', { name: '暂停或结束', exact: true }).click();
  await page.getByRole('button', { name: '结束并记下', exact: true }).click();
  await page.getByRole('button', { name: '记下来', exact: true }).click();
  const facts = await page.evaluate(async () => {
    const p = '/src/persistence/repository.ts';
    return (await import(/* @vite-ignore */ p)).repository.db.v8Workouts.toArray();
  });
  expect(facts).toHaveLength(1);
  expect(facts[0].sets).toHaveLength(1);
  enabled = true;
  await page.goto('/settings/engine');
  await page.reload();
  async function completeScreen() {
    await page.getByRole('checkbox', { name: /同意将运动前自查/ }).check();
    await fillBirthMonth(page, '1991-06');
    // PAR-Q+ answers are tap choices, one row per question.
    const fields = page.getByRole('group', { name: 'PAR-Q+', exact: true }).getByRole('group');
    await expect(fields).toHaveCount(20);
    for (let i = 0; i < 18; i++) await fields.nth(i).getByRole('button', { name: '否', exact: true }).click();
    await fields.nth(18).getByRole('button', { name: '是', exact: true }).click();
    await fields.nth(19).getByRole('button', { name: '已知低于 160/90 mmHg', exact: true }).click();
    await page.getByRole('combobox', { name: /孕期 \/ 产后状态/ }).selectOption('general');
    await page.getByRole('button', { name: '保存', exact: true }).click();
  }
  await completeScreen();
  await page.waitForURL('**/settings');
  await expect(page.getByRole('button', { name: /AI 助手芽芽.*还没开通/ })).toBeVisible();
  await page.goto('/manual');
  await page.clock.setFixedTime(new Date('2026-10-15T03:01:00.000Z'));
  const checkin = page.getByRole('region', { name: '练之前，看看状态', exact: true });
  if (!(await checkin.locator('details').evaluate(d => (d as HTMLDetailsElement).open)))
    await checkin.locator('summary').click();
  await checkin
    .getByRole('group', { name: '最近练后有没有哪里疼？', exact: true })
    .getByRole('button', { name: '有', exact: true })
    .click();
  await checkin.getByRole('button', { name: '新出现', exact: true }).click();
  await page.getByRole('button', { name: '右膝', exact: true }).click();
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByRole('radio', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  // The red-flag step comes after the soreness 是/否 chips.
  const no = checkin.getByRole('button', { name: '否', exact: true }).last(),
    yes = checkin.getByRole('button', { name: '是', exact: true }).last();
  await expect(page.getByText('再确认几件事 · 1 / 7', { exact: true })).toBeVisible();
  await yes.click();
  for (let i = 1; i < 7; i++) await no.click();
  await checkin.getByRole('button', { name: '确定', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const p = '/src/persistence/repository.ts';
        return (await (await import(/* @vite-ignore */ p)).repository.db.v8State.get('v8'))?.trainingPause;
      }),
    )
    .toEqual({ requiredAt: '2026-10-15T03:01:00.000Z' });
  enabled = false;
  await page.goto('/');
  await page.reload();
  await expect(homeStart(page)).toBeDisabled();
  await page.goto('/manual');
  await page.getByRole('searchbox').fill('站姿自阻力划船');
  await page.getByRole('button', { name: '站姿自阻力划船', exact: true }).click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page).toHaveURL(/manual/);
  const paused = await page.evaluate(async () => {
    const p = '/src/persistence/repository.ts',
      repo = (await import(/* @vite-ignore */ p)).repository;
    return { state: await repo.db.v8State.get('v8'), workouts: await repo.db.v8Workouts.toArray() };
  });
  expect(paused.workouts).toEqual(facts);
  expect(Object.keys(paused.state.trainingPause)).toEqual(['requiredAt']);
  await page.goto('/settings');
  await page.getByRole('button', { name: '备份恢复', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  const backupPath = info.outputPath('pre-training-minimal-pause.json');
  await (await pending).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.data.v8.state.trainingPause).toEqual(paused.state.trainingPause);
  expect(JSON.stringify(backup)).not.toContain('jointPain');
  expect(JSON.stringify(backup)).not.toContain('redFlagAnswers');
  for (const width of [375, 1280, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: info.outputPath(`pre-training-pause-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.goto('/settings/engine');
  await expect(page.getByRole('checkbox', { name: '我已就医，并已确认可以恢复运动', exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: /同意将运动前自查/ }).uncheck();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.waitForURL('**/settings');
  await expect(page.getByRole('button', { name: /AI 助手芽芽.*还没开通/ })).toBeVisible();
  await page.goto('/settings/engine');
  expect(
    await page.evaluate(async () => {
      const p = '/src/persistence/repository.ts';
      return (await (await import(/* @vite-ignore */ p)).repository.db.v8State.get('v8')).trainingPause;
    }),
  ).toEqual(paused.state.trainingPause);
  await page.clock.setFixedTime(new Date('2026-10-15T03:02:00.000Z'));
  await completeScreen();
  await page.waitForURL('**/settings');
  await expect(page.getByRole('button', { name: /AI 助手芽芽.*还没开通/ })).toBeVisible();
  await page.goto('/settings/engine');
  const attestation = page.getByRole('checkbox', { name: '我已就医，并已确认可以恢复运动', exact: true }),
    confirm = page.getByRole('button', { name: '确定', exact: true });
  await expect(attestation).not.toBeChecked();
  await expect(confirm).toBeDisabled();
  await attestation.check();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const p = '/src/persistence/repository.ts';
        return (await (await import(/* @vite-ignore */ p)).repository.db.v8State.get('v8'))?.trainingPause;
      }),
    )
    .toBeUndefined();
  const recovered = await page.evaluate(async () => {
    const p = '/src/persistence/repository.ts',
      repo = (await import(/* @vite-ignore */ p)).repository;
    return {
      state: await repo.db.v8State.get('v8'),
      workouts: await repo.db.v8Workouts.toArray(),
      temporary: await repo.db.trainingCheckins.toArray(),
    };
  });
  expect(recovered.state.trainingPause).toBeUndefined();
  expect(recovered.state.coachProfile.screening.parqAnswers).toEqual(Array(7).fill(false));
  expect(recovered.state.coachProfile.screening.completedAt).toBe('2026-10-15T03:02:00.000Z');
  expect(recovered.workouts).toEqual(facts);
  expect(recovered.temporary).toEqual([]);
  expect(modelAttempts).toEqual([]);
  expect(errors).toEqual([]);
});

test('home today_adjust intent from 芽芽 becomes a confirmable card for the next session', async ({ page }) => {
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: true, aiAssistantV2: true, bodyProfile: false },
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({
      json: {
        qualification: 'active',
        sessionValid: true,
        expiresAt: Date.now() + 3600000,
        aiEnabled: true,
        summaryAvailable: true,
      },
    }),
  );
  await page.clock.setFixedTime(new Date('2026-10-15T03:00:00.000Z'));
  const sent: { task?: string; engineProfile?: unknown; template?: { id: string } }[] = [];
  await page.route('**/api/v1/assistant/chat', async route => {
    sent.push(route.request().postDataJSON().context);
    const events = [
      { type: 'text_delta', delta: '我先整理一份可预览的调整' },
      { type: 'attachment_pending' },
      { type: 'engine_intent', version: 'fitness-engine-intent-v1', intent: { kind: 'today_adjust', minutes: 20 } },
      { type: 'done', success: true, usage: { inputTokens: 1, outputTokens: 1 }, promptVersion: 'test' },
    ];
    await route.fulfill({
      contentType: 'text/event-stream',
      body: events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join(''),
    });
  });
  await screenAndDraft(page, true);
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const before = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
    return { version: JSON.stringify(data.version), override: data.state.nextWorkoutOverride };
  });
  expect(before.override).toBeUndefined();
  const dialog = await openHomeCoach(page);
  await dialog.getByRole('textbox').fill('今天只有20分钟，帮我调一下今天的训练');
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(dialog.locator('.assistant-attachment')).toBeVisible();
  await expect(dialog.locator('.assistant-attachment')).toContainText('只调整这次训练');
  // Network payload stays health-scoped; the card is assembled from the local engine profile.
  expect(sent).toHaveLength(1);
  expect(sent[0].task).toBe('ADJUST_TODAY');
  expect(sent[0].engineProfile).toBeUndefined();
  // Nothing is written until the user confirms.
  const pending = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).state.nextWorkoutOverride;
  });
  expect(pending).toBeUndefined();
  await dialog.getByRole('button', { name: '应用建议', exact: true }).click();
  await expect(dialog.getByText('已应用', { exact: true })).toBeVisible();
  const after = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot();
    return { version: JSON.stringify(data.version), override: data.state.nextWorkoutOverride };
  });
  expect(after.version).toBe(before.version);
  expect(after.override?.template.estimatedMinutes).toBeLessThanOrEqual(22);
});
