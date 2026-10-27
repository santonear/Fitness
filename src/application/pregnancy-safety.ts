import { DomainError } from '../domain/errors';
import { v8StateSchema } from '../domain/schemas';
import type { PlannedItem, CoachProfile } from '../domain/v8/contracts';
import type { Repository } from '../persistence/repository';
import { DATA, calendarDay, exerciseById } from '../engine/data';
import { runGates } from '../engine/gates';
import { toEngineProfile } from './engine-profile';
import { effectivePainItem } from './training-pain';
import type { EngineProfile } from '../engine/contracts';
import { DEFAULT_TIME_ZONE } from '../domain/local-date';
import { endActiveWorkouts } from './training-stop';

type Pregnant = Extract<EngineProfile['population'], { kind: 'pregnant' }>;
export const pregnancyAbsoluteKeys = DATA.rules.find(row => row.id === 'pregnancy.gate.absolute')!.value!
  .items as string[];
const relativeSource = DATA.rules.find(row => row.id === 'pregnancy.gate.relative')!.value!;
export const pregnancyRelativeKeys = [
  ...relativeSource.items_canada,
  ...relativeSource.items_acog_unverified,
] as string[];
const pregnancyKeys = [...pregnancyAbsoluteKeys, ...pregnancyRelativeKeys];
export interface PregnancyReconfirmationDraft {
  base?: Pregnant;
  week?: number;
  provider?: boolean;
  prenatalCareConfirmed?: boolean;
  answers: Record<string, boolean>;
  lastScreenedWeek?: number;
  cycle: string;
  requiredKeys: string[];
  providerRequired: boolean;
  force: boolean;
}
function canonicalContraindication(key: string) {
  const a = key.match(/^pregnancy\.gate\.copy\.absolute_list\.(\d+)$/),
    b = key.match(/^pregnancy\.gate\.copy\.relative_list\.(\d+)$/);
  return a ? (pregnancyAbsoluteKeys[Number(a[1])] ?? key) : b ? (pregnancyRelativeKeys[Number(b[1])] ?? key) : key;
}
function pregnancyRequirements(week: number | undefined, last: number | undefined, force = false) {
  const source = DATA.rules.find(row => row.id === 'pregnancy.reconfirm')!.value!,
    value = week ?? DATA.rules.find(row => row.id === 'pregnancy.activation')!.value!.if_week_unknown_assume_week,
    full = (source.full_reconfirm_at_weeks as number[]).filter(n => value >= n && (last ?? -1) < n),
    placenta =
      value >= source.ask_placenta_praevia_item_at_week && (last ?? -1) < source.ask_placenta_praevia_item_at_week;
  if (force || full.length || last === undefined)
    return {
      cycle: `full:${Math.max(0, ...full, ...(placenta ? [source.ask_placenta_praevia_item_at_week] : []))}`,
      requiredKeys: pregnancyKeys,
      providerRequired: true,
    };
  return placenta
    ? {
        cycle: 'placenta:26',
        requiredKeys: ['placenta_praevia_after_26_weeks'],
        providerRequired: false,
      }
    : { cycle: 'none', requiredKeys: [] as string[], providerRequired: false };
}
/** A stored summary may display old answers; a new source cycle starts with unknown required answers. */
export function createPregnancyReconfirmationDraft(population?: Pregnant, force = false): PregnancyReconfirmationDraft {
  const positive = new Set(
      [...(population?.absoluteContraindications ?? []), ...(population?.relativeContraindications ?? [])].map(
        canonicalContraindication,
      ),
    ),
    known =
      population?.contraindicationsConfirmedNone === true ||
      (!!population?.absoluteContraindications && !!population.relativeContraindications && positive.size > 0);
  const requirement = population
      ? pregnancyRequirements(population.week, population.lastScreenedWeek, force)
      : {
          cycle: 'initial',
          requiredKeys: pregnancyKeys,
          providerRequired: true,
        },
    answers = known ? Object.fromEntries(pregnancyKeys.map(key => [key, positive.has(key)])) : {};
  for (const key of requirement.requiredKeys) delete answers[key];
  return {
    base: population,
    week: population?.week,
    provider: requirement.providerRequired ? undefined : population?.providerCleared,
    prenatalCareConfirmed: requirement.providerRequired ? undefined : population?.prenatalCareConfirmed,
    answers,
    lastScreenedWeek: population?.lastScreenedWeek,
    ...requirement,
    force,
  };
}
export function pregnancyPopulationFromDraft(draft: PregnancyReconfirmationDraft): Pregnant {
  const absolute = [
      ...new Set([
        ...(draft.base?.absoluteContraindications ?? []).map(canonicalContraindication),
        ...pregnancyAbsoluteKeys.filter(key => draft.answers[key] === true),
      ]),
    ],
    relative = [
      ...new Set([
        ...(draft.base?.relativeContraindications ?? []).map(canonicalContraindication),
        ...pregnancyRelativeKeys.filter(key => draft.answers[key] === true),
      ]),
    ],
    complete = pregnancyKeys.every(key => typeof draft.answers[key] === 'boolean');
  return {
    kind: 'pregnant',
    week: draft.week ?? DATA.rules.find(row => row.id === 'pregnancy.activation')!.value!.if_week_unknown_assume_week,
    providerCleared: draft.provider === true,
    ...(draft.prenatalCareConfirmed !== undefined ? { prenatalCareConfirmed: draft.prenatalCareConfirmed } : {}),
    contraindicationsConfirmedNone: complete && !absolute.length && !relative.length,
    absoluteContraindications: absolute,
    relativeContraindications: relative,
    ...(draft.lastScreenedWeek !== undefined ? { lastScreenedWeek: draft.lastScreenedWeek } : {}),
  };
}
export type PregnancyReconfirmationEvent =
  | { type: 'week'; week?: number }
  | { type: 'provider'; answer: boolean }
  | { type: 'prenatal'; answer: boolean }
  | { type: 'contraindication'; key: string; answer: boolean };
export function updatePregnancyReconfirmationDraft(
  prior: PregnancyReconfirmationDraft,
  event: PregnancyReconfirmationEvent,
): PregnancyReconfirmationDraft {
  let next = {
    ...prior,
    base: pregnancyPopulationFromDraft(prior),
    answers: { ...prior.answers },
  };
  if (event.type === 'week') {
    if (event.week !== undefined && (!Number.isFinite(event.week) || event.week < 0))
      throw new DomainError('INVALID', 'INVALID_PREGNANCY_WEEK');
    next.week = event.week;
    const requirement = pregnancyRequirements(next.week, next.lastScreenedWeek, next.force);
    if (requirement.cycle !== next.cycle && requirement.cycle !== 'none') {
      for (const key of requirement.requiredKeys) delete next.answers[key];
      if (requirement.providerRequired) {
        next.provider = undefined;
        next.prenatalCareConfirmed = undefined;
      }
      Object.assign(next, requirement);
    }
  } else {
    if (event.type === 'prenatal' && next.cycle === 'none' && prior.prenatalCareConfirmed === undefined) {
      next.prenatalCareConfirmed = event.answer;
      next.base = pregnancyPopulationFromDraft(next);
      return next;
    }
    if (
      next.cycle === 'none' ||
      (next.cycle === 'placenta:26' && (event.type !== 'contraindication' || !next.requiredKeys.includes(event.key)))
    ) {
      next = {
        ...next,
        cycle: 'health-update',
        requiredKeys: pregnancyKeys,
        providerRequired: true,
        provider: undefined,
        prenatalCareConfirmed: undefined,
        answers: {},
        lastScreenedWeek: undefined,
      };
    }
    if (event.type === 'provider') next.provider = event.answer;
    else if (event.type === 'prenatal') next.prenatalCareConfirmed = event.answer;
    else {
      if (!pregnancyKeys.includes(event.key)) throw new DomainError('INVALID', 'UNKNOWN_PREGNANCY_QUESTION');
      next.answers[event.key] = event.answer;
    }
  }
  if (
    next.cycle !== 'none' &&
    next.requiredKeys.every(key => typeof next.answers[key] === 'boolean') &&
    (!next.providerRequired || (next.provider !== undefined && next.prenatalCareConfirmed !== undefined))
  ) {
    next.lastScreenedWeek =
      next.week ?? DATA.rules.find(row => row.id === 'pregnancy.activation')!.value!.if_week_unknown_assume_week;
    next.force = false;
    next.cycle = 'none';
    next.requiredKeys = [];
    next.providerRequired = false;
    next.base = pregnancyPopulationFromDraft(next);
  }
  return next;
}

export const pregnancyStopKeys = Object.freeze([
  ...(DATA.rules.find(row => row.id === 'pregnancy.stop.trigger')!.value!.items as string[]),
]);
export const pregnancySupineKeys = Object.freeze([
  ...(DATA.rules.find(row => row.id === 'pregnancy.supine_symptom')!.value!.when.in as string[]),
]);
export interface PregnancySafetyState {
  providerPause?: { requiredAt: string };
  supineAvoidSince?: string;
}
const invalid = (message: string): never => {
  throw new DomainError('INVALID', message);
};
const cmrKeys = DATA.rules.find(row => row.id === 'safety.screen.cmr_symptoms')!.value!.symptoms as string[];
function freshScreening(profile: CoachProfile | undefined, requiredAt: string, at = new Date().toISOString()) {
  const screen = profile?.screening,
    completed = Date.parse(screen?.completedAt ?? '');
  return (
    !!profile?.healthStorageConsent?.acceptedAt &&
    Number.isFinite(completed) &&
    completed >= Date.parse(requiredAt) &&
    completed <= Date.parse(at) &&
    screen?.rescreenRequired !== true &&
    screen?.symptoms === false &&
    screen.parqAnswers?.length === 7 &&
    Array.from(screen.parqAnswers).every(answer => typeof answer === 'boolean') &&
    cmrKeys.every(key => screen.cmrSymptoms?.[key] === false)
  );
}
/** Callers pass only remaining items; completed facts are immutable and cannot be retroactively unsafe. */
export function assertPregnancyItems(
  items: Pick<PlannedItem, 'exerciseId'>[],
  state?: PregnancySafetyState,
  profile?: CoachProfile,
) {
  if (state?.providerPause) return invalid('PREGNANCY_PROVIDER_CONTACT_REQUIRED');
  if (state?.supineAvoidSince && !freshScreening(profile, state.supineAvoidSince))
    return invalid('PREGNANCY_NEW_SCREENING_REQUIRED');
  if (state?.supineAvoidSince)
    for (const item of items) {
      const exercise = exerciseById.get(item.exerciseId);
      if (!exercise || exercise.position.includes('supine')) return invalid('PREGNANCY_SUPINE_AVOID_REQUIRED');
    }
}
/** Events retain only safety timestamps, including without health-storage consent. */
export function createPregnancySafety(repo: Repository) {
  async function reportStop(workoutId: string | undefined, symptoms: readonly string[], expectedRevision?: number) {
    if (!symptoms.length || symptoms.some(key => !pregnancyStopKeys.includes(key)))
      return invalid('PREGNANCY_STOP_SYMPTOM_REQUIRED');
    return repo.write(async () => {
      const state = await repo.db.v8State.get('v8');
      if (!state || state.coachProfile?.population?.kind !== 'pregnant') return invalid('PREGNANCY_CONTEXT_REQUIRED');
      const at = new Date().toISOString();
      await endActiveWorkouts(repo, at, workoutId);
      const { nextWorkoutOverride: _, ...retained } = state,
        profile = state.coachProfile;
      await repo.db.v8State.put(
        v8StateSchema.parse({
          ...retained,
          pregnancySafety: {
            ...state.pregnancySafety,
            providerPause: { requiredAt: at },
          },
          ...(symptoms.includes('chest_pain') ? { cardiacPause: { requiredAt: at } } : {}),
          coachProfile: {
            ...profile,
            population: {
              ...profile.population,
              providerCleared: false,
              contraindicationsConfirmedNone: false,
              lastScreenedWeek: undefined,
            },
            ...(profile.screening ? { screening: { ...profile.screening, rescreenRequired: true } } : {}),
          },
        }),
      );
      return {
        requiredAt: at,
        chestEmergency: symptoms.includes('chest_pain'),
      };
    }, expectedRevision);
  }
  async function confirmProviderContacted(expectedRevision?: number) {
    return repo.write(async () => {
      const state = await repo.db.v8State.get('v8'),
        pause = state?.pregnancySafety?.providerPause;
      if (!state || !pause) return invalid('PREGNANCY_PROVIDER_CONTACT_NOT_REQUIRED');
      if (!freshScreening(state.coachProfile, pause.requiredAt)) return invalid('PREGNANCY_NEW_SCREENING_REQUIRED');
      const local = await repo.db.profiles.toCollection().first(),
        zone = local?.timeZone ?? DEFAULT_TIME_ZONE,
        today = calendarDay(new Date().toISOString(), zone)!;
      const mapped = toEngineProfile(state.coachProfile!, {
        asOfDate: today,
        timeZone: zone,
        ageYears: local?.bodyDetails?.values.age,
        bodyWeightKg: local?.bodyDetails?.values.weightKg,
      });
      if (!mapped || runGates(mapped).status === 'blocked') return invalid('PREGNANCY_SCREENING_GATE_BLOCKED');
      const { providerPause: _, ...safety } = state.pregnancySafety!;
      await repo.db.v8State.put(v8StateSchema.parse({ ...state, pregnancySafety: safety }));
    }, expectedRevision);
  }
  async function reportSupine(workoutId: string, itemIndex: number, symptom: string, expectedRevision?: number) {
    if (!pregnancySupineKeys.includes(symptom)) return invalid('PREGNANCY_SUPINE_SYMPTOM_REQUIRED');
    return repo.write(async () => {
      const state = await repo.db.v8State.get('v8');
      if (!state || state.coachProfile?.population?.kind !== 'pregnant') return invalid('PREGNANCY_CONTEXT_REQUIRED');
      const record = await repo.db.v8Workouts.get(workoutId);
      if (!record || record.status !== 'in_progress') return invalid('TRAINING_ENDED');
      if (!Number.isInteger(itemIndex) || itemIndex < 0) return invalid('PREGNANCY_SUPINE_ITEM_REQUIRED');
      const exerciseId =
        effectivePainItem(record, itemIndex)?.exerciseId ??
        record.substitutions?.filter(row => row.itemIndex === itemIndex).at(-1)?.toExerciseId ??
        record.templateSnapshot?.items[itemIndex]?.exerciseId ??
        record.plannedExercises?.find(row => row.itemIndex === itemIndex)?.exerciseId;
      const exercise = exerciseId ? exerciseById.get(exerciseId) : undefined;
      if (!exercise?.position.includes('supine')) return invalid('PREGNANCY_SUPINE_ITEM_REQUIRED');
      const at = new Date().toISOString();
      if (!Number.isFinite(Date.parse(record.startedAt)) || Date.parse(record.startedAt) > Date.parse(at))
        return invalid('INVALID_WORKOUT_TIME');
      const { nextWorkoutOverride: _, ...retained } = state,
        profile = state.coachProfile;
      await repo.db.v8State.put(
        v8StateSchema.parse({
          ...retained,
          pregnancySafety: {
            ...state.pregnancySafety,
            supineAvoidSince: state.pregnancySafety?.supineAvoidSince ?? at,
          },
          coachProfile: {
            ...profile,
            ...(profile.screening ? { screening: { ...profile.screening, rescreenRequired: true } } : {}),
          },
        }),
      );
      return { copyKey: 'pregnancy.supine_symptom.copy' as const };
    }, expectedRevision);
  }
  return { reportStop, confirmProviderContacted, reportSupine };
}
