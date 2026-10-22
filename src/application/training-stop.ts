import { z } from 'zod';
import { DomainError } from '../domain/errors';
import { v8StateSchema, v8WorkoutSchema } from '../domain/schemas';
import type { Repository } from '../persistence/repository';
import { DATA, calendarDay, addCalendarMonths } from '../engine/data';
import { runGates } from '../engine/gates';
import { toEngineProfile } from './engine-profile';
import { DEFAULT_TIME_ZONE } from '../domain/local-date';

const source = DATA.rules.find(row => row.id === 'safety.stop.button')!.value!;
export const cardiacSymptomKeys = Object.freeze([...(source.cardiac_symptoms as string[])]);
const clearance = DATA.rules.find(row => row.id === 'safety.clearance.confirm')!.value!;
const cmrKeys = DATA.rules.find(row => row.id === 'safety.screen.cmr_symptoms')!.value!.symptoms as string[];
const confirmationSchema = z.strictObject({ date: z.iso.date(), intensity: z.enum(['moderate', 'vigorous']) });
const invalid = (message: string): never => {
  throw new DomainError('INVALID', message);
};

/**
 * Safety stop for every workout still in progress, ended at `at`: with sets it is partial, otherwise not
 * started. Call inside repo.write. Nothing is written when `workoutId` is no longer in progress
 * (TRAINING_ENDED) or any start time is unreadable or after `at` (INVALID_WORKOUT_TIME).
 */
export async function endActiveWorkouts(repo: Repository, at: string, workoutId?: string) {
  const active = (await repo.db.v8Workouts.toArray()).filter(row => row.status === 'in_progress');
  if (workoutId && !active.some(row => row.id === workoutId)) return invalid('TRAINING_ENDED');
  if (active.some(row => !Number.isFinite(Date.parse(row.startedAt)) || Date.parse(row.startedAt) > Date.parse(at)))
    return invalid('INVALID_WORKOUT_TIME');
  for (const record of active)
    await repo.db.v8Workouts.put(
      v8WorkoutSchema.parse({ ...record, status: record.sets.length ? 'partial' : 'not_started', endedAt: at }),
    );
  return active;
}

/** Symptom selections are transient: even with consent only the independent pause instant is stored. */
export function createTrainingStop(repo: Repository) {
  async function report(workoutId: string | undefined, symptoms: readonly string[], expectedRevision?: number) {
    if (!symptoms.length || symptoms.some(key => !cardiacSymptomKeys.includes(key)))
      return invalid('CARDIAC_SYMPTOM_REQUIRED');
    return repo.write(async () => {
      const state = await repo.db.v8State.get('v8');
      if (!state) return invalid('PROFILE_REQUIRED');
      const at = new Date().toISOString();
      await endActiveWorkouts(repo, at, workoutId);
      const { nextWorkoutOverride: _, ...retained } = state;
      await repo.db.v8State.put(v8StateSchema.parse({ ...retained, cardiacPause: { requiredAt: at } }));
      return { requiredAt: at };
    }, expectedRevision);
  }
  async function confirmClearance(input: z.infer<typeof confirmationSchema>, expectedRevision?: number) {
    const confirmed = confirmationSchema.parse(input);
    return repo.write(async () => {
      const state = await repo.db.v8State.get('v8'),
        profile = state?.coachProfile,
        screen = profile?.screening,
        pause = state?.cardiacPause;
      if (!state || !pause) return invalid('CARDIAC_REVIEW_NOT_REQUIRED');
      const now = new Date().toISOString(),
        completed = Date.parse(screen?.completedAt ?? '');
      if (
        !profile?.healthStorageConsent?.acceptedAt ||
        !Number.isFinite(completed) ||
        completed < Date.parse(pause.requiredAt) ||
        completed > Date.parse(now) ||
        screen?.rescreenRequired === true ||
        screen?.symptoms !== false ||
        !cmrKeys.every(key => screen.cmrSymptoms?.[key] === false) ||
        screen?.parqAnswers?.length !== 7 ||
        !Array.from(screen.parqAnswers).every(answer => typeof answer === 'boolean')
      )
        return invalid('CARDIAC_NEW_SCREENING_REQUIRED');
      const local = await repo.db.profiles.toCollection().first(),
        zone = local?.timeZone ?? DEFAULT_TIME_ZONE,
        today = calendarDay(now, zone)!,
        requiredDay = calendarDay(pause.requiredAt, zone)!;
      if (
        !clearance.attested_intensity_options.includes(confirmed.intensity) ||
        confirmed.date > today ||
        confirmed.date < requiredDay ||
        addCalendarMonths(confirmed.date, clearance.valid_months_max) < today
      )
        return invalid('INVALID_CLEARANCE_DATE');
      const updatedProfile = { ...profile, screening: { ...screen, clearance: confirmed } };
      const mapped = toEngineProfile(updatedProfile, {
        asOfDate: today,
        timeZone: zone,
        ageYears: local?.bodyDetails?.values.age,
        bodyWeightKg: local?.bodyDetails?.values.weightKg,
      });
      // Other independent pauses remain intact; this confirmation must still satisfy current screening gates.
      if (
        !mapped ||
        runGates(mapped).reasons.some(reason => reason.ruleId.startsWith('safety.') && reason.status === 'blocked')
      )
        return invalid('CARDIAC_SCREENING_GATE_BLOCKED');
      const { cardiacPause: _, ...retained } = state;
      await repo.db.v8State.put(v8StateSchema.parse({ ...retained, coachProfile: updatedProfile }));
    }, expectedRevision);
  }
  return { report, confirmClearance };
}
