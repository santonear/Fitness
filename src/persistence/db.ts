import type { CoachLedger } from '../domain/coach-reminders';
import Dexie, { type Table } from 'dexie';
import type { GuidedState } from '../domain/guided-contracts';
import { DomainError } from '../domain/errors';
import { localDateSchema, timeZoneSchema } from '../domain/schemas';
import type { LocalProfile, Metadata, BodyWeightObservation, Plan, PlanVersion, WorkoutSession, SetRecord, ScheduledWorkout, TrainingMemo, AiMemoryNote, TimerState, MediaAsset } from '../domain/models';

export class FitnessDatabase extends Dexie {
  coachDevice!: Table<CoachLedger, string>;
  guidedStates!: Table<GuidedState, string>;
  profiles!: Table<LocalProfile, string>;
  metadata!: Table<Metadata, string>;
  bodyWeights!: Table<BodyWeightObservation, string>;
  plans!: Table<Plan, string>;
  planVersions!: Table<PlanVersion, string>;
  sessions!: Table<WorkoutSession, string>;
  sets!: Table<SetRecord, string>;
  scheduledWorkouts!: Table<ScheduledWorkout, string>;
  trainingMemo!: Table<TrainingMemo, number>;
  aiMemoryNotes!: Table<AiMemoryNote, string>;
  timers!: Table<TimerState, string>;
  mediaAssets!: Table<MediaAsset, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ profiles: 'id', bodyWeights: 'id,localDate', metadata: 'localProfileId' });
    this.version(2).stores({
      profiles: 'id', metadata: 'localProfileId', bodyWeights: 'id,localDate',
      plans: 'id,status,currentVersionId', planVersions: 'id,planId,[planId+versionNumber]',
      sessions: 'id,status,localDate,planVersionId', sets: 'id,sessionId,[sessionId+exerciseInstanceId]',
      scheduledWorkouts: 'id,planVersionId,scheduledDate,completedSessionId',
      trainingMemo: 'schemaVersion', aiMemoryNotes: 'id,memoRevision', timers: 'id,sessionId', mediaAssets: 'id',
    }).upgrade(async transaction => {
      await transaction.table('metadata').toCollection().modify((row: Metadata) => {
        row.schemaVersion = 2;
        row.dataRevision ??= row.revision;
        row.upgradedAt = new Date().toISOString();
      });
    });
    this.version(3).stores({}).upgrade(async transaction => {
      const versions = await transaction.table('planVersions').toArray();
      if (versions.some(version => !localDateSchema.safeParse(version.startDate).success || !timeZoneSchema.safeParse(version.scheduleTimeZone).success)) {
        throw new DomainError('CALENDAR_PROVENANCE_MISSING', 'CALENDAR_PROVENANCE_MISSING: This development database lacks original plan calendar facts. Upgrade stopped; existing data is preserved.');
      }
      await transaction.table('metadata').toCollection().modify((row: Metadata) => {
        row.schemaVersion = 3;
        row.upgradedAt = new Date().toISOString();
      });
    });
    this.version(4).stores({}).upgrade(async transaction => {
      await transaction.table('metadata').toCollection().modify((row: Metadata) => { row.schemaVersion = 4; });
    });
    this.version(5).stores({ guidedStates: 'id' }).upgrade(async transaction => {
      await transaction.table('metadata').toCollection().modify((row: Metadata) => { row.schemaVersion = 5; });
    });
    this.version(7).stores({ coachDevice: 'id' });
    this.version(6).stores({}).upgrade(async transaction => {
      await transaction.table('metadata').toCollection().modify((row: Metadata) => { row.schemaVersion = 6; });
    });
  }
}
export function createDatabase(name: string): FitnessDatabase { return new FitnessDatabase(name); }
export const database = createDatabase('fitness-local');
