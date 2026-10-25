import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createPlanUpgradeStore } from '../../src/persistence/plan-upgrade-store';
import { createProfileService } from '../../src/application/profile';
import { createBackupService, validateBackupEnvelope } from '../../src/application/backup';

// 新手 4 周 and 稳健 (Bo 2026-10-25): new optional fields only; no database or backup version change.
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/legacy-backups/${name}`, import.meta.url), 'utf8'));

async function freshService() {
  const db = createDatabase(`starter-${crypto.randomUUID()}`),
    repo = createRepository(db);
  await createProfileService(repo).initialize('zh');
  return { db, repo, store: createPlanUpgradeStore(repo), backup: createBackupService(repo) };
}
async function restore(service: Awaited<ReturnType<typeof freshService>>, envelope: unknown) {
  const file = new File([JSON.stringify(envelope)], 'backup.json', { type: 'application/json' });
  const validated = await service.backup.validateBackup(file);
  await service.backup.importBackup(validated, {
    backupExported: true,
    replacementConfirmed: true,
    expectedRevision: validated.expectedRevision,
  });
}
async function withPlan() {
  const service = await freshService();
  await restore(service, fixture('v8-main-pre-engine.json'));
  const planId = (await service.db.v8State.get('v8'))!.currentPlanId!;
  const current = async () => {
    const plan = (await service.db.v8Plans.get(planId))!;
    return (await service.db.v8PlanVersions.get(plan.currentVersionId))!;
  };
  return { ...service, planId, current };
}

describe('新手 4 周 plan field', () => {
  it('starts and leaves the program as new versions and never edits the previous one', async () => {
    const { store, db, planId, current } = await withPlan();
    const before = await current(),
      count = await db.v8PlanVersions.count();
    expect(before.starterProgram).toBeUndefined();
    await store.setStarterProgram(planId, '2026-10-26', '开始新手 4 周');
    const started = await current();
    expect(started).toMatchObject({
      versionNumber: before.versionNumber + 1,
      basedOnVersionId: before.id,
      starterProgram: { id: 'starter-4w', startDate: '2026-10-26' },
      templates: before.templates,
      changeSummary: ['开始新手 4 周'],
    });
    expect(await db.v8PlanVersions.get(before.id)).toEqual(before);
    // Same start again changes nothing.
    await store.setStarterProgram(planId, '2026-10-26', '开始新手 4 周');
    expect(await db.v8PlanVersions.count()).toBe(count + 1);
    await store.setStarterProgram(planId, undefined, '退出新手 4 周');
    const left = await current();
    expect(left).not.toHaveProperty('starterProgram');
    expect(left.templates).toEqual(before.templates);
    expect(await db.v8PlanVersions.get(started.id)).toEqual(started);
    await expect(store.setStarterProgram(planId, '2026-02-30', 'x')).rejects.toThrow();
  });

  it('is only for by-day plans: a weekly budget drops it and refuses a new start', async () => {
    const { store, planId, current } = await withPlan();
    await store.setStarterProgram(planId, '2026-10-26', '开始');
    await store.setWeeklyBudget(planId, { mode: 'by-day' });
    expect((await current()).starterProgram).toEqual({ id: 'starter-4w', startDate: '2026-10-26' });
    await store.setWeeklyBudget(planId, { mode: 'budget', minutesPerWeek: 90 });
    expect(await current()).not.toHaveProperty('starterProgram');
    await expect(store.setStarterProgram(planId, '2026-10-27', '开始')).rejects.toThrow('PLAN_NOT_BY_DAY');
  });

  it('round-trips the program and the 稳健 route through backup; old backup versions cannot carry them', async () => {
    const source = await withPlan();
    await source.store.setStarterProgram(source.planId, '2026-10-26', '开始新手 4 周');
    const state = (await source.db.v8State.get('v8'))!;
    await source.db.v8State.put({ ...state, coachProfile: { ...state.coachProfile!, route: 'steady' } });
    const exported = JSON.parse(await (await source.backup.exportBackup()).text());
    const target = await freshService();
    await restore(target, exported);
    const plan = (await target.db.v8Plans.get(source.planId))!;
    expect((await target.db.v8PlanVersions.get(plan.currentVersionId))!.starterProgram).toEqual({
      id: 'starter-4w',
      startDate: '2026-10-26',
    });
    expect((await target.db.v8State.get('v8'))!.coachProfile!.route).toBe('steady');
    expect(() =>
      validateBackupEnvelope({
        ...exported,
        schemaVersion: 18,
        data: { ...exported.data, fitnessTests: undefined, journeys: undefined, futureLetters: undefined },
      }),
    ).toThrow();
    // Restoring the same file twice gives the same library (nothing is rewritten on import).
    const again = await freshService();
    await restore(again, exported);
    await restore(again, exported);
    expect(await again.db.v8PlanVersions.toArray()).toEqual(await target.db.v8PlanVersions.toArray());
    for (const service of [source, target, again]) {
      service.db.close();
      await Dexie.delete(service.db.name);
    }
  });
});
