import { nutritionRecordSchema, type NutritionRecord } from '../domain/lifestyle';
import { DomainError } from '../domain/errors';
import type { Repository } from '../persistence/repository';
import { activityDate } from './v8-activity';
import { isFeatureEnabled } from './feature-flags';
export function createNutritionService(repo: Repository, enabled = () => isFeatureEnabled('nutrition')) {
  return {
    list: () => repo.db.nutritionRecords.orderBy('localDate').reverse().toArray(),
    save: async (input: Omit<NutritionRecord, 'createdAt'>, revision: number, generation: number) => {
      if (!enabled()) throw new DomainError('INVALID', 'FEATURE_DISABLED');
      const row = nutritionRecordSchema.parse({ ...input, createdAt: new Date().toISOString() });
      if (row.localDate > activityDate(row.timeZone)) throw new DomainError('INVALID', 'INVALID_DATE');
      return repo.write(async () => {
        if (!enabled() || ((await repo.readMetadata()).restoreGeneration ?? 0) !== generation) throw new DomainError('CONFLICT', 'STALE_NUTRITION');
        await repo.db.nutritionRecords.add(row); return row;
      }, revision);
    },
  };
}
/** Explicit nutrition consent is independent of body/history consent. No identifiers or timestamps. */
export function nutritionForCoach(rows: NutritionRecord[], consent: boolean) {
  return consent ? rows.slice(-30).map(({ localDate, meal, portion, calories }) => ({ localDate, meal, ...(portion ? { portion } : {}), ...(calories !== undefined ? { calories } : {}) })) : undefined;
}
