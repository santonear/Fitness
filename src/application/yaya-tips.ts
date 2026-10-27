/**
 * 芽芽's plan tips decided by code only (wording v5 §8 / §14, 上周小结 G): which tip applies and the plan change
 * behind its button. Pure: no storage, no clock. Each change is given twice: as engine operations (run by the training
 * engine's own modify, so duration fits and safety rules hold) and as a local proposal for when the engine is off.
 * Saving goes through the same apply path as a 芽芽 plan edit: a new version, the old one kept, undo for 10 seconds.
 */
import type { PlanVersion, SessionTemplate, WorkoutRecord, PlannedItem } from '../domain/v8/contracts';
import type { Caution, EngineChange } from '../engine/contracts';
import type { MuscleGroup, MuscleLoad } from '../domain/plan-upgrade';
import type { PlanProposal } from './review/contracts';
import { estimatePlannedMinutes } from '../domain/duration-estimate';
import { addDays, daysBetween, todayIn } from '../domain/local-date';
import { exerciseById } from '../engine/data';
import { isYogaSession } from '../engine/yoga-session';
import { MUSCLE_LOAD_THRESHOLDS, exerciseMuscleGroups, isoWeekday, skipPattern } from './rules/plan-upgrade';
import { latestSetFeedback } from './pain-events';
import { planStartDate, weekSchedule, weekdays, type Weekday } from './plan-presentation';
import { sessionForDate } from './training-dates';
import { workoutTimes } from './day-timeline';
import { trainingMinutes, workoutSeconds } from './workout-duration';
import { planProposal } from './review/suggest';

type Workout = Pick<
  WorkoutRecord,
  | 'id'
  | 'localDate'
  | 'status'
  | 'startedAt'
  | 'endedAt'
  | 'timeCorrections'
  | 'templateId'
  | 'templateSnapshot'
  | 'sets'
  | 'setFeedbackEvents'
  | 'feedback'
>;
const counted = (w: Pick<WorkoutRecord, 'status'>) => w.status === 'complete' || w.status === 'partial';
const clampMinutes = (minutes: number) => Math.min(90, Math.max(10, Math.round(minutes)));

// ---------------------------------------------------------------- shared plan edits

/**
 * The template cut down to about `minutes`: sets above 2 come off first, then the last items, keeping one.
 * Undefined when it would not get shorter. Used when the training engine is off; with the engine on, the same tip runs
 * as the engine's own `shorten`, which fits the duration by its rules.
 */
export function fitTemplate(template: SessionTemplate, minutes: number): SessionTemplate | undefined {
  if (template.durationScope === 'untargeted') return undefined;
  const target = clampMinutes(minutes);
  const items = template.items.map(item => structuredClone(item));
  const estimate = () => estimatePlannedMinutes(items, 10);
  // A yoga session keeps its closing rest: the pose before it comes off instead.
  const yoga = isYogaSession(template);
  while (estimate() > target) {
    const most = items.reduce((best, item, index) => (item.sets > items[best]!.sets ? index : best), 0);
    if (items[most]!.sets > 2) items[most]!.sets -= 1;
    else if (yoga && items.length > 2) items.splice(-2, 1);
    else if (items.length > 1) items.pop();
    else break;
  }
  const estimatedMinutes = estimate();
  if (estimatedMinutes >= template.estimatedMinutes) return undefined;
  const { estimatedSeconds: _stale, ...rest } = template;
  return { ...rest, items, estimatedMinutes, targetMinutes: target };
}

/** The plan as a proposal with some templates replaced; session minutes follow the median template. */
export function withTemplates(version: PlanVersion, changed: readonly SessionTemplate[], weeklyTarget?: number) {
  const base = planProposal(version);
  const templates = base.templates.map(template => changed.find(row => row.id === template.id) ?? template);
  const durations = templates.map(t => t.estimatedMinutes).sort((a, b) => a - b);
  const middle =
    (durations[Math.floor((durations.length - 1) / 2)]! + durations[Math.floor(durations.length / 2)]!) / 2;
  return {
    ...base,
    templates,
    sessionMinutes: clampMinutes(middle),
    ...(weeklyTarget !== undefined ? { weeklyTarget } : {}),
  } satisfies PlanProposal;
}

// ---------------------------------------------------------------- missed weekday (v5 §14, shared with G case 3)

/**
 * Dates the plan had a session on, each date read from the version in use that day.
 * A version counts from the local day it was saved; the first one from the plan's start date.
 */
export function plannedDates(versions: readonly PlanVersion[], timeZone: string, from: string, to: string): string[] {
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const first = sorted[0];
  const start = first && planStartDate(first, timeZone);
  if (!first || !start) return [];
  const dates: string[] = [];
  for (let date = from > start ? from : start; date <= to; date = addDays(date, 1)) {
    const version = sorted.filter((v, index) => index === 0 || todayIn(timeZone, v.createdAt) <= date).at(-1)!;
    if (sessionForDate(version, date)) dates.push(date);
  }
  return dates;
}

export const trainedDates = (
  workouts: readonly Pick<WorkoutRecord, 'localDate' | 'status'>[],
  activities: readonly { localDate: string }[] = [],
) => [...workouts.filter(counted).map(w => w.localDate), ...activities.map(a => a.localDate)];

/** The last `count` planned occurrences of a weekday (1 = Monday) were all missed. */
export function lastMissed(trained: readonly string[], planned: readonly string[], weekday: number, count: number) {
  const done = new Set(trained);
  const dates = [...new Set(planned)].filter(date => isoWeekday(date) === weekday).sort();
  return dates.length >= count && dates.slice(-count).every(date => !done.has(date));
}

/** The weekly session on a weekday, when that weekday has its own session (fixed rhythm, not calendar days). */
function weekdayTemplate(version: PlanVersion, weekday: Weekday): SessionTemplate | undefined {
  if (version.trainingDates?.length) return undefined;
  const sessions = weekSchedule(version).sessions;
  const id = sessions.find(session => session.day === weekday)?.templateId;
  // Shortening a session that also runs on another day would change that day too.
  if (!id || sessions.filter(session => session.templateId === id).length !== 1) return undefined;
  return version.templates.find(template => template.id === id);
}

/** A tip's plan change: engine operations, and the same change as a local proposal for a plan without the engine. */
export interface PlanChange {
  proposal: PlanProposal;
  changes: EngineChange[];
}
export interface WeekdayChange extends PlanChange {
  weekday: Weekday;
  minutes: number;
}
function weekdayChange(version: PlanVersion, weekday: Weekday, minutes: number): WeekdayChange | undefined {
  const template = weekdayTemplate(version, weekday);
  const short = template && fitTemplate(template, minutes);
  return (
    short && {
      weekday,
      minutes,
      proposal: withTemplates(version, [short]),
      changes: [{ op: 'shorten', templateId: short.id, minutes }],
    }
  );
}

/**
 * v5 §14 on 今天: the same weekday was missed at least 3 of its last 4 times, and the last 3 in a row, so
 * “最近 3 个周三你都没练上” is true. Offers that day as a 10-minute session.
 */
export function skipDayTip(input: {
  version: PlanVersion;
  versions: readonly PlanVersion[];
  workouts: readonly Pick<WorkoutRecord, 'localDate' | 'status'>[];
  activities?: readonly { localDate: string }[];
  timeZone: string;
  today: string;
}): WeekdayChange | undefined {
  const planned = plannedDates(input.versions, input.timeZone, addDays(input.today, -35), addDays(input.today, -1));
  const trained = trainedDates(input.workouts, input.activities);
  const found = skipPattern(trained, planned);
  if (!found || !lastMissed(trained, planned, found.weekday, 3)) return undefined;
  return weekdayChange(input.version, weekdays[found.weekday - 1]!, 10);
}

// ---------------------------------------------------------------- 上周小结 · 下周怎么调 (G)

export const PAIN_AREAS = ['knee', 'back', 'shoulder', 'wrist', 'other'] as const satisfies readonly Caution[];
const discomfortIn = (workout: Workout): { areas: Caution[]; exerciseIds: string[] } => {
  const events = latestSetFeedback(workout as WorkoutRecord).filter(event => event.effort === 'discomfort');
  const fromFeedback =
    workout.feedback?.reasons.includes('discomfort') || !!workout.feedback?.discomfortExerciseIds?.length;
  return {
    areas: [
      ...events.map(event => event.painArea ?? 'other'),
      ...(fromFeedback && !events.length ? (['other'] as const) : []),
    ],
    exerciseIds: [...events.map(event => event.exerciseId), ...(workout.feedback?.discomfortExerciseIds ?? [])],
  };
};

export type NextWeekTip =
  | { kind: 'pain'; areas: Caution[]; exerciseIds: string[] }
  | ({ kind: 'zero'; target: number } & PlanChange)
  | ({ kind: 'weekday' } & WeekdayChange)
  | ({ kind: 'short'; actual: number; gap: number; minutes: number } & PlanChange)
  | ({ kind: 'overdone'; extra: number; target: number; next: number } & PlanChange)
  | { kind: 'on-track' };

/** Highest weekly frequency the engine plans (daysPerWeek ≤ 6). */
const MAX_WEEKLY = 6;

/** One suggestion per week, in Bo's order: pain › zero › weekday pattern › short › overdone › on track. */
export function nextWeekTip(input: {
  /** Monday to Sunday of last week. */
  from: string;
  to: string;
  done: number;
  target: number;
  today: string;
  timeZone: string;
  version: PlanVersion;
  versions: readonly PlanVersion[];
  workouts: readonly Workout[];
  activities?: readonly { localDate: string }[];
  /** Workouts whose pain already has a follow-up result (pain restrictions saved from the morning check). */
  followedUpWorkoutIds: readonly string[];
  planFirstStart?: string;
  /** 今天 already asked about the missed weekday this week (v5 §14): case 3 is not repeated. */
  weekdayAskedThisWeek: boolean;
}): NextWeekTip | undefined {
  const { from, to, version } = input;
  const lastWeek = input.workouts.filter(w => w.localDate >= from && w.localDate <= to);
  // 1. Pain or single-set discomfort without a follow-up result.
  const open = lastWeek
    .filter(w => w.status !== 'in_progress' && !input.followedUpWorkoutIds.includes(w.id))
    .map(discomfortIn);
  const areas = [...new Set(open.flatMap(row => row.areas))];
  if (areas.length)
    return {
      kind: 'pain',
      areas: PAIN_AREAS.filter(area => areas.includes(area)),
      exerciseIds: [...new Set(open.flatMap(row => row.exerciseIds))],
    };
  // 2. Nothing last week: one 20-minute session.
  if (input.done === 0) {
    const short = version.templates.flatMap(template => fitTemplate(template, 20) ?? []);
    if (version.weeklyTarget > 1 || short.length)
      return {
        kind: 'zero',
        target: version.weeklyTarget,
        proposal: withTemplates(version, short, 1),
        changes: [
          { op: 'frequency', daysPerWeek: 1 },
          { op: 'shorten', minutes: 20 },
        ],
      };
  }
  // 3. Every miss last week fell on one weekday, and the week before too.
  if (!input.weekdayAskedThisWeek) {
    const planned = plannedDates(input.versions, input.timeZone, addDays(from, -7), to);
    const trained = trainedDates(input.workouts, input.activities);
    const missed = [...new Set(planned.filter(date => date >= from && !trained.includes(date)).map(isoWeekday))];
    if (missed.length === 1 && lastMissed(trained, planned, missed[0]!, 2)) {
      const change = weekdayChange(version, weekdays[missed[0]! - 1]!, 20);
      if (change) return { kind: 'weekday', ...change };
    }
  }
  // 4. Sessions ran 10 minutes or more under plan on average.
  const timed = lastWeek
    .filter(counted)
    .map(w => {
      const times = workoutTimes(w);
      const planned =
        w.templateSnapshot?.estimatedMinutes ?? version.templates.find(t => t.id === w.templateId)?.estimatedMinutes;
      return { actual: trainingMinutes(workoutSeconds(times.startedAt, times.endedAt)), planned };
    })
    .filter((row): row is { actual: number; planned: number } => row.actual > 0 && row.planned !== undefined);
  if (timed.length) {
    const actual = Math.round(timed.reduce((sum, row) => sum + row.actual, 0) / timed.length);
    const gap = Math.round(timed.reduce((sum, row) => sum + row.planned, 0) / timed.length) - actual;
    if (gap >= 10) {
      const minutes = clampMinutes(actual + 5);
      const short = version.templates.flatMap(t =>
        t.estimatedMinutes > minutes ? (fitTemplate(t, minutes) ?? []) : [],
      );
      if (short.length)
        return {
          kind: 'short',
          actual,
          gap,
          minutes,
          proposal: withTemplates(version, short),
          changes: short.map(t => ({ op: 'shorten' as const, templateId: t.id, minutes })),
        };
    }
  }
  // 5. More than planned, past the first two weeks, and no discomfort in the last two weeks.
  const recent = input.workouts.filter(w => w.localDate >= addDays(input.today, -14));
  if (
    input.target > 0 &&
    input.done > input.target &&
    input.target < MAX_WEEKLY &&
    !!input.planFirstStart &&
    from >= addDays(input.planFirstStart, 14) &&
    !recent.some(w => discomfortIn(w).areas.length)
  )
    return {
      kind: 'overdone',
      extra: input.done - input.target,
      target: input.target,
      next: input.target + 1,
      proposal: withTemplates(version, [], input.target + 1),
      changes: [{ op: 'frequency', daysPerWeek: input.target + 1 }],
    };
  // 6. Right on target.
  if (input.target > 0 && input.done === input.target) return { kind: 'on-track' };
  return undefined;
}

// ---------------------------------------------------------------- muscle-map tips (v5 §8)

const WORK_BLOCKS = new Set(['main', 'accessory']);
const isWork = (item: PlannedItem) => !item.prescription || WORK_BLOCKS.has(item.prescription.block);
/** Sets one exercise may reach after a tip; keeps within the engine's per-exercise range. */
const MAX_ITEM_SETS = 4;
const engineById = exerciseById;
const patternOf = (exerciseId: string) => engineById.get(exerciseId)?.primary_pattern;
const isPush = (id: string) => /^push_/.test(patternOf(id) ?? '');
const isPull = (id: string) => /^pull_/.test(patternOf(id) ?? '');
const isRow = (id: string) => patternOf(id) === 'pull_horizontal';

/** Adds `sets` to today's matching exercises (one more each, in turn), else brings one in from another session. */
function addSets(
  version: PlanVersion,
  template: SessionTemplate,
  matches: (exerciseId: string) => boolean,
  sets: number,
): { template: SessionTemplate; changes: EngineChange[] } | undefined {
  const items = template.items.map(item => structuredClone(item));
  const changes: EngineChange[] = [];
  let left = sets;
  const own = items.filter(item => isWork(item) && matches(item.exerciseId));
  while (left > 0 && own.some(item => item.sets < MAX_ITEM_SETS))
    for (const item of own)
      if (left > 0 && item.sets < MAX_ITEM_SETS) {
        item.sets += 1;
        left -= 1;
      }
  if (left > 0) {
    // An exercise of the same plan (already safety-checked for this person) that today's session does not have yet.
    const borrowed = version.templates
      .flatMap(t => t.items)
      .find(item => isWork(item) && matches(item.exerciseId) && !items.some(row => row.exerciseId === item.exerciseId));
    if (borrowed && left <= MAX_ITEM_SETS) {
      items.push({ ...structuredClone(borrowed), sets: left });
      changes.push(
        { op: 'add', templateId: template.id, exerciseId: borrowed.exerciseId },
        { op: 'set_volume', templateId: template.id, exerciseId: borrowed.exerciseId, sets: left },
      );
      left = 0;
    }
  }
  if (left > 0) return undefined;
  items.forEach((item, itemIndex) => {
    if (itemIndex < template.items.length && item.sets !== template.items[itemIndex]!.sets)
      changes.unshift({ op: 'set_volume', templateId: template.id, itemIndex, sets: item.sets });
  });
  return {
    template: { ...template, items, estimatedMinutes: Math.min(120, estimatePlannedMinutes(items, 10)) },
    changes,
  };
}

export type MuscleTip = ({ kind: 'gap'; group: MuscleGroup; sets: number } | { kind: 'push-pull' }) & {
  template: SessionTemplate;
} & PlanChange;

/** Groups the plan works on purpose: primary groups of its main and accessory exercises. */
const planGroups = (version: PlanVersion) =>
  new Set(
    version.templates.flatMap(t =>
      t.items.filter(isWork).flatMap(item => exerciseMuscleGroups(item.exerciseId).primary),
    ),
  );

/** Push sets at least this many above pull sets this week counts as “推的比拉的多不少”. */
export const PUSH_PULL_GAP = 4;
/** A week with at least this many groups trained counts as “练得挺全”. */
export const ROUNDED_GROUPS = 4;

/**
 * v5 §8 on 今天练这里, one tip at most: a group the plan works is still short this week (and the week is otherwise
 * well-rounded), else push sets clearly outnumber pull sets. Each tip changes today's session only.
 */
export function muscleTip(input: {
  version: PlanVersion;
  templateId: string;
  weekLoads: readonly MuscleLoad[];
  /** Completed sets this week, by exercise. */
  weekSets: readonly { exerciseId: string; completedSets: number }[];
}): MuscleTip | undefined {
  const template = input.version.templates.find(t => t.id === input.templateId);
  // A yoga session follows its own pose sequence; muscle-set tips never add to it.
  if (!template || isYogaSession(template)) return undefined;
  const trained = input.weekLoads.filter(load => load.sets > 0).length;
  if (trained >= ROUNDED_GROUPS) {
    const groups = planGroups(input.version);
    const short = input.weekLoads
      .filter(load => groups.has(load.group) && load.sets < MUSCLE_LOAD_THRESHOLDS.okMin)
      .sort((a, b) => a.sets - b.sets);
    for (const load of short) {
      const sets = Math.min(4, Math.ceil(MUSCLE_LOAD_THRESHOLDS.okMin - load.sets));
      const changed = addSets(
        input.version,
        template,
        id => exerciseMuscleGroups(id).primary.includes(load.group),
        sets,
      );
      if (changed)
        return {
          kind: 'gap',
          group: load.group,
          sets,
          template: changed.template,
          proposal: withTemplates(input.version, [changed.template]),
          changes: changed.changes,
        };
    }
  }
  const total = (match: (id: string) => boolean) =>
    input.weekSets.filter(row => match(row.exerciseId)).reduce((sum, row) => sum + row.completedSets, 0);
  if (total(isPush) - total(isPull) >= PUSH_PULL_GAP) {
    const changed = addSets(input.version, template, isRow, 1);
    if (changed)
      return {
        kind: 'push-pull',
        template: changed.template,
        proposal: withTemplates(input.version, [changed.template]),
        changes: changed.changes,
      };
  }
  return undefined;
}

// ---------------------------------------------------------------- monthly goal check (K)

/** Asked once a month: 30 days after the plan started or after the last time it was asked. */
export const GOAL_CHECK_DAYS = 30;
/** Due when 30 days have passed since the later of the plan's first start and the last ask. */
export function goalCheckDue(planFirstStart: string | undefined, asked: string | undefined, today: string) {
  const anchor = [planFirstStart, asked]
    .filter((date): date is string => !!date)
    .sort()
    .at(-1);
  return !!anchor && daysBetween(anchor, today) >= GOAL_CHECK_DAYS;
}
