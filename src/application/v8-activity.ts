import type { Repository } from '../persistence/repository';
import type { ActivityRecord } from '../domain/v8/contracts';
import { v8ActivitySchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';
import { addDays, isLocalDate, todayIn } from '../domain/local-date';

/** Today (plus `offset` days) in the time zone; kept for existing callers of `todayIn`. */
export const activityDate = (timeZone: string, offset = 0, now = new Date()) => addDays(todayIn(timeZone, now), offset);
export function createActivityService(repo: Repository) {
  return { save: async (input: Omit<ActivityRecord, 'createdAt'>, expectedRevision: number, restoreGeneration: number) => {
    const record = v8ActivitySchema.parse({ ...input, createdAt: new Date().toISOString() });
    if (!Number.isInteger(record.minutes) || record.minutes < 5 || record.localDate > activityDate(record.timeZone) ||
      !isLocalDate(record.localDate)) throw new DomainError('INVALID','INVALID_ACTIVITY');
    return repo.write(async () => {
      if (((await repo.readMetadata()).restoreGeneration ?? 0) !== restoreGeneration) throw new DomainError('CONFLICT','STALE_ACTIVITY');
      await repo.db.v8Activities.add(record);
      return record;
    }, expectedRevision);
  } };
}
