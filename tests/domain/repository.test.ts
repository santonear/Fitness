import { expect, it } from 'vitest';
import { createRepository } from '../../src/persistence/repository';
import type { FitnessDatabase } from '../../src/persistence/db';

it('rejects a queued old-generation write even after the repository adopts restored data', async () => {
  let row = { localProfileId: 'profile', schemaVersion: 3, catalogVersion: 1, revision: 1, dataRevision: 1, restoreGeneration: 0 };
  let execute: (() => Promise<unknown>) | undefined;
  const db = {
    tables: [], metadata: { toCollection: () => ({ first: async () => row }), put: async (next: typeof row) => { row = next; } },
    transaction: (_mode: string, _tables: unknown, callback: () => Promise<unknown>) => new Promise((resolve, reject) => {
      execute = async () => { try { resolve(await callback()); } catch (error) { reject(error); } };
    }),
  } as unknown as FitnessDatabase;
  const repository = createRepository(db);
  await repository.readMetadata();
  let changed = false;
  const pending = repository.write(async () => { changed = true; });
  const rejected = expect(pending).rejects.toMatchObject({ code: 'CONFLICT' });
  row = { ...row, restoreGeneration: 1 };
  repository.adoptGeneration(1);
  await execute!();
  await rejected;
  expect(changed).toBe(false);
});
