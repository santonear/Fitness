import type { Repository } from '../persistence/repository';
import type { ActivityRecord } from '../domain/v8/contracts';
import { v8ActivitySchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';

export function activityDate(timeZone: string, offset = 0, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const day = new Date(`${['year','month','day'].map(k => parts.find(p => p.type === k)!.value).join('-')}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0,10);
}
export function createActivityService(repo: Repository) {
  return { save: async (input: Omit<ActivityRecord, 'createdAt'>, expectedRevision: number, restoreGeneration: number) => {
    const record = v8ActivitySchema.parse({ ...input, createdAt: new Date().toISOString() });
    if (!Number.isInteger(record.minutes) || record.minutes < 5 || record.localDate > activityDate(record.timeZone) ||
      new Date(`${record.localDate}T00:00:00Z`).toISOString().slice(0,10) !== record.localDate) throw new DomainError('INVALID','INVALID_ACTIVITY');
    return repo.write(async () => {
      if (((await repo.readMetadata()).restoreGeneration ?? 0) !== restoreGeneration) throw new DomainError('CONFLICT','STALE_ACTIVITY');
      await repo.db.v8Activities.add(record);
      return record;
    }, expectedRevision);
  } };
}
