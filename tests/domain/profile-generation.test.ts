import { expect, it } from 'vitest';
import { createProfileService } from '../../src/application/profile';
import { createRepository } from '../../src/persistence/repository';
import type { FitnessDatabase } from '../../src/persistence/db';

it('rejects a queued old-language update after restored generation adoption', async () => {
  let metadata = { localProfileId: 'profile', schemaVersion: 3, catalogVersion: 1, revision: 1, dataRevision: 1, restoreGeneration: 0 };
  const profile = { locale: 'en', revision: 0 };
  const queue: (() => Promise<void>)[] = [];
  const db = {
    tables: [], profiles: { toCollection: () => ({ first: async () => profile }) },
    metadata: { toCollection: () => ({ first: async () => metadata }) },
    transaction: (_mode: string, _tables: unknown, callback: () => Promise<unknown>) => new Promise((resolve, reject) => {
      queue.push(async () => { try { resolve(await callback()); } catch (error) { reject(error); } });
    }),
  } as unknown as FitnessDatabase;
  const repo = createRepository(db);
  await repo.readMetadata();
  const pending = createProfileService(repo).setLocale('en');
  const rejected = expect(pending).rejects.toMatchObject({ code: 'CONFLICT' });
  // Execute initialization and its nested getProfile read before queuing locale save.
  const initialize = queue.shift()!();
  await queue.shift()!();
  await initialize;
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  metadata = { ...metadata, restoreGeneration: 1 };
  repo.adoptGeneration(1);
  const locale = queue.shift()!();
  await queue.shift()!();
  await locale;
  await rejected;
});
