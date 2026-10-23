import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createPlanUpgradeStore } from '../../src/persistence/plan-upgrade-store';
import { createProfileService } from '../../src/application/profile';
import { createBackupService } from '../../src/application/backup';
import { renumberDuplicateVersions } from '../../src/persistence/plan-version-numbers';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/legacy-backups/${name}`, import.meta.url), 'utf8'));
const row = (id: string, planId: string, versionNumber: number, createdAt: string) => ({
  id,
  planId,
  versionNumber,
  createdAt,
});

async function restoredService(name = `plan-numbers-${crypto.randomUUID()}`) {
  const db = createDatabase(name),
    repo = createRepository(db);
  await createProfileService(repo).initialize('zh');
  const backup = createBackupService(repo);
  const file = new File([JSON.stringify(fixture('v8-main-pre-engine.json'))], 'backup.json');
  const validated = await backup.validateBackup(file);
  await backup.importBackup(validated, {
    backupExported: true,
    replacementConfirmed: true,
    expectedRevision: validated.expectedRevision,
  });
  const planId = (await db.v8State.get('v8'))!.currentPlanId!;
  return { db, repo, backup, store: createPlanUpgradeStore(repo), planId };
}

describe('renumberDuplicateVersions', () => {
  it('moves only later-created duplicates to the next free numbers and is idempotent', () => {
    const rows = [
      row('a1', 'a', 1, '2026-10-01T00:00:00Z'),
      row('a2', 'a', 2, '2026-10-02T00:00:00Z'),
      row('a2b', 'a', 2, '2026-10-03T00:00:00Z'),
      row('a2c', 'a', 2, '2026-10-04T00:00:00Z'),
      row('b1', 'b', 1, '2026-10-01T00:00:00Z'),
      row('b2', 'b', 2, '2026-10-02T00:00:00Z'),
    ];
    const changed = renumberDuplicateVersions(rows);
    expect(changed.map(r => [r.id, r.versionNumber])).toEqual([
      ['a2b', 3],
      ['a2c', 4],
    ]);
    const repaired = rows.map(r => changed.find(c => c.id === r.id) ?? r);
    expect(renumberDuplicateVersions(repaired)).toEqual([]);
    expect(renumberDuplicateVersions([])).toEqual([]);
  });
});

describe('plan version numbers after undo', () => {
  it('numbers the next edit after the highest existing number, so backup export keeps working', async () => {
    const { db, backup, store, planId } = await restoredService();
    const original = (await db.v8Plans.get(planId))!.currentVersionId;
    const base = (await db.v8PlanVersions.get(original))!.versionNumber;
    await store.setWeeklyBudget(planId, { mode: 'budget', minutesPerWeek: 120 });
    // Undo only moves the current pointer back.
    await db.v8Plans.update(planId, { currentVersionId: original });
    await store.setWeeklyBudget(planId, { mode: 'budget', minutesPerWeek: 90 });
    const current = (await db.v8PlanVersions.get((await db.v8Plans.get(planId))!.currentVersionId))!;
    expect(current.versionNumber).toBe(base + 2);
    await expect(backup.exportBackup()).resolves.toBeInstanceOf(Blob);
    db.close();
    await Dexie.delete(db.name);
  });

  it('repairs duplicates already stored locally when the database opens, leaving other rows unchanged', async () => {
    const name = `plan-numbers-${crypto.randomUUID()}`;
    const { db, backup, store, planId } = await restoredService(name);
    const original = (await db.v8Plans.get(planId))!.currentVersionId;
    const base = (await db.v8PlanVersions.get(original))!.versionNumber;
    await store.setWeeklyBudget(planId, { mode: 'budget', minutesPerWeek: 120 });
    const later = (await db.v8Plans.get(planId))!.currentVersionId;
    // Simulate the old "current + 1" bug: a later-created version shares its predecessor's number.
    await db.v8PlanVersions.update(later, { versionNumber: base });
    await expect(backup.exportBackup()).rejects.toThrow(/Duplicate V8 version number/);
    const before = await db.v8PlanVersions.toArray();
    db.close();

    const reopened = createDatabase(name);
    await reopened.open();
    const after = await reopened.v8PlanVersions.toArray();
    for (const version of after)
      expect(version).toEqual({
        ...before.find(v => v.id === version.id),
        ...(version.id === later ? { versionNumber: base + 1 } : {}),
      });
    expect(after.find(v => v.id === original)!.versionNumber).toBe(base);
    await expect(createBackupService(createRepository(reopened)).exportBackup()).resolves.toBeInstanceOf(Blob);
    reopened.close();

    const again = createDatabase(name);
    await again.open();
    expect(await again.v8PlanVersions.toArray()).toEqual(after);
    again.close();
    await Dexie.delete(name);
  });
});
