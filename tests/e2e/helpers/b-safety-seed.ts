import { prescribe } from '../../../src/engine/dose';
import { repository } from '../../../src/persistence/repository';
import { profileService } from '../../../src/application/profile';
import { createV8Workflow } from '../../../src/application/v8-workflow';
import { v8StateSchema, v8WorkoutSchema } from '../../../src/domain/schemas';
import { Rules } from '../../../src/engine/data';
import { toEngineProfile } from '../../../src/application/engine-profile';
import { runGates } from '../../../src/engine/gates';
import { isHardEligible } from '../../../src/engine/candidates';
export async function seedSafety(kind: 'pregnant' | 'postpartum' | 'general' | 'older' | 'power') {
  await profileService.initialize('zh');
  const r = new Rules(),
    at = new Date().toISOString();
  const population =
    kind === 'pregnant'
      ? {
          kind: 'pregnant' as const,
          week: 8,
          providerCleared: true,
          prenatalCareConfirmed: true,
          contraindicationsConfirmedNone: true,
          lastScreenedWeek: 8,
        }
      : kind === 'postpartum'
        ? {
            kind: 'postpartum' as const,
            weeksSinceBirth: 30,
            delivery: 'vaginal' as const,
            cleared: true,
            readinessChecklistPassed: true,
          }
        : kind === 'older'
          ? {
              kind: 'older_adult' as const,
              fallsAnswers: [false, false, false, false],
            }
          : { kind: 'general' as const };
  const profile = {
    goalText: '本地合成安全入口验证',
    weeklyTarget: 3,
    sessionMinutes: 30,
    scheduleOriginalText: '每周3天',
    place: 'home' as const,
    equipment: kind === 'power' ? ['none', 'dumbbell'] : ['none'],
    adultConfirmed: true,
    cautions: [],
    confirmedAt: at,
    healthStorageConsent: { acceptedAt: at },
    population,
    birthYearMonth: kind === 'older' ? '1956-01' : '1991-01',
    goal: 'health' as const,
    level: 'intermediate' as const,
    constraints: { noJump: false, quiet: false, space: 'large' as const },
    screening: {
      parqAllNo: true,
      parqAnswers: Array(7).fill(false),
      knownCondition: false,
      symptoms: false,
      cmrSymptoms: Object.fromEntries(r.get('safety.screen.cmr_symptoms').symptoms.map((key: string) => [key, false])),
      completedAt: at,
      activityStatus: 'active' as const,
      restingBp: 'known_below_threshold' as const,
      acuteIllness: false,
    },
  };
  await repository.write(async () => {
    await repository.db.v8State.put(
      v8StateSchema.parse({
        id: 'v8',
        migratedAt: at,
        legacyPlanIds: [],
        notice: { planCount: 0, acknowledged: true },
        coachProfile: profile,
      }),
    );
  });
  const p = toEngineProfile(profile, {
      asOfDate: at.slice(0, 10),
      timeZone: 'UTC',
    })!,
    g = runGates(p, r),
    e = r.data.exercises.find(
      e =>
        (kind !== 'pregnant' || e.position.includes('supine')) &&
        (kind !== 'older' || e.slug === 'custom-supported-wide-static-stand') &&
        (kind !== 'power' || e.modality === 'power') &&
        (kind === 'power' || ['reps', 'duration'].includes(e.metricType)) &&
        isHardEligible(e, p, g, { rules: r }),
    );
  if (!e) throw Error('No genuine eligible synthetic exercise');
  if (kind === 'power') {
    const item = prescribe(e, p, r, g.restrictions, 'main', 3),
      workout = v8WorkoutSchema.parse({
        id: crypto.randomUUID(),
        startedAt: at,
        localDate: at.slice(0, 10),
        timeZone: 'UTC',
        status: 'in_progress',
        sets: [],
        plannedSetCount: item.sets,
        plannedExercises: [{ exerciseId: e.id, itemIndex: 0, plannedSetCount: item.sets }],
        templateSnapshot: {
          id: 'synthetic-power',
          name: '合成相对负荷展示',
          estimatedMinutes: 10,
          items: [item],
        },
      });
    await repository.write(async () => {
      await repository.db.v8Workouts.add(workout);
    });
    return {
      workoutId: workout.id,
      exerciseId: e.id,
      slug: e.slug,
      sets: workout.sets,
    };
  }
  const workflow = createV8Workflow(repository),
    workout = await workflow.start(undefined, e.id);
  await workflow.recordSet(workout.id, 0, 0, e.metricType === 'duration' ? { durationSeconds: 15 } : { reps: 8 });
  return {
    workoutId: workout.id,
    exerciseId: e.id,
    slug: e.slug,
    sets: (await repository.db.v8Workouts.get(workout.id))!.sets,
  };
}
export async function safetySnapshot() {
  return {
    state: await repository.db.v8State.get('v8'),
    workouts: await repository.db.v8Workouts.toArray(),
    metadata: await repository.readMetadata(),
  };
}
