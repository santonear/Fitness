import { Rules } from '../../src/engine/data';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { prepareV8Migration } from '../../src/persistence/v8-migration';
import { BACKUP_VERSION, DATABASE_VERSION } from '../../src/domain/storage-version';
// Existing stored candidates must remain restorable even when new-draft preflight declines.
import { sourceCandidateFixture as generatePlan } from '../training-engine/source-candidate-fixture';
import { engineProfileSchema } from '../../src/engine/contracts';
import { exercises } from '../../src/catalog/exercises';

describe('training engine additive backup fields', () => {
  it.each([undefined, true, false])(
    'round-trips the prenatal answer %s without backfilling legacy answers',
    async answer => {
      const source = validateBackupEnvelope(
          JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-coach-plan.json', import.meta.url), 'utf8')),
        ),
        v8 = await prepareV8Migration(source.data, '2026-10-18T00:00:00.000Z');
      v8.planReferences = [];
      const population = {
        kind: 'pregnant' as const,
        week: 20,
        providerCleared: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 20,
        ...(answer !== undefined
          ? {
              prenatalCareConfirmed: answer,
              inactiveRampStartedAt: '2026-10-18T00:00:00.000Z',
            }
          : {}),
      };
      v8.state = {
        ...v8.state,
        coachProfile: {
          goalText: '活动',
          weeklyTarget: 1,
          sessionMinutes: 10,
          scheduleOriginalText: '每次10分钟',
          place: 'home',
          equipment: ['none'],
          adultConfirmed: true,
          cautions: [],
          confirmedAt: '2026-10-18T00:00:00.000Z',
          population,
        },
      };
      const facts = structuredClone(v8.workouts),
        envelope = {
          ...source,
          schemaVersion: BACKUP_VERSION,
          data: {
            ...source.data,
            exerciseFavorites: [],
            nutritionRecords: [],
            activityImportReceipts: [],
            metadata: {
              ...source.data.metadata,
              schemaVersion: DATABASE_VERSION,
            },
            v8,
          },
        };
      const restored = validateBackupEnvelope(JSON.parse(JSON.stringify(envelope)));
      expect(restored.data.v8?.state.coachProfile?.population).toEqual(population);
      expect(restored.data.v8?.workouts).toEqual(facts);
    },
  );
  it('retains prescriptions, exact timing and feedback without changing legacy facts', async () => {
    const source = validateBackupEnvelope(
        JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-coach-plan.json', import.meta.url), 'utf8')),
      ),
      before = structuredClone(source);
    const at = '2026-10-15T01:00:00.000Z',
      v8 = await prepareV8Migration(source.data, at);
    v8.planReferences = [];
    const engineProfile = engineProfileSchema.parse({
      goal: 'health',
      level: 'beginner',
      trainingAgeWeeks: 0,
      daysPerWeek: 3,
      sessionMinutes: 30,
      equipment: ['none'],
      place: 'home',
      constraints: { noJump: true, quiet: true, space: 'small' },
      cautions: [],
      population: { kind: 'general' },
      screening: {
        cmrSymptoms: Object.fromEntries(
          new Rules().get('safety.screen.cmr_symptoms').symptoms.map((key: string) => [key, false]),
        ),
        parqAllNo: true,
        knownCondition: false,
        symptoms: false,
        completedAt: at,
        parqAnswers: Array(7).fill(false),
      },
      preferences: { excludedExerciseIds: [], cannotDo: [] },
      birthYearMonth: '1990-01',
      asOfDate: '2026-10-15',
      locale: 'zh',
    });
    const enginePlan = generatePlan(engineProfile);
    expect(enginePlan.templates.length).toBeGreaterThan(0);
    v8.planVersions[0].enginePlan = enginePlan;
    const id = crypto.randomUUID(),
      exerciseId = exercises[0].id;
    const record = {
      id,
      startedAt: at,
      endedAt: at,
      localDate: '2026-10-15',
      timeZone: 'Asia/Shanghai',
      status: 'partial' as const,
      plannedSetCount: 2,
      sets: [{ itemIndex: 0, setIndex: 0, exerciseId, completedAt: at, reps: 8 }],
      checkin: { poorSleepNights: 2, sorenessResolved: false },
      setFeedbackEvents: [
        {
          id: crypto.randomUUID(),
          itemIndex: 0,
          setIndex: 0,
          exerciseId,
          createdAt: at,
          effort: 'discomfort' as const,
          painScore: 4,
          painArea: 'knee' as const,
        },
      ],
    };
    v8.workouts.push(record);
    const envelope = {
      ...source,
      schemaVersion: BACKUP_VERSION,
      data: {
        ...source.data,
        exerciseFavorites: [],
        nutritionRecords: [],
        activityImportReceipts: [],
        metadata: { ...source.data.metadata, schemaVersion: DATABASE_VERSION },
        v8,
      },
    };
    const restored = validateBackupEnvelope(JSON.parse(JSON.stringify(envelope)));
    expect(restored.data.v8?.planVersions[0].enginePlan).toEqual(enginePlan);
    expect(restored.data.v8?.workouts.find(row => row.id === id)).toEqual(record);
    expect(source).toEqual(before);
    expect(() =>
      validateBackupEnvelope({
        ...envelope,
        data: {
          ...envelope.data,
          v8: {
            ...v8,
            workouts: [...v8.workouts.slice(0, -1), { ...record, checkin: { poorSleepNights: -1 } }],
          },
        },
      }),
    ).toThrow();
  });
});
