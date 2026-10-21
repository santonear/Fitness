import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createPlanUpgradeStore } from '../../src/persistence/plan-upgrade-store';
import { createProfileService } from '../../src/application/profile';
import { createBackupService, validateBackupEnvelope } from '../../src/application/backup';
import { BACKUP_VERSION, DATABASE_VERSION, SUPPORTED_BACKUP_VERSIONS } from '../../src/domain/storage-version';

// UIUX20261008 V9.14: one additive upgrade DB 20 → 21 plus backup 18 → 19.
const directory = new URL('../fixtures/legacy-backups/', import.meta.url);
const fixture = (name: string) => JSON.parse(readFileSync(new URL(name, directory), 'utf8'));
const newTables = ['fitnessTests', 'journeys', 'futureLetters'];

async function freshService() {
  const db = createDatabase(`plan-upgrade-${crypto.randomUUID()}`), repo = createRepository(db);
  await createProfileService(repo).initialize('zh');
  return { db, repo, store: createPlanUpgradeStore(repo), backup: createBackupService(repo) };
}
async function restore(service: Awaited<ReturnType<typeof freshService>>, envelope: unknown) {
  const file = new File([JSON.stringify(envelope)], 'backup.json', { type: 'application/json' });
  const validated = await service.backup.validateBackup(file);
  await service.backup.importBackup(validated, { backupExported: true, replacementConfirmed: true, expectedRevision: validated.expectedRevision });
}
async function dump(db: Dexie, skip: string[] = []) {
  return Object.fromEntries(await Promise.all(db.tables.filter(table => !skip.includes(table.name)).map(async table => [table.name, await table.toArray()] as const)));
}

/** Seeds a real export into a DB 20 store layout, then opens it with the current model. */
async function upgradeFromV20(rows: Record<string, unknown[]>, fail = false) {
  const name = `plan-upgrade-${crypto.randomUUID()}`, model = createDatabase(name);
  const stores = Object.fromEntries(model.tables.filter(table => !newTables.includes(table.name))
    .map(table => [table.name, [table.schema.primKey.src, ...table.schema.indexes.map(index => index.src)].join(',')]));
  const old = new Dexie(name); old.version(20).stores(stores); await old.open();
  for (const table of old.tables) if (rows[table.name]?.length) await table.bulkAdd(rows[table.name]);
  const before = await dump(old); old.close();
  if (fail) model.metadata.hook('updating', () => { throw Error('injected upgrade failure'); });
  let rejected = false;
  try { await model.open(); } catch { rejected = true; }
  model.close();
  if (fail) { await old.open(); const after = await dump(old); const version = old.verno; old.close(); await Dexie.delete(name); return { rejected, before, after, version }; }
  await model.open();
  const after = await dump(model);
  const version = model.verno; model.close(); await Dexie.delete(name);
  return { rejected, before, after, version };
}
function v20Rows() {
  const source = fixture('v8-main-pre-engine.json'), data = source.data;
  return {
    ...data,
    metadata: [{ ...data.metadata, schemaVersion: 20, assistantScheduleRecoveryV2At: '2026-10-20T00:00:00.000Z' }],
    trainingMemo: [data.trainingMemo], v8State: [data.v8.state], v8Plans: data.v8.plans, v8PlanVersions: data.v8.planVersions,
    v8Workouts: data.v8.workouts, v8Activities: data.v8.activities, v8PlanReferences: data.v8.planReferences ?? [],
  } as Record<string, unknown[]>;
}

describe('DB 21 plan upgrade (V9.14)', () => {
  it('bumps versions by one step and keeps every older backup version restorable', () => {
    expect(DATABASE_VERSION).toBe(21);
    expect(BACKUP_VERSION).toBe(19);
    expect(SUPPORTED_BACKUP_VERSIONS).toEqual(Array.from({ length: 18 }, (_, i) => i + 2));
  });

  it('upgrades a real v20 library additively and idempotently (run twice)', async () => {
    const first = await upgradeFromV20(v20Rows());
    expect(first.rejected).toBe(false);
    expect(first.version).toBe(21);
    expect(first.before.v8PlanVersions.length).toBeGreaterThan(0);
    expect(first.before.bodyWeights.length).toBeGreaterThan(0);
    for (const table of newTables) expect(first.after[table]).toEqual([]);
    const { metadata: beforeMeta, ...beforeRest } = first.before, { metadata: afterMeta, ...afterRest } = first.after;
    for (const [table, rows] of Object.entries(beforeRest)) expect(afterRest[table], table).toEqual(rows);
    expect(afterMeta).toEqual([{ ...(beforeMeta[0] as object), schemaVersion: 21 }]);
    // Running the upgrade again over its own result changes nothing.
    const rerun = Object.fromEntries(Object.entries(first.after).filter(([table]) => !newTables.includes(table))) as Record<string, unknown[]>;
    const second = await upgradeFromV20(rerun);
    expect(second.after).toEqual(first.after);
  });

  it('leaves the v20 library untouched when the upgrade fails', async () => {
    const result = await upgradeFromV20(v20Rows(), true);
    expect(result.rejected).toBe(true);
    expect(result.version).toBe(20);
    expect(result.after).toEqual(result.before);
  });

  it('restores every real legacy backup sample into DB 21 with empty new tables', async () => {
    const files = readdirSync(directory).filter(name => name.endsWith('.json') && !name.includes('manifest'));
    expect(files.length).toBeGreaterThan(10);
    for (const name of files) {
      const service = await freshService(), source = fixture(name), before = JSON.stringify(source);
      await restore(service, source);
      expect(JSON.stringify(source), name).toBe(before);
      expect((await service.repo.readMetadata()).schemaVersion).toBe(DATABASE_VERSION);
      for (const table of newTables) expect(await service.db.table(table).count(), name).toBe(0);
      expect(await service.store.homePanelStyle(), name).toBe('hero');
      const again = JSON.parse(await (await service.backup.exportBackup()).text());
      expect(again.schemaVersion).toBe(BACKUP_VERSION);
      expect(validateBackupEnvelope(again).data.sessions, name).toEqual(validateBackupEnvelope(source).data.sessions);
      service.db.close(); await Dexie.delete(service.db.name);
    }
  }, 120_000);

  it('defaults the home panel to hero and stores a choice additively', async () => {
    const { store, db } = await freshService();
    expect(await store.homePanelStyle()).toBe('hero');
    const before = await db.v8State.get('v8');
    await store.setHomePanelStyle('ring');
    expect(await store.homePanelStyle()).toBe('ring');
    expect(await db.v8State.get('v8')).toEqual({ ...before, homePanelStyle: 'ring' });
  });

  it('setWeeklyBudget creates a new plan version and never edits the previous one', async () => {
    const service = await freshService(), { store, db } = service;
    await restore(service, fixture('v8-main-pre-engine.json'));
    const planId = (await db.v8State.get('v8'))!.currentPlanId!;
    const plan = (await db.v8Plans.get(planId))!, previous = (await db.v8PlanVersions.get(plan.currentVersionId))!;
    expect(await store.weeklyBudget(planId)).toBeUndefined();
    const count = await db.v8PlanVersions.count();
    await store.setWeeklyBudget(planId, { mode: 'budget', minutesPerWeek: 120 });
    const updated = (await db.v8Plans.get(planId))!, created = (await db.v8PlanVersions.get(updated.currentVersionId))!;
    expect(await db.v8PlanVersions.count()).toBe(count + 1);
    expect(await db.v8PlanVersions.get(previous.id)).toEqual(previous);
    expect(created).toMatchObject({ versionNumber: previous.versionNumber + 1, basedOnVersionId: previous.id, weeklyBudget: { mode: 'budget', minutesPerWeek: 120 }, templates: previous.templates });
    expect(await store.weeklyBudget(planId)).toEqual({ mode: 'budget', minutesPerWeek: 120 });
    await store.setWeeklyBudget(planId, { mode: 'budget', minutesPerWeek: 120 });
    expect(await db.v8PlanVersions.count()).toBe(count + 1);
    await expect(store.setWeeklyBudget(planId, { mode: 'budget', minutesPerWeek: -1 })).rejects.toThrow();
  });

  it('keeps fitness tests read-only and journeys versioned', async () => {
    const { store, db } = await freshService();
    const test = (await store.addFitnessTest({ localDate: '2026-10-21', results: { pushup: 12, sitAndReachCm: 8.5 } }))!;
    await expect(db.fitnessTests.put({ ...test, results: { pushup: 99 } })).rejects.toThrow();
    expect(await store.listFitnessTests()).toEqual([test]);
    await expect(store.addFitnessTest({ localDate: '2026-10-21', results: {} })).rejects.toThrow();
    const camps = [{ id: 'c1', title: '第一营地', metric: 'pushup' as const, start: 12, target: 20 }];
    const v1 = (await store.saveJourneyVersion({ route: 'health', destination: '爬山不喘', camps }))!;
    const v2 = (await store.saveJourneyVersion({ route: 'shape', secondaryRoute: 'health', destination: '更有力气', camps }))!;
    expect([v1.version, v2.version]).toEqual([1, 2]);
    expect(await store.currentJourney()).toEqual(v2);
    expect(await db.journeys.get(v1.id)).toEqual(v1);
  });

  it('round-trips the new tables and optional fields through backup', async () => {
    const source = await freshService(), { store } = source;
    await restore(source, fixture('v8-main-pre-engine.json'));
    const planId = (await source.db.v8State.get('v8'))!.currentPlanId!;
    await store.addFitnessTest({ localDate: '2026-10-20', results: { chairStand30s: 15 } });
    await store.saveJourneyVersion({ route: 'postpartum', destination: '抱娃不累', camps: [{ id: 'c1', title: '营地', metric: 'sessions', start: 0, target: 8 }] });
    const letter = (await store.saveFutureLetter('  给到达第一营地的自己  ', 'c1'))!;
    expect(letter.text).toBe('给到达第一营地的自己');
    await store.markLetterOpened(letter.id);
    const opened = (await source.db.futureLetters.get(letter.id))!;
    await store.markLetterOpened(letter.id);
    expect(await source.db.futureLetters.get(letter.id)).toEqual(opened);
    await store.setHomePanelStyle('twin');
    await store.setWeeklyBudget(planId, { mode: 'budget', setsPerGroupPerWeek: 10 });
    const exported = JSON.parse(await (await source.backup.exportBackup()).text());
    expect(exported.schemaVersion).toBe(19);
    const target = await freshService();
    await restore(target, exported);
    const skip = ['metadata', 'profiles', 'coachDevice', 'trainingMemo'];
    expect(await dump(target.db, skip)).toEqual(await dump(source.db, skip));
    expect(await target.store.homePanelStyle()).toBe('twin');
    expect(await target.store.weeklyBudget(planId)).toEqual({ mode: 'budget', setsPerGroupPerWeek: 10 });
    // Older envelopes may not carry the new data; letters must point at a saved camp.
    expect(() => validateBackupEnvelope({ ...exported, schemaVersion: 18, data: { ...exported.data, metadata: { ...exported.data.metadata, schemaVersion: 20 } } })).toThrow();
    expect(exported.data.fitnessTests).toHaveLength(1);
    const letters = exported.data.futureLetters.map((row: object) => ({ ...row, openAtCampId: 'missing' }));
    expect(() => validateBackupEnvelope({ ...exported, data: { ...exported.data, futureLetters: letters } })).toThrow();
  });
});
