import { fillBirthMonth } from './helpers/birth-month';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = '/tests/e2e/helpers/b-safety-seed.ts';
    return (await import(/* @vite-ignore */ path)).safetySnapshot();
  });
}
async function seed(page: Page, kind: 'pregnant' | 'postpartum' | 'general' | 'older' | 'power') {
  return page.evaluate(async kind => {
    const path = '/tests/e2e/helpers/b-safety-seed.ts';
    return (await import(/* @vite-ignore */ path)).seedSafety(kind);
  }, kind);
}
test.beforeEach(async ({ page, baseURL }) => {
  // Offline synthetic feature responses; all model endpoints are blocked locally.
  await page.route('**/api/**', route =>
    route.fulfill({ status: 403, json: { error: 'offline browser verification' } }),
  );
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: true, aiAssistantV2: false, bodyProfile: false },
        expiresAt: Date.parse('2026-10-17T12:00:00Z'),
      },
    }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } }),
  );
  await page.route(
    url => /^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL!).origin,
    route => route.abort(),
  );
  await page.clock.setFixedTime(new Date('2026-10-17T10:00:00Z'));
  await page.goto('/');
});
test('pregnancy stop persists through refresh, ends active session and preserves completed sets', async ({ page }) => {
  const seeded = await seed(page, 'pregnant');
  await page.goto('/workout/' + seeded.workoutId);
  await page.getByRole('button', { name: '身体不适？', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '阴道出血', exact: true }).click();
  await expect(page).toHaveURL(/workout\/recovery/);
  await page.reload();
  const after = await snapshot(page);
  expect(after.state.pregnancySafety.providerPause).toBeTruthy();
  expect(after.workouts[0].sets).toEqual(seeded.sets);
  expect(after.workouts[0].status).not.toBe('in_progress');
  const blocked = await page.evaluate(async exerciseId => {
    const p = '/src/ui/mainline/context.tsx',
      w = (await import(/* @vite-ignore */ p)).workflow;
    try {
      await w.start(undefined, exerciseId);
      return false;
    } catch {
      return true;
    }
  }, seeded.exerciseId);
  expect(blocked).toBe(true);
});
test('supine symptom is offered only for actual current supine exercise and persists position avoidance', async ({
  page,
}) => {
  const seeded = await seed(page, 'pregnant');
  await page.goto('/workout/' + seeded.workoutId);
  await page.getByRole('button', { name: '身体不适？', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '恶心', exact: true }).click();
  await expect.poll(async () => Boolean((await snapshot(page)).state.pregnancySafety?.supineAvoidSince)).toBe(true);
  await page.reload();
  const after = await snapshot(page);
  expect(after.workouts[0].sets).toEqual(seeded.sets);
  expect(after.state.pregnancySafety.supineAvoidSince).toBeTruthy();
});
test('postpartum regression and urgent stop persist after refresh without editing completed facts', async ({
  page,
}) => {
  const seeded = await seed(page, 'postpartum');
  await page.goto('/workout/' + seeded.workoutId);
  await page.getByText('出现以下情况请立即停止', { exact: true }).first().click();
  await page.getByRole('button', { name: '漏尿', exact: true }).click();
  await expect.poll(async () => Boolean((await snapshot(page)).state.postpartumSafety?.regression)).toBe(true);
  await page.getByRole('button', { name: '发烧', exact: true }).click();
  await expect(page).toHaveURL(/workout\/recovery/);
  await page.reload();
  const after = await snapshot(page);
  expect(after.state.postpartumSafety.urgentAt).toBeTruthy();
  expect(after.state.postpartumSafety.regression.phase).toBe(2);
  expect(after.workouts[0].sets).toEqual(seeded.sets);
  expect(after.workouts[0].status).not.toBe('in_progress');
});

test('legacy backup restores and exports through real IndexedDB without fabricating CMR answers', async ({ page }) => {
  const text = readFileSync(new URL('../fixtures/legacy-backups/v71-coach-plan.json', import.meta.url), 'utf8');
  const result = await page.evaluate(async text => {
    const rp = '/src/persistence/repository.ts',
      bp = '/src/application/backup.ts',
      pp = '/src/application/profile.ts';
    await (await import(/* @vite-ignore */ pp)).profileService.initialize('zh');
    const repo = (await import(/* @vite-ignore */ rp)).repository,
      service = (await import(/* @vite-ignore */ bp)).createBackupService(repo),
      valid = await service.validateBackup(new File([text], 'legacy.json', { type: 'application/json' }));
    await service.importBackup(valid, {
      backupExported: true,
      replacementConfirmed: true,
      expectedRevision: valid.expectedRevision,
    });
    const baselineText = await (await service.exportBackup()).text(),
      exported = JSON.parse(baselineText),
      before = JSON.stringify(exported.data);
    const rollbackInput = await service.validateBackup(
      new File([baselineText], 'roundtrip.json', { type: 'application/json' }),
    );
    const table = repo.db.planVersions,
      original = table.bulkAdd;
    let injected = false;
    table.bulkAdd = async function (...args: unknown[]) {
      await original.apply(table, args);
      throw Error('synthetic-mid-transaction-failure');
    };
    try {
      await service.importBackup(rollbackInput, {
        backupExported: true,
        replacementConfirmed: true,
        expectedRevision: rollbackInput.expectedRevision,
      });
    } catch (error) {
      injected = String(error).includes('synthetic-mid-transaction-failure');
    } finally {
      table.bulkAdd = original;
    }
    const rollback = JSON.parse(await (await service.exportBackup()).text());
    const rolledBack = injected && JSON.stringify(rollback.data) === before;
    for (let n = 0; n < 2; n++) {
      const again = await service.validateBackup(
        new File([baselineText], 'roundtrip.json', { type: 'application/json' }),
      );
      await service.importBackup(again, {
        backupExported: true,
        replacementConfirmed: true,
        expectedRevision: again.expectedRevision,
      });
    }
    const repeated = JSON.parse(await (await service.exportBackup()).text());
    return {
      rolledBack,
      repeatedFacts:
        JSON.stringify(repeated.data.sessions) === JSON.stringify(exported.data.sessions) &&
        JSON.stringify(repeated.data.sets) === JSON.stringify(exported.data.sets) &&
        JSON.stringify(repeated.data.v8.workouts) === JSON.stringify(exported.data.v8.workouts),
      sourcePlans: valid.envelope.data.plans.map((p: { id: string }) => p.id),
      plans: exported.data.plans.map((p: { id: string }) => p.id),
      sessions: exported.data.sessions.length,
      sourceSessions: valid.envelope.data.sessions.length,
      cmr: exported.data.v8?.state.coachProfile?.screening?.cmrSymptoms,
    };
  }, text);
  expect(result.plans).toEqual(result.sourcePlans);
  expect(result.sessions).toBe(result.sourceSessions);
  expect(result.cmr).toBeUndefined();
  expect(result.rolledBack).toBe(true);
  expect(result.repeatedFacts).toBe(true);
  await page.reload();
});

test('age45 advisory acknowledgement is bound to screening and a missing CMR answer stays unknown', async ({
  page,
}) => {
  const seeded = await seed(page, 'general');
  await page.evaluate(async id => {
    const path = '/src/ui/mainline/context.tsx';
    await (await import(/* @vite-ignore */ path)).workflow.finish(id, { reasons: [] });
  }, seeded.workoutId);
  await page.goto('/settings/engine');
  await fillBirthMonth(page, '1976-01');
  const ack = page.getByRole('checkbox', { name: /接下来的训练强度较高/ });
  await expect(ack).not.toBeChecked();
  await ack.check();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/settings$/);
  const s = await snapshot(page);
  expect(s.state.coachProfile.screening.age45AdvisoryAck.screenedAt).toBe(s.state.coachProfile.screening.completedAt);
  await page.goto('/settings/engine');
  const questions = page.getByRole('group', { name: 'PAR-Q+', exact: true }).getByRole('combobox');
  await expect(questions).toHaveCount(20);
  await page.evaluate(async () => {
    const path = '/src/persistence/repository.ts',
      r = (await import(/* @vite-ignore */ path)).repository,
      state = await r.db.v8State.get('v8'),
      keys = Object.keys(state.coachProfile.screening.cmrSymptoms);
    delete state.coachProfile.screening.cmrSymptoms[keys[0]];
    await r.write(async () => {
      await r.db.v8State.put(state);
    });
  });
  await page.reload();
  await expect(page.getByRole('group', { name: 'PAR-Q+', exact: true }).getByRole('combobox').nth(8)).toHaveValue('');
});
test('unknown 1RM power uses relative source load text and no kilogram target in actual workout UI', async ({
  page,
}) => {
  const seeded = await seed(page, 'power');
  await page.goto('/workout/' + seeded.workoutId);
  const s = await snapshot(page),
    item = s.workouts[0].templateSnapshot.items[0];
  expect(item.target.metricType).toBe('reps');
  expect(item.target.loadGrams).toBeUndefined();
  await expect(page.getByText(item.prescription.loadDescription.zh, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('0 公斤', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).workouts[0].sets.length).toBe(1);
  expect((await snapshot(page)).workouts[0].sets[0].loadGrams).toBeUndefined();
});
test('older fall ends training and no-injury answers retain source stage one supported action', async ({ page }) => {
  const seeded = await seed(page, 'older');
  await page.goto('/workout/' + seeded.workoutId);
  await page.getByRole('button', { name: '身体不适？', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '训练中摔倒了', exact: true }).click();
  await expect(page).toHaveURL(/workout\/recovery/);
  await page.getByRole('combobox', { name: '摔倒时是否撞到了头？', exact: true }).selectOption('no');
  await page.getByRole('combobox', { name: '腿是否不能承重？', exact: true }).selectOption('no');
  await page.getByRole('button', { name: '确定', exact: true }).first().click();
  await expect.poll(async () => Boolean((await snapshot(page)).state.olderSafety?.reviewRequiredAt)).toBe(false);
  await page.reload();
  const s = await snapshot(page);
  expect(s.state.olderSafety.balanceStage).toBe(1);
  expect(s.workouts[0].sets).toEqual(seeded.sets);
  expect(seeded.slug).toBe('custom-supported-wide-static-stand');
});
