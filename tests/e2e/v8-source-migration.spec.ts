import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
const source = JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/followup-preview-v9.json', import.meta.url), 'utf8'));

for (const fail of [false, true]) test(`database 9 to current ${fail ? 'failure rolls back every table' : 'preserves all old facts and repeated opening is idempotent'}`, async ({ page }) => {
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
  const result = await page.evaluate(async ({ source, fail }) => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { Dexie } = await load('/tests/e2e/helpers/cal-browser.ts');
    const { createDatabase } = await load('/src/persistence/db.ts');
    const template = createDatabase(`schema-${crypto.randomUUID()}`); await template.open();
    const stores = Object.fromEntries(template.tables.map((table: any) => [table.name, [table.schema.primKey.src, ...table.schema.indexes.map((index: any) => index.src)].join(',')]));
    template.close(); await template.delete();
    const name = `source-upgrade-${crypto.randomUUID()}`; const old = new Dexie(name); old.version(9).stores(stores); await old.open();
    const mapping: Record<string,string> = { v8Plans:'plans', v8PlanVersions:'planVersions', v8Workouts:'workouts', v8Activities:'activities', v8State:'state' };
    for (const table of old.tables) {
      const value = mapping[table.name] ? source.data.v8[mapping[table.name]] : source.data[table.name];
      if (value !== undefined) await table.bulkAdd(Array.isArray(value) ? value : [value]);
    }
    const snapshot = (db: any, omitMetadata = false) => db.transaction('r', db.tables, async () => JSON.stringify(await Promise.all(db.tables.filter((table: any) => !omitMetadata || table.name !== 'metadata').sort((a: any,b: any) => a.name.localeCompare(b.name)).map(async (table: any) => [table.name, await table.toArray()]))));
    const before = await snapshot(old); const facts = await snapshot(old, true); old.close();
    const current = createDatabase(name);
    try {
      if (fail) current.metadata.hook('updating', () => { throw Error('injected source upgrade failure'); });
      const rejected = await current.open().then(() => false, () => true);
      if (fail) {
        current.close(); const inspect = new Dexie(name); await inspect.open();
        const result = { rejected, unchanged: before === await snapshot(inspect), version: inspect.verno, metadata: (await inspect.table('metadata').toCollection().first()).schemaVersion };
        inspect.close(); return result;
      }
      const after = await snapshot(current); current.close(); await current.open();
      return { rejected, unchanged: facts === await snapshot(current, true), idempotent: after === await snapshot(current), version: current.verno, metadata: (await current.metadata.toCollection().first()).schemaVersion, noInferredSource: (await current.v8PlanVersions.toArray()).every((version: any) => !('source' in version)) };
    } finally { current.close(); await current.delete(); }
  }, { source, fail });
  expect(result).toEqual(fail ? { rejected: true, unchanged: true, version: 9, metadata: 9 } : { rejected: false, unchanged: true, idempotent: true, version: 11, metadata: 11, noInferredSource: true });
});

test('optional local and AI sources round-trip without rewriting old records; failed restore is atomic', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
  const result = await page.evaluate(async source => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { createDatabase } = await load('/src/persistence/db.ts'); const { createRepository } = await load('/src/persistence/repository.ts');
    const { createProfileService } = await load('/src/application/profile.ts'); const { createBackupService } = await load('/src/application/backup.ts');
    const db = createDatabase(`source-restore-${crypto.randomUUID()}`); const repo = createRepository(db); const backup = createBackupService(repo);
    try {
      await createProfileService(repo).initialize('en');
      const restore = async (value: any) => { const valid = await backup.validateBackup(new File([JSON.stringify(value)], 'source.json')); await backup.importBackup(valid, { backupExported: true, replacementConfirmed: true, expectedRevision: valid.expectedRevision }); };
      const snapshot = () => db.transaction('r', db.tables, async () => JSON.stringify(await Promise.all(db.tables.map(async (table: any) => [table.name, await table.toArray()]))));
      const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
      const results = [];
      for (const origin of [undefined, 'local', 'ai']) {
        const envelope = structuredClone(source); envelope.schemaVersion = 8; envelope.data.metadata.schemaVersion = 10;
        if (origin) envelope.data.v8.planVersions[0].source = origin;
        await restore(envelope); const exported = JSON.parse(await (await backup.exportBackup()).text());
        await restore(exported); const again = JSON.parse(await (await backup.exportBackup()).text());
        results.push({ origin: again.data.v8.planVersions[0].source ?? null, same: JSON.stringify(canonical(envelope.data.v8)) === JSON.stringify(canonical(again.data.v8)), version: exported.schemaVersion, metadata: exported.data.metadata.schemaVersion });
      }
      const before = await snapshot(); const reject = () => { throw Error('injected restore failure'); }; db.v8PlanVersions.hook('creating', reject);
      const failed = await restore(source).then(() => false, () => true); db.v8PlanVersions.hook('creating').unsubscribe(reject);
      const rolledBack = before === await snapshot();
      const invalid = structuredClone(source); invalid.schemaVersion = 8; invalid.data.metadata.schemaVersion = 10; invalid.data.v8.planVersions[0].source = 'inferred';
      const invalidRejected = await restore(invalid).then(() => false, () => true);
      return { results, failed, rolledBack, invalidRejected, invalidUnchanged: before === await snapshot() };
    } finally { db.close(); await db.delete(); }
  }, source);
  expect(result).toEqual({ results: [null,'local','ai'].map(origin => ({ origin, same: true, version: 9, metadata: 11 })), failed: true, rolledBack: true, invalidRejected: true, invalidUnchanged: true });
});
