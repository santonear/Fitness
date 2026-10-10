import Dexie, { type Transaction } from 'dexie';
import type { z } from 'zod';
import { v8BackupSchema, type backupDataSchema } from '../domain/schemas';
import { migrateLegacyPlans } from '../domain/v8/legacy-plans';
import { estimateTrainingMinutes } from '../application/rules/duration-estimate';

export type V8Library = z.infer<typeof v8BackupSchema>;
type LegacyInput = Pick<z.infer<typeof backupDataSchema>, 'plans' | 'planVersions' | 'sessions' | 'scheduledWorkouts' | 'guidedStates'>;

export async function prepareV8Migration(source: LegacyInput, migratedAt: string): Promise<V8Library> {
  const projected = await migrateLegacyPlans(source, exercises => estimateTrainingMinutes(exercises.map(exercise => ({
    sets: exercise.targetSets.map(target => 'reps' in target ? { reps: target.reps } : { durationSeconds: target.durationSeconds }),
  }))), migratedAt);
  return v8BackupSchema.parse({ plans: projected.plans, planVersions: projected.versions,
    state: { id: 'v8', ...(projected.currentPlanId ? { currentPlanId: projected.currentPlanId } : {}), migratedAt,
      legacyPlanIds: source.plans.map(plan => plan.id),
      notice: { planCount: projected.plans.length, currentPlanName: projected.plans.find(plan => plan.id === projected.currentPlanId)?.name, acknowledged: projected.plans.length === 0 },
    }, workouts: [], activities: [],
  });
}

export async function writeV8Library(transaction: Transaction, library: V8Library): Promise<void> {
  await transaction.table('v8Plans').bulkAdd(library.plans);
  await transaction.table('v8PlanVersions').bulkAdd(library.planVersions);
  await transaction.table('v8Workouts').bulkAdd(library.workouts);
  await transaction.table('v8Activities').bulkAdd(library.activities);
  await transaction.table('v8State').add(library.state);
}

export async function upgradeToV8(transaction: Transaction): Promise<void> {
  if (await transaction.table('v8State').get('v8')) return;
  const [plans, planVersions, sessions, scheduledWorkouts, guidedStates] = await Promise.all(
    ['plans', 'planVersions', 'sessions', 'scheduledWorkouts', 'guidedStates'].map(name => transaction.table(name).toArray()),
  );
  const migratedAt = new Date().toISOString();
  // WebCrypto is asynchronous outside IndexedDB. Keep the upgrade transaction alive until projection completes.
  const library = await Dexie.waitFor(prepareV8Migration({ plans, planVersions, sessions, scheduledWorkouts, guidedStates }, migratedAt));
  await writeV8Library(transaction, library);
  await transaction.table('metadata').toCollection().modify(row => { row.schemaVersion = 8; row.upgradedAt = migratedAt; });
}
