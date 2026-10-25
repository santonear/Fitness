// Rules line owns this file (UIUX20261008 V9.14). Signatures are frozen in src/domain/plan-upgrade.ts.
// Everything here is pure and deterministic: no I/O, no clock, no randomness.
import {
  MUSCLE_GROUPS,
  PRIMARY_SET_WEIGHT,
  SECONDARY_SET_WEIGHT,
  muscleGroupOf,
  type BodyAgeResult,
  type BodyChangeEvent,
  type BodyChangeInput,
  type BodyChangeKind,
  type BudgetRequest,
  type FitnessTestItem,
  type LiftEntry,
  type MuscleGroup,
  type MuscleLoad,
  type MuscleLoadLevel,
  type NowSession,
  type NowSessionContext,
  type PersonalRecord,
  type SessionMuscleFocus,
  type SetEntry,
} from '../../domain/plan-upgrade';
import { addDays, daysBetween } from '../../domain/local-date';
import { catalogMetadata } from '../../catalog/registry';
import { DATA, type Exercise as EngineExercise } from '../../engine/data';
import { FITNESS_NORMS_2023, bandMiddleAge, type NormBand } from './fitness-norms-2023';

// ---------------------------------------------------------------- muscle groups

/** Weekly fractional sets per group: 0 none, below 10 low, 10–20 ok, above 20 high. */
export const MUSCLE_LOAD_THRESHOLDS = { okMin: 10, okMax: 20 } as const;

const groupOrder = (groups: Iterable<MuscleGroup>): MuscleGroup[] => {
  const set = new Set(groups);
  return MUSCLE_GROUPS.filter(group => set.has(group));
};

const engineById = new Map(DATA.exercises.map(exercise => [exercise.id, exercise]));

/** Primary and secondary groups of one exercise; a group is listed once, at its strongest role. */
export function exerciseMuscleGroups(exerciseId: string): { primary: MuscleGroup[]; secondary: MuscleGroup[] } {
  const meta = catalogMetadata.get(exerciseId) ?? engineById.get(exerciseId);
  const toGroups = (ids: readonly string[] | undefined) => ids?.flatMap(id => muscleGroupOf(id) ?? []) ?? [];
  const primary = groupOrder(toGroups(meta?.primaryMuscles));
  const secondary = groupOrder(toGroups(meta?.secondaryMuscles)).filter(group => !primary.includes(group));
  return { primary, secondary };
}

export function muscleLoadLevel(sets: number): MuscleLoadLevel {
  if (sets <= 0) return 'none';
  if (sets < MUSCLE_LOAD_THRESHOLDS.okMin) return 'low';
  return sets <= MUSCLE_LOAD_THRESHOLDS.okMax ? 'ok' : 'high';
}

/** Fractional weekly sets for all 15 groups, in MUSCLE_GROUPS order. */
export function weeklyMuscleLoad(entries: readonly SetEntry[]): MuscleLoad[] {
  const sets = new Map<MuscleGroup, number>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.completedSets) || entry.completedSets <= 0) continue;
    const { primary, secondary } = exerciseMuscleGroups(entry.exerciseId);
    for (const group of primary) sets.set(group, (sets.get(group) ?? 0) + entry.completedSets * PRIMARY_SET_WEIGHT);
    for (const group of secondary) sets.set(group, (sets.get(group) ?? 0) + entry.completedSets * SECONDARY_SET_WEIGHT);
  }
  return MUSCLE_GROUPS.map(group => {
    const value = sets.get(group) ?? 0;
    return { group, sets: value, level: muscleLoadLevel(value) };
  });
}

export function sessionMuscleFocus(exerciseIds: readonly string[]): SessionMuscleFocus {
  const primary = new Set<MuscleGroup>(),
    secondary = new Set<MuscleGroup>();
  const byExercise: Record<string, MuscleGroup[]> = {};
  for (const id of exerciseIds) {
    const groups = exerciseMuscleGroups(id);
    groups.primary.forEach(group => primary.add(group));
    groups.secondary.forEach(group => secondary.add(group));
    byExercise[id] = [...groups.primary, ...groups.secondary];
  }
  return {
    primary: groupOrder(primary),
    secondary: groupOrder(secondary).filter(group => !primary.has(group)),
    byExercise,
  };
}

// ---------------------------------------------------------------- strength records

export const E1RM_MAX_REPS = 12;

/** Epley estimate, valid only for 1–12 whole reps with a positive load; one rep returns the load itself. */
export function estimateE1rm(weightKg: number, reps: number): number | undefined {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isInteger(reps) || reps < 1 || reps > E1RM_MAX_REPS)
    return undefined;
  const value = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
  return Math.round(value * 10) / 10;
}

/** Best e1RM per exercise and the first date it was reached, sorted by exercise id. */
export function personalRecords(history: readonly LiftEntry[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const entry of history) {
    const e1rmKg = estimateE1rm(entry.weightKg, entry.reps);
    if (e1rmKg === undefined) continue;
    const current = best.get(entry.exerciseId);
    if (!current || e1rmKg > current.e1rmKg || (e1rmKg === current.e1rmKg && entry.localDate < current.localDate))
      best.set(entry.exerciseId, { exerciseId: entry.exerciseId, e1rmKg, localDate: entry.localDate });
  }
  return [...best.values()].sort((a, b) => (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0));
}

/**
 * Records as they stood on a date. bodyChangeEvents needs a baseline 4 weeks back, so callers pass
 * `[...personalRecordsAsOf(history, fourWeeksAgo), ...personalRecords(history)]` as `records`.
 */
export function personalRecordsAsOf(history: readonly LiftEntry[], localDate: string): PersonalRecord[] {
  return personalRecords(history.filter(entry => entry.localDate <= localDate));
}

// ---------------------------------------------------------------- now session

/**
 * Optional extras for buildNowSession. NowSessionContext carries no profile, so the engine's hard
 * safety gate cannot run here. Callers should pass the ids of the user's current plan (already
 * safety-filtered by the engine) as `candidateIds`; without them a conservative default pool is used.
 */
export interface NowSessionOptions {
  candidateIds?: readonly string[];
  /** Joints with an active caution: exercises loading them at level 2 or more are skipped. */
  avoidJoints?: readonly ('knee' | 'back' | 'shoulder' | 'wrist')[];
}

const RISKY_FLAGS = new Set([
  'jumping',
  'high_fall_risk',
  'heavy_axial_load',
  'valsalva_prone',
  'loaded_spinal_rotation',
  'loaded_spinal_flexion',
  'overhead_load',
  'running',
  'unstable_surface',
  'balance_demand',
  'deep_knee_flexion',
]);
const QUIET_UPRIGHT = new Set(['standing', 'seated']);
const QUIET_FLOOR = new Set(['standing', 'seated', 'supine', 'side_lying', 'prone', 'quadruped', 'kneeling']);
const MAX_EXERCISES: Record<number, number> = { 5: 3, 15: 4, 30: 6, 45: 8 };
export const SCENE_MINUTES = { min: 2, max: 5 } as const;

type Mode = 'standard' | 'tired' | 'no-equipment' | 'scene-commute' | 'scene-upright' | 'scene-bed';

interface Dose {
  sets: number;
  reps?: number;
  seconds?: number;
}

function doseFor(exercise: EngineExercise, sets: number): Dose | undefined {
  const base = exercise.default_dose['beginner'];
  if (!base) return undefined;
  if (base.reps) return { sets, reps: Math.round((base.reps[0] + base.reps[1]) / 2) };
  if (base.seconds) return { sets, seconds: Math.round((base.seconds[0] + base.seconds[1]) / 2) };
  return undefined;
}

function doseSeconds(exercise: EngineExercise, dose: Dose, restSeconds: number): number {
  const sides = exercise.time.per_side ? 2 : 1;
  const work = dose.reps !== undefined ? dose.reps * exercise.time.s_per_rep * sides : (dose.seconds ?? 0) * sides;
  return exercise.time.setup_s + dose.sets * work + (dose.sets - 1) * restSeconds + 15;
}

function eligible(exercise: EngineExercise, mode: Mode, options: NowSessionOptions, restricted: boolean): boolean {
  if (exercise.review || exercise.impact > 0 || exercise.flags.some(flag => RISKY_FLAGS.has(flag))) return false;
  if (!['strength', 'isometric', 'mobility'].includes(exercise.modality)) return false;
  if (options.avoidJoints?.some(joint => (exercise.joint_load[joint] ?? 0) >= 2)) return false;
  if (!exerciseMuscleGroups(exercise.id).primary.length) return false;
  const bodyweight = exercise.equipment_required.every(item => item === 'none');
  // Without plan candidates the user's equipment is unknown, so only bodyweight work is offered.
  if ((!restricted || mode !== 'standard') && !bodyweight) return false;
  switch (mode) {
    case 'standard':
      return exercise.difficulty <= 3 && exercise.use.some(use => use === 'main' || use === 'accessory');
    case 'no-equipment':
      return exercise.difficulty <= 3 && exercise.use.some(use => use === 'main' || use === 'accessory');
    case 'tired':
      return (
        exercise.difficulty <= 2 &&
        (exercise.modality === 'mobility' ||
          exercise.flags.includes('low_intensity') ||
          exercise.use.some(use => use === 'warmup' || use === 'cooldown'))
      );
    // Commute: no swinging mobility drills in a moving vehicle or a crowd.
    case 'scene-commute':
      return exercise.modality !== 'mobility' && eligible(exercise, 'scene-upright', options, restricted);
    case 'scene-upright':
      return (
        exercise.difficulty <= 2 &&
        exercise.noise === 0 &&
        exercise.space === 'small' &&
        exercise.position.length > 0 &&
        exercise.position.every(position => QUIET_UPRIGHT.has(position))
      );
    case 'scene-bed':
      return (
        exercise.difficulty <= 2 &&
        exercise.noise === 0 &&
        (exercise.space === 'small' || exercise.space === 'mat') &&
        exercise.position.length > 0 &&
        exercise.position.every(position => QUIET_FLOOR.has(position))
      );
  }
}

/** Picks exercises for "how much time do you have now", filling the largest weekly gaps first. */
export function buildNowSession(
  request: BudgetRequest,
  context: NowSessionContext & NowSessionOptions,
): NowSession | undefined {
  const mode: Mode =
    request.scene === 'bedtime'
      ? 'scene-bed'
      : request.scene === 'commute'
        ? 'scene-commute'
        : request.scene === 'office'
          ? 'scene-upright'
          : (request.variant ?? 'standard');
  const minutes = request.scene
    ? Math.min(SCENE_MINUTES.max, Math.max(SCENE_MINUTES.min, request.minutes))
    : request.minutes;
  const restricted = context.candidateIds !== undefined;
  const allowed = restricted ? new Set(context.candidateIds) : undefined;
  const pool = DATA.exercises
    .filter(exercise => (!allowed || allowed.has(exercise.id)) && eligible(exercise, mode, context, restricted))
    .sort((a, b) => a.difficulty - b.difficulty || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (!pool.length) return undefined;

  const sets = request.scene || minutes <= 5 ? 1 : minutes <= 15 ? 2 : 3;
  const effectiveSets = mode === 'tired' ? Math.max(1, sets - 1) : sets;
  const rest = mode === 'standard' || mode === 'no-equipment' ? 45 : 30;
  const target = context.budget?.setsPerGroupPerWeek ?? MUSCLE_LOAD_THRESHOLDS.okMin;
  const gap = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map(group => [group, target]));
  for (const load of context.weekLoads) gap.set(load.group, target - load.sets);

  let remaining = minutes * 60;
  const chosen: EngineExercise[] = [],
    ladders = new Set<string>();
  const maxCount = MAX_EXERCISES[request.minutes] ?? 4;
  while (chosen.length < maxCount) {
    const groups = [...MUSCLE_GROUPS].sort((a, b) => (gap.get(b) ?? 0) - (gap.get(a) ?? 0));
    let pick: { exercise: EngineExercise; seconds: number } | undefined;
    for (const group of groups) {
      const options = pool.flatMap(exercise => {
        if (chosen.includes(exercise) || (exercise.ladder.id && ladders.has(exercise.ladder.id))) return [];
        const muscles = exerciseMuscleGroups(exercise.id);
        if (!muscles.primary.includes(group)) return [];
        const dose = doseFor(exercise, effectiveSets);
        const seconds = dose && doseSeconds(exercise, dose, rest);
        if (!seconds || seconds > remaining) return [];
        const value =
          muscles.primary.reduce((sum, g) => sum + Math.max(0, gap.get(g) ?? 0), 0) +
          muscles.secondary.reduce((sum, g) => sum + Math.max(0, gap.get(g) ?? 0) * SECONDARY_SET_WEIGHT, 0);
        return [{ exercise, seconds, value }];
      });
      // Stable sort keeps the pool's difficulty-then-slug order between equal values.
      const best = options.sort((a, b) => b.value - a.value)[0];
      if (best) {
        pick = best;
        break;
      }
    }
    if (!pick) break;
    chosen.push(pick.exercise);
    if (pick.exercise.ladder.id) ladders.add(pick.exercise.ladder.id);
    remaining -= pick.seconds;
    const muscles = exerciseMuscleGroups(pick.exercise.id);
    for (const g of muscles.primary) gap.set(g, (gap.get(g) ?? 0) - effectiveSets * PRIMARY_SET_WEIGHT);
    for (const g of muscles.secondary) gap.set(g, (gap.get(g) ?? 0) - effectiveSets * SECONDARY_SET_WEIGHT);
  }
  if (!chosen.length) return undefined;
  const exerciseIds = chosen.map(exercise => exercise.id);
  const used = Math.max(1, Math.ceil((minutes * 60 - remaining) / 60));
  return { exerciseIds, minutes: Math.min(minutes, used), focus: sessionMuscleFocus(exerciseIds) };
}

// ---------------------------------------------------------------- body age

export const BODY_AGE_RANGE = { min: 20, max: 79 } as const;
export const BODY_AGE_MIN_ITEMS = 2;

/** Distance from a result to a group's 60–70 score band; 0 inside the band. */
const bandDistance = (band: NormBand, value: number) => Math.max(0, band.mid[0] - value, value - band.mid[1]);
const bandCentre = (band: NormBand) => (band.mid[0] + band.mid[1]) / 2;

/** Equivalent age for one item: the group whose 60–70 band holds the result (closest band, then centre, then own age). */
export function itemEquivalentAge(
  sex: 'male' | 'female',
  age: number,
  item: FitnessTestItem,
  value: number,
): number | undefined {
  const table = FITNESS_NORMS_2023[sex][item];
  if (!table?.length || !Number.isFinite(value) || value < (item === 'sitAndReachCm' ? -50 : 0)) return undefined;
  const ranked = [...table].sort(
    (a, b) =>
      bandDistance(a, value) - bandDistance(b, value) ||
      Math.abs(bandCentre(a) - value) - Math.abs(bandCentre(b) - value) ||
      Math.abs(bandMiddleAge(a) - age) - Math.abs(bandMiddleAge(b) - age) ||
      a.fromAge - b.fromAge,
  );
  return bandMiddleAge(ranked[0]!);
}

/** Body age: the median of item equivalent ages, needing at least two items, clamped to 20–79. */
export function bodyAge(
  sex: 'male' | 'female',
  age: number,
  results: Partial<Record<FitnessTestItem, number>>,
): BodyAgeResult | undefined {
  const ages = (Object.entries(results) as [FitnessTestItem, number | undefined][])
    .flatMap(([item, value]) => (value === undefined ? [] : [itemEquivalentAge(sex, age, item, value)]))
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b);
  if (ages.length < BODY_AGE_MIN_ITEMS) return undefined;
  const middle = Math.floor(ages.length / 2);
  const median = ages.length % 2 ? ages[middle]! : (ages[middle - 1]! + ages[middle]!) / 2;
  const years = Math.min(BODY_AGE_RANGE.max, Math.max(BODY_AGE_RANGE.min, Math.round(median)));
  return { years, items: ages.length, estimated: true };
}

// ---------------------------------------------------------------- body change lines (wording v5 §19)

const round2 = (value: number) => Math.round(value * 100) / 100;

export const BODY_CHANGE_RULES = {
  /** Same kind is spoken at most once in this many days. */
  repeatDays: 7,
  /** "比 4 周前": baseline is the latest data on or before today − 28 days. */
  baselineDays: 28,
  /** Largest weekly drop of the 7-day average, as a share of body weight. */
  maxWeeklyLossShare: 0.01,
  minBmi: 18.5,
  /** Weight and outline lines are allowed only on these routes. Postpartum never hears "lighter". */
  weightRoutes: ['shape'] as readonly string[],
} as const;

function strongerEvent(input: BodyChangeInput): BodyChangeEvent | undefined {
  const cutoff = addDays(input.today, -BODY_CHANGE_RULES.baselineDays);
  const candidates: { event: BodyChangeEvent; ratio: number }[] = [];
  const byExercise = new Map<string, PersonalRecord[]>();
  for (const record of input.records) {
    if (record.localDate > input.today) continue;
    byExercise.set(record.exerciseId, [...(byExercise.get(record.exerciseId) ?? []), record]);
  }
  for (const [exerciseId, records] of byExercise) {
    const baseline = records.filter(r => r.localDate <= cutoff).sort((a, b) => b.e1rmKg - a.e1rmKg)[0];
    const current = [...records].sort((a, b) => b.e1rmKg - a.e1rmKg)[0]!;
    if (!baseline || current.e1rmKg <= baseline.e1rmKg) continue;
    const delta = current.e1rmKg - baseline.e1rmKg;
    candidates.push({
      event: { kind: 'stronger', metric: exerciseId, delta: round2(delta), sinceLocalDate: baseline.localDate },
      ratio: delta / baseline.e1rmKg,
    });
  }
  const tests = input.tests
    .filter(test => test.localDate <= input.today)
    .sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0));
  const latest = tests.at(-1),
    base = tests.filter(test => test.localDate <= cutoff).at(-1);
  if (latest && base && latest !== base) {
    for (const item of Object.keys(latest.results) as FitnessTestItem[]) {
      const now = latest.results[item],
        then = base.results[item];
      if (now === undefined || then === undefined || !(now > then)) continue;
      candidates.push({
        event: { kind: 'stronger', metric: item, delta: round2(now - then), sinceLocalDate: base.localDate },
        ratio: (now - then) / Math.max(Math.abs(then), 1),
      });
    }
  }
  return candidates.sort((a, b) => b.ratio - a.ratio || (a.event.metric < b.event.metric ? -1 : 1))[0]?.event;
}

function weekAverage(weights: BodyChangeInput['weights'], today: string, weeksBack: number): number | undefined {
  const to = addDays(today, -7 * weeksBack),
    from = addDays(to, -6);
  const values = weights
    .filter(w => w.localDate >= from && w.localDate <= to && Number.isFinite(w.weightKg) && w.weightKg > 0)
    .map(w => w.weightKg);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function weightEvents(input: BodyChangeInput): BodyChangeEvent[] {
  const w0 = weekAverage(input.weights, input.today, 0),
    w1 = weekAverage(input.weights, input.today, 1),
    w2 = weekAverage(input.weights, input.today, 2);
  // Weight going up, flat, or without a previous week is never commented on.
  if (w0 === undefined || w1 === undefined || !(w0 < w1)) return [];
  const latest = [...input.weights]
    .filter(w => w.localDate <= input.today && w.weightKg > 0)
    .sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0))
    .at(-1);
  const heightM = input.heightCm && input.heightCm > 0 ? input.heightCm / 100 : undefined;
  const bmi = latest && heightM ? latest.weightKg / (heightM * heightM) : undefined;
  if (bmi !== undefined && bmi < BODY_CHANGE_RULES.minBmi)
    return [
      {
        kind: 'care-low-bmi',
        metric: 'bmi',
        delta: round2(bmi - BODY_CHANGE_RULES.minBmi),
        sinceLocalDate: addDays(input.today, -13),
      },
    ];
  if (w1 - w0 > w1 * BODY_CHANGE_RULES.maxWeeklyLossShare)
    return [
      { kind: 'care-fast-loss', metric: 'weightKg', delta: round2(w0 - w1), sinceLocalDate: addDays(input.today, -13) },
    ];
  if (!input.route || !BODY_CHANGE_RULES.weightRoutes.includes(input.route) || bmi === undefined || w2 === undefined)
    return [];
  if (!(w1 < w2) || w2 - w1 > w2 * BODY_CHANGE_RULES.maxWeeklyLossShare) return [];
  return [{ kind: 'lighter', metric: 'weightKg', delta: round2(w0 - w2), sinceLocalDate: addDays(input.today, -20) }];
}

/**
 * Body-change lines decided by code only (wording v5 §19). `waist` needs waist history and `feel`
 * needs a self-report; neither is in BodyChangeInput, so neither is produced here.
 */
export function bodyChangeEvents(input: BodyChangeInput): BodyChangeEvent[] {
  const recent = (kind: BodyChangeKind) => {
    const last = input.lastSpokenByKind[kind];
    return last !== undefined && daysBetween(last, input.today) < BODY_CHANGE_RULES.repeatDays;
  };
  const events = [strongerEvent(input), ...weightEvents(input)].filter((event): event is BodyChangeEvent => !!event);
  return events.filter(event => !recent(event.kind));
}

// ---------------------------------------------------------------- skip pattern

/** ISO weekday 1 (Monday) … 7 (Sunday). */
export const isoWeekday = (localDate: string) => ((new Date(`${localDate}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** A weekday skipped in at least 3 of its last 4 planned occurrences (wording v5 §14). */
export function skipPattern(
  trainedDates: readonly string[],
  plannedDates: readonly string[],
): { weekday: number } | undefined {
  const trained = new Set(trainedDates);
  const byWeekday = new Map<number, string[]>();
  for (const date of [...new Set(plannedDates)].sort())
    byWeekday.set(isoWeekday(date), [...(byWeekday.get(isoWeekday(date)) ?? []), date]);
  let found: { weekday: number; skipped: number } | undefined;
  for (const [weekday, dates] of [...byWeekday].sort((a, b) => a[0] - b[0])) {
    const skipped = dates.slice(-4).filter(date => !trained.has(date)).length;
    if (skipped >= 3 && (!found || skipped > found.skipped)) found = { weekday, skipped };
  }
  return found && { weekday: found.weekday };
}
