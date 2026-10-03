import { DomainError } from '../domain/errors';
import type { Metadata } from '../domain/models';
import { database, type FitnessDatabase } from './db';
export function storageError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'QuotaExceededError') throw new DomainError('STORAGE_FULL', 'Local storage is full. Keep a backup before freeing space.');
  throw error;
}
export function createRepository(db: FitnessDatabase) {
  async function readMetadata(): Promise<Metadata> {
    const row = await db.metadata.toCollection().first();
    if (!row) throw new DomainError('INVALID', 'Local profile is not initialized');
    return row;
  }
  // Whole-store scope serializes application writes with future whole-library import.
  async function write<T>(operation: () => Promise<T>, expectedDataRevision?: number): Promise<T> {
    try {
      return await db.transaction('rw', db.tables, async () => {
        const before = await readMetadata();
        if (expectedDataRevision !== undefined && before.dataRevision !== expectedDataRevision) throw new DomainError('CONFLICT', 'Data changed; reload before saving');
        const result = await operation();
        const after = await readMetadata();
        await db.metadata.put({ ...after, revision: before.revision + 1, dataRevision: before.dataRevision + 1 });
        return result;
      });
    } catch (error) { return storageError(error); }
  }
  return { db, readMetadata, write };
}
export type Repository = ReturnType<typeof createRepository>;
export const repository = createRepository(database);
