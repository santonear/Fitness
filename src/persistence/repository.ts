import { DomainError } from '../domain/errors';
import type { Metadata } from '../domain/models';
import { database, type FitnessDatabase } from './db';
export function storageError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'QuotaExceededError') throw new DomainError('STORAGE_FULL', 'Local storage is full. Keep a backup before freeing space.');
  throw error;
}
export function createRepository(db: FitnessDatabase) {
  let observedGeneration: number | undefined;
  async function readMetadata(): Promise<Metadata> {
    const row = await db.metadata.toCollection().first();
    if (!row) throw new DomainError('INVALID', 'Local profile is not initialized');
    observedGeneration ??= row.restoreGeneration ?? 0;
    return row;
  }
  function assertGeneration(metadata: Metadata): void {
    observedGeneration ??= metadata.restoreGeneration ?? 0;
    if (observedGeneration !== (metadata.restoreGeneration ?? 0)) {
      throw new DomainError('CONFLICT', 'Local data was replaced; reload before saving');
    }
  }
  function adoptGeneration(generation: number): void {
    observedGeneration = generation;
  }
  function getGeneration(): number | undefined { return observedGeneration; }
  // Whole-store scope serializes application writes with future whole-library import.
  async function write<T>(operation: () => Promise<T>, expectedDataRevision?: number): Promise<T> {
    const requestedGeneration = observedGeneration;
    try {
      return await db.transaction('rw', db.tables, async () => {
        const before = await readMetadata();
        if (requestedGeneration !== undefined && requestedGeneration !== (before.restoreGeneration ?? 0)) {
          throw new DomainError('CONFLICT', 'Local data was replaced; reopen the form before saving');
        }
        assertGeneration(before);
        if (expectedDataRevision !== undefined && before.dataRevision !== expectedDataRevision) throw new DomainError('CONFLICT', 'Data changed; reload before saving');
        const result = await operation();
        const after = await readMetadata();
        await db.metadata.put({ ...after, revision: before.revision + 1, dataRevision: before.dataRevision + 1 });
        return result;
      });
    } catch (error) { return storageError(error); }
  }
  return { db, readMetadata, write, assertGeneration, adoptGeneration, getGeneration };
}
export type Repository = ReturnType<typeof createRepository>;
export const repository = createRepository(database);
