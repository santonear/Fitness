// Browser-only fixtures. The application does not import this module.
import Dexie from 'dexie';
import { createDatabase, database } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createBodyWeightService } from '../../../src/application/body-weight';

function closeTestConnections(name: string): void {
  const connections = (Dexie as unknown as { connections: Dexie[] }).connections;
  for (const connection of [...connections]) {
    if (connection.name === name) connection.close();
  }
}

export async function exerciseConcurrency(name: string) {
  const db = createDatabase(name);
  try {
    const repo = createRepository(db);
    const profiles = createProfileService(repo);
    const weights = createBodyWeightService(repo);
    const initialized = await Promise.all([profiles.initialize('en'), profiles.initialize('zh')]);
    const initial = initialized[0];
    const input = { locale: 'en' as const, timeZone: 'Asia/Shanghai', units: 'metric' as const };
    const results = await Promise.allSettled([profiles.saveProfile(input, initial.revision), profiles.saveProfile(input, initial.revision)]);
    await weights.saveBodyWeight({ localDate: '2026-09-01', timeZone: 'Asia/Shanghai', weightGrams: 70200 });
    const before = await repo.readMetadata();
    const currentProfile = (await profiles.getProfile())!;
    const illegalIdentity = await profiles.saveProfile({ ...input, id: crypto.randomUUID() } as typeof input, currentProfile.revision)
      .then(() => 'accepted', error => error.code);
    await repo.write(async () => { await db.bodyWeights.clear(); throw new Error('abort'); }).catch(() => {});
    return await db.transaction('r', db.tables, async () => ({
      profileCount: await db.profiles.count(), fulfilled: results.filter(r => r.status === 'fulfilled').length,
      codes: results.filter(r => r.status === 'rejected').map(r => (r.reason as {code:string}).code),
      before: before.dataRevision, after: (await repo.readMetadata()).dataRevision, weights: await db.bodyWeights.count(),
      illegalIdentity,
    }));
  } finally { db.close(); closeTestConnections(name); await Dexie.delete(name); }
}

export async function exerciseUpgrade(name: string) {
  const handles: Dexie[] = [];
  function tracked<T extends Dexie>(db: T): T { handles.push(db); return db; }
  try {
    const old = tracked(new Dexie(name));
    old.version(1).stores({ profiles: 'id', bodyWeights: 'id,localDate', metadata: 'localProfileId' });
    await old.open();
    await old.transaction('rw', old.tables, async () => {
      await old.table('metadata').add({ localProfileId: '00000000-0000-4000-8000-000000000001', schemaVersion: 1, catalogVersion: 1, revision: 4 });
      await old.table('bodyWeights').add({ id: 'legacy-weight', localDate: '2026-08-01', weightGrams: 65000, timeZone: 'Asia/Shanghai', revision: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' });
    });
    old.close();
    const upgraded = tracked(createDatabase(name));
    await upgraded.open();
    const { kept, upgradedRevision } = await upgraded.transaction('r', upgraded.tables, async () => ({
      kept: await upgraded.bodyWeights.get('legacy-weight'),
      upgradedRevision: (await upgraded.metadata.toCollection().first())?.dataRevision,
    }));
    upgraded.close();
    const failed = tracked(createDatabase(name));
    failed.version(4).stores({ bodyWeights: 'id,localDate' }).upgrade(async tx => {
      await tx.table('bodyWeights').clear(); throw new Error('migration failed');
    });
    const rejected = await failed.open().then(() => false, () => true);
    failed.close();
    const reopened = tracked(createDatabase(name));
    await reopened.open();
    return await reopened.transaction('r', reopened.tables, async () => {
      const intact = await reopened.bodyWeights.get('legacy-weight');
      return { kept: kept?.weightGrams, rejected, intact: intact?.weightGrams, upgradedRevision };
    });
  } finally {
    for (const handle of handles) handle.close();
    closeTestConnections(name);
    await Dexie.delete(name);
  }
}

export function rejectWeightWriteForQuota() {
  database.bodyWeights.hook('creating', () => { throw new DOMException('Test disk quota exhausted', 'QuotaExceededError'); });
}
export async function persistedLocale() { return (await database.profiles.toCollection().first())?.locale; }
