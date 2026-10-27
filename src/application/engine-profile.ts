import { effectiveCautionLevels } from './caution-safety';
import type { PregnancySafetyState } from './pregnancy-safety';
import { deriveActivityEvidence } from './engine-activity-evidence';
import type { CoachProfile, WorkoutRecord, PostpartumSafetyState, OlderSafetyState } from '../domain/v8/contracts';
import type { Route } from '../domain/plan-upgrade';
import { engineProfileSchema, type CautionJoint, type EngineProfile, type Pattern } from '../engine/contracts';
import { hasHouseholdSupport } from '../engine/equipment';
import { DATA, calendarDay } from '../engine/data';
import { pendingPainReviews, painQuestionKeys, historyDangerReview } from './pain-events';
import { DEFAULT_TIME_ZONE, addDays, weekStart } from '../domain/local-date';

export interface PainFollowupRestriction {
  pattern: Pattern;
  appliedAt: string;
  sourceWorkoutId: string;
  cautionLevelDelta: number;
}
/** Confirmed exclusions cover this workout and one subsequently completed/partial workout. */
export function historyPainState(
  history: WorkoutRecord[],
  stored: EngineProfile['painState'] = [],
  followups: readonly PainFollowupRestriction[] = [],
): EngineProfile['painState'] {
  const states = new Map(stored.map(row => [row.pattern, { ...row }]));
  const duration = DATA.rules
    .find(rule => rule.id === 'pain.rule')!
    .value!.bands.find((band: { action: string }) => band.action === 'drop_pattern').drop_pattern_sessions;
  const drops = history.flatMap(record =>
    (record.painActions ?? [])
      .filter(action => action.kind === 'exclude')
      .map(action => ({
        record,
        action,
        event: record.setFeedbackEvents?.find(event => event.id === action.eventId),
      })),
  );
  for (const { record, action, event } of drops) {
    const later = history.filter(
      next =>
        next.id !== record.id &&
        (next.status === 'complete' || next.status === 'partial') &&
        Date.parse(next.startedAt) > Date.parse(action.appliedAt),
    ).length;
    const related = drops.filter(row => row.event?.painArea === event?.painArea),
      repeats = new Set(related.map(row => `${row.record.id}:${row.event?.itemIndex}:${row.event?.setIndex}`)).size;
    const previous = states.get(action.pattern),
      remaining = Math.max(previous?.remainingSessions ?? 0, Math.max(0, duration - 1 - later));
    states.set(action.pattern, {
      pattern: action.pattern,
      remainingSessions: remaining,
      repeatEvents: Math.max(previous?.repeatEvents ?? 0, repeats),
      ...(event?.painScore !== undefined ? { score: event.painScore } : {}),
    });
  }
  for (const applied of followups) {
    const later = new Set(
      history
        .filter(
          row =>
            row.id !== applied.sourceWorkoutId &&
            ['complete', 'partial'].includes(row.status) &&
            Date.parse(row.startedAt) >= Date.parse(applied.appliedAt),
        )
        .map(row => row.id),
    ).size;
    const prior = states.get(applied.pattern),
      remaining = Math.max(0, duration - later);
    states.set(applied.pattern, {
      ...prior,
      pattern: applied.pattern,
      remainingSessions: Math.max(prior?.remainingSessions ?? 0, remaining),
      cautionLevelDelta: Math.max(prior?.cautionLevelDelta ?? 0, applied.cautionLevelDelta),
    });
  }
  return [...states.values()].sort((a, b) => a.pattern.localeCompare(b.pattern, 'en'));
}

/** Read projection of the old age-group selector; the original answers remain intact. */
export function legacyAgePopulation(
  population: EngineProfile['population'] | undefined,
  birthYearMonth: string | undefined,
  asOfDate: string,
): EngineProfile['population'] | undefined {
  if (population?.kind !== 'older_adult' || !birthYearMonth) return population;
  const [year, month] = birthYearMonth.split('-').map(Number);
  const [nowYear, nowMonth] = asOfDate.split('-').map(Number);
  const years = nowYear - year - (nowMonth < month ? 1 : 0);
  const threshold = DATA.rules.find(row => row.id === 'older.activation')!.value!.trigger.any[0].gte;
  return years < threshold ? { kind: 'general' } : population;
}

/** Local-only source. Never spread this object into a coach/network request. */
export type EngineProfileFields = Partial<
  Pick<
    EngineProfile,
    | 'cautions'
    | 'postpartumRisk'
    | 'powerOneRm'
    | 'goal'
    | 'level'
    | 'constraints'
    | 'population'
    | 'screening'
    | 'preferences'
    | 'birthYearMonth'
    | 'equipmentLoadsKg'
    | 'painState'
    | 'householdSupport'
  >
> & { healthStorageConsent?: { acceptedAt: string }; route?: Route };
export type EngineCoachProfile = CoachProfile & EngineProfileFields;
type StoredPreference = { kind?: string; value?: string | string[] };

export function enginePreferences(
  profile: EngineProfileFields,
  notes: StoredPreference[] = [],
): EngineProfile['preferences'] {
  const excluded = new Set(profile.preferences?.excludedExerciseIds ?? []),
    cannotDo = new Set(profile.preferences?.cannotDo ?? []);
  for (const note of notes) {
    if (note.kind === 'dislike_exercise' && typeof note.value === 'string') excluded.add(note.value);
    if (
      note.kind === 'cannot_do' &&
      typeof note.value === 'string' &&
      ['walking_carry', 'jumping', 'floor_work', 'overhead', 'kneeling'].includes(note.value)
    )
      cannotDo.add(note.value as EngineProfile['preferences']['cannotDo'][number]);
  }
  return {
    excludedExerciseIds: [...excluded].sort(),
    cannotDo: [...cannotDo].sort(),
    ...(profile.preferences?.liked ? { liked: profile.preferences.liked } : {}),
  };
}

/** The goal a free-text goal names. Yoga comes last (goal.select.single_primary tie_break_order): "减脂，偶尔做瑜伽" stays fat loss. */
export function goalFromText(text: string): EngineProfile['goal'] {
  return /增肌|肌肉|muscle|hypertroph/i.test(text)
    ? 'muscle'
    : /减脂|减重|fat|weight loss/i.test(text)
      ? 'fat_loss'
      : /力量|strength/i.test(text)
        ? 'strength'
        : /灵活|mobility/i.test(text)
          ? 'mobility'
          : /瑜伽|yoga/i.test(text)
            ? 'yoga'
            : 'health';
}
/** Missing/legacy screening stays unknown; a checkbox never implies seven negative answers. */
export function toEngineProfile(
  profile: EngineCoachProfile,
  options: {
    cautionLevels?: Partial<Record<CautionJoint, { level: 0 | 1 | 2; changedAt: string }>>;
    painFollowupRestrictions?: readonly PainFollowupRestriction[];
    pregnancySafety?: PregnancySafetyState;
    olderSafety?: OlderSafetyState;
    screeningEvidenceEvents?: readonly {
      answeredAt: string;
      symptoms: boolean;
    }[];
    postpartumSafety?: PostpartumSafetyState;
    locale?: 'zh' | 'en';
    timeZone?: string;
    asOfDate: string;
    history?: WorkoutRecord[];
    notes?: StoredPreference[];
    ageYears?: number;
    bodyWeightKg?: number;
  },
): EngineProfile | undefined {
  const source = profile;
  if (
    !profile.healthStorageConsent?.acceptedAt ||
    !source.screening?.completedAt ||
    source.screening.parqAnswers?.length !== 7
  )
    return;
  const screening = {
    ...source.screening,
    parqAllNo: source.screening.parqAnswers.every(answer => answer === false),
  };
  const safety = options.postpartumSafety,
    instants = [
      safety?.lastSymptomAt,
      safety?.urgentAt,
      safety?.regression?.requiredAt,
      safety?.professionalSeenAt,
    ].filter((at): at is string => !!at),
    horizon = instants.length ? Math.max(...instants.map(Date.parse)) : undefined,
    zone = options.timeZone ?? DEFAULT_TIME_ZONE;
  let cutoff: string | undefined;
  if (horizon !== undefined) {
    const day = calendarDay(new Date(horizon).toISOString(), zone);
    if (day) {
      cutoff = addDays(weekStart(day), 7);
    }
  }
  const afterHorizon = (at: string) => !cutoff || (calendarDay(at, zone) ?? '') >= cutoff;
  const evidence = deriveActivityEvidence({
    records: (options.history ?? []).filter(row => afterHorizon(row.endedAt ?? row.startedAt)),
    screeningEvents: options.screeningEvidenceEvents?.filter(event => afterHorizon(event.answeredAt)),
    asOfDate: options.asOfDate,
    timeZone: zone,
    weeklyTarget: profile.weeklyTarget,
  });
  screening.activityEvidence = {
    consecutiveRegularWeeks: evidence.consecutiveRegularWeeks,
    noSymptomReportsWeeks: evidence.noSymptomReportsWeeks,
  };
  screening.redFlagReview = historyDangerReview(options.history ?? [], screening.redFlagReview);
  const pending = pendingPainReviews(options.history ?? []);
  if (pending.length) {
    const old = screening.redFlagReview,
      areas = [
        ...new Set([
          ...(old?.areas ?? []),
          ...pending.flatMap(row => (row.event.painArea ? [row.event.painArea] : [])),
        ]),
      ];
    const requiredAt = [...pending.map(row => row.event.createdAt), ...(old ? [old.requiredAt] : [])]
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1)!;
    screening.redFlagReview = {
      requiredAt,
      areas,
      questionKeys: painQuestionKeys(areas),
      ...(old?.answers ? { answers: old.answers } : {}),
    };
  }
  const history = (options.history ?? [])
    .filter(row => row.status === 'complete' || row.status === 'partial')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const first = history[0],
    ageWeeks = first
      ? Math.max(0, Math.floor((Date.parse(options.asOfDate) - Date.parse(first.localDate)) / 604800000))
      : 0;
  const pregnancyWeeks =
    source.population?.kind === 'pregnant' && screening.activityStatus === 'inactive'
      ? source.population.inactiveRampStartedAt
        ? Math.max(
            0,
            Math.floor(
              (Date.parse(options.asOfDate) -
                Date.parse(
                  calendarDay(source.population.inactiveRampStartedAt, zone) ??
                    source.population.inactiveRampStartedAt.slice(0, 10),
                )) /
                604800000,
            ),
          )
        : 0
      : ageWeeks;
  const goal = source.goal ?? goalFromText(profile.goalText);
  const levels = effectiveCautionLevels(
    options.cautionLevels,
    options.history ?? [],
    options.painFollowupRestrictions,
    profile.cautions,
  );
  const parsed = engineProfileSchema.safeParse({
    cautionLevels: Object.keys(levels).length
      ? Object.fromEntries(Object.entries(levels).map(([joint, value]) => [joint, value.level]))
      : undefined,
    postpartumRisk: source.postpartumRisk,
    powerOneRm: source.powerOneRm,
    pregnancySafety: options.pregnancySafety ? { avoidSupine: !!options.pregnancySafety.supineAvoidSince } : undefined,
    olderSafety: options.olderSafety
      ? {
          fallPaused: !!options.olderSafety.reviewRequiredAt,
          balanceStage: options.olderSafety.balanceStage,
        }
      : undefined,
    postpartumSafety: options.postpartumSafety
      ? {
          urgentPaused: !!options.postpartumSafety.urgentAt,
          regressedPhase: options.postpartumSafety.regression?.phase,
        }
      : undefined,
    goal,
    level: source.level ?? 'beginner',
    trainingAgeWeeks: pregnancyWeeks,
    daysPerWeek: Math.min(6, profile.weeklyTarget),
    preferredDays: profile.preferredDays?.slice(0, 6),
    sessionMinutes: Math.min(90, Math.max(10, profile.sessionMinutes)),
    equipment: profile.equipment,
    place: profile.place,
    householdSupport: hasHouseholdSupport(profile),
    constraints: source.constraints ?? {
      noJump: false,
      quiet: false,
      space: 'small',
    },
    cautions: profile.cautions,
    // 稳健 is an explicit older-module opt-in (older.activation), so it is kept below the age threshold too.
    population:
      source.route === 'steady'
        ? source.population
        : legacyAgePopulation(source.population, source.birthYearMonth, options.asOfDate),
    screening,
    preferences: enginePreferences(profile, options.notes),
    birthYearMonth: source.birthYearMonth,
    ageYears: source.birthYearMonth ? undefined : options.ageYears,
    bodyWeightKg: options.bodyWeightKg,
    asOfDate: options.asOfDate,
    timeZone: options.timeZone,
    locale: options.locale ?? 'zh',
    equipmentLoadsKg: source.equipmentLoadsKg,
    availableLoadsKg: profile.availableLoadsKg,
    painState: historyPainState(options.history ?? [], profile.painState, options.painFollowupRestrictions),
  });
  return parsed.success ? parsed.data : undefined;
}
