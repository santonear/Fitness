/** Page logic for the training-plan upgrade (UIUX20261008 V9.14). Pure functions; everything stays on this device. */
import type {
  BodyChangeEvent,
  BodyChangeKind,
  Route,
  FigureShape,
  FitnessTestItem,
  FitnessTestRecord,
  LiftEntry,
  MuscleLoad,
  NowMinutes,
  SessionMuscleFocus,
  SetEntry,
} from '../../../domain/plan-upgrade';
import { FITNESS_TEST_ITEMS, MUSCLE_GROUP_NAMES } from '../../../domain/plan-upgrade';
import { addDays, daysBetween } from '../../../domain/local-date';
import { fillLine, yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { steadyStarterCopy } from '../../../i18n/features/coach/yaya-steady-starter';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { binarySex, type BodyValues } from '../../../domain/body-profile';

type Locale = 'zh' | 'en';
type Sex = 'male' | 'female';

/** 资料性别优先；“不愿透露”或未填时用上次的男 / 女切换，初始男。 */
export function figureSex(biologicalSex: BodyValues['biologicalSex'], lastToggle: Sex | undefined): Sex {
  return binarySex(biologicalSex) ?? lastToggle ?? 'male';
}

export function figureShape(
  values: { heightCm?: number; weightKg?: number; waistCm?: number } | undefined,
  sex: Sex,
  latestWeightKg?: number,
): FigureShape {
  const weightKg = latestWeightKg ?? values?.weightKg;
  return {
    sex,
    ...(values?.heightCm ? { heightCm: values.heightCm } : {}),
    ...(weightKg ? { weightKg } : {}),
    ...(values?.waistCm ? { waistCm: values.waistCm } : {}),
  };
}

interface WeightRow {
  localDate: string;
  weightGrams: number;
}
const sorted = (rows: readonly WeightRow[]) => [...rows].sort((a, b) => a.localDate.localeCompare(b.localDate));

/** The earlier weight for the dashed outline: the record closest to a month before the latest one (at least 3 weeks earlier). */
export function ghostWeight(rows: readonly WeightRow[]): WeightRow | undefined {
  const all = sorted(rows),
    last = all.at(-1);
  if (!last) return undefined;
  const before = (row: WeightRow) => daysBetween(row.localDate, last.localDate);
  return all.filter(row => before(row) >= 21).sort((a, b) => Math.abs(before(a) - 30) - Math.abs(before(b) - 30))[0];
}

export const monthLabel = (localDate: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
    month: locale === 'zh' ? 'numeric' : 'short',
    timeZone: 'UTC',
  })
    .format(new Date(`${localDate}T00:00:00Z`))
    .replace(/^(\d+)$/, '$1 月');

interface WorkoutLike {
  localDate: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  sets: readonly { exerciseId: string }[];
}
const counted = (w: WorkoutLike) => w.status === 'complete' || w.status === 'partial';

/** Completed sets per exercise this week, for weeklyMuscleLoad. */
export function weekSetEntries(workouts: readonly WorkoutLike[], weekDates: readonly string[]): SetEntry[] {
  const counts = new Map<string, number>();
  for (const workout of workouts)
    if (counted(workout) && weekDates.includes(workout.localDate))
      for (const set of workout.sets) counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
  return [...counts].map(([exerciseId, completedSets]) => ({ exerciseId, completedSets }));
}

export function usedMinutes(workouts: readonly WorkoutLike[], weekDates: readonly string[]) {
  return workouts
    .filter(w => counted(w) && weekDates.includes(w.localDate) && w.endedAt)
    .reduce((sum, w) => sum + Math.max(0, Math.round((Date.parse(w.endedAt!) - Date.parse(w.startedAt)) / 60000)), 0);
}

/** v5 §1: which "welcome back" line to show. The number of days is never shown. */
export function returnLine(workouts: readonly WorkoutLike[], today: string): 'returnHello' | 'returnEasy' | undefined {
  const last = workouts
    .filter(counted)
    .map(w => w.localDate)
    .sort()
    .at(-1);
  if (!last) return undefined;
  const gap = daysBetween(last, today);
  return gap >= 14 ? 'returnHello' : gap >= 7 ? 'returnEasy' : undefined;
}

/** Typical weekly sets per muscle group, used only to word the gap; the rules line builds the session. */
const WEEKLY_SETS_PER_GROUP = 10;
/** v5 §4: one line for the home panel. */
export function nowCoachLine(
  minutes: NowMinutes,
  exerciseCount: number,
  loads: readonly MuscleLoad[],
  locale: Locale,
): string {
  const y = yayaV5[locale];
  if (minutes === 5 && exerciseCount > 0) return fillLine(y.nowFive, { count: exerciseCount });
  const gap = [...loads]
    .filter(load => load.level === 'low' || load.level === 'none')
    .sort((a, b) => a.sets - b.sets)[0];
  if (!gap) return y.nowAsk;
  const sets = Math.min(4, Math.max(1, Math.ceil(WEEKLY_SETS_PER_GROUP - gap.sets)));
  const name = MUSCLE_GROUP_NAMES[gap.group][locale === 'zh' ? 0 : 1];
  return fillLine(y.nowFill, { minutes, group: locale === 'zh' ? name : name.toLowerCase(), sets });
}

/** Tapping an exercise card shows only its groups; otherwise the whole session focus. */
export function shownFocus(
  focus: SessionMuscleFocus,
  exerciseId: string | undefined,
): { primary: SessionMuscleFocus['primary']; secondary: SessionMuscleFocus['secondary'] } {
  if (!exerciseId) return { primary: focus.primary, secondary: focus.secondary };
  const groups = focus.byExercise[exerciseId] ?? [];
  return {
    primary: groups.filter(g => focus.primary.includes(g)),
    secondary: groups.filter(g => !focus.primary.includes(g)),
  };
}

/** 60 岁以上或稳健路线：加 30 秒坐站，闭眼单脚站换成睁眼扶椅单脚站（Bo 2026-10-25）。 */
export const testItemsFor = (age: number | undefined, steady = false): FitnessTestItem[] => {
  const older = steady || (age ?? 0) >= 60;
  return FITNESS_TEST_ITEMS.filter(item =>
    item === 'chairStand30s' || item === 'singleLegStandChairS'
      ? older
      : item === 'singleLegStandEyesClosedS'
        ? !older
        : true,
  );
};

/** 稳健 lines on 体能自测: chair stands against the last test, the chair-supported stand against the first one. */
export function steadyTestLines(tests: readonly Pick<FitnessTestRecord, 'localDate' | 'results'>[], locale: Locale) {
  const y = steadyStarterCopy[locale],
    byDate = [...tests].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const stands = byDate.flatMap(test => (test.results.chairStand30s === undefined ? [] : [test.results.chairStand30s])),
    balance = byDate.flatMap(test =>
      test.results.singleLegStandChairS === undefined ? [] : [test.results.singleLegStandChairS],
    );
  const [previous, latest] = stands.slice(-2),
    first = balance[0],
    last = balance.at(-1);
  return [
    ...(latest !== undefined && previous !== undefined && latest > previous
      ? [fillLine(y.steadyChairStand, { n: latest, d: latest - previous })]
      : []),
    ...(first !== undefined && last !== undefined && balance.length > 1 && last > first
      ? [fillLine(y.steadyBalance, { a: first, b: last })]
      : []),
  ];
}

/** 稳健 milestones (weeks 4 and 12, and 8 once balance work has moved past stage 1): only in that week and after a workout. */
export function steadyLine(
  input: { planStart?: string; today: string; trained: boolean; balanceStage?: number; minutes: number },
  locale: Locale,
): string {
  const y = steadyStarterCopy[locale],
    days = input.planStart ? daysBetween(input.planStart, input.today) : -1;
  const week = input.trained ? [4, 8, 12].find(n => days >= n * 7 && days < n * 7 + 7) : undefined;
  if (week === 4) return y.steadyWeek4;
  if (week === 8 && (input.balanceStage ?? 1) > 1) return fillLine(y.steadyWeek8, { stage: input.balanceStage! });
  if (week === 12) return y.steadyWeek12;
  return fillLine(y.steadyToday, { minutes: input.minutes });
}

/** v5 §15: the last three workout reminders all went unused. Only asked when reminders are on. */
export function remindersUnused(
  enabled: boolean,
  records: readonly { kind: string; status: string; shownAt: number }[],
): boolean {
  if (!enabled) return false;
  const recent = records
    .filter(r => r.kind === 'workout' && r.status !== 'shown' && r.status !== 'cancelled')
    .sort((a, b) => b.shownAt - a.shownAt)
    .slice(0, 3);
  return recent.length === 3 && recent.every(r => r.status === 'dismissed' || r.status === 'expired');
}

/** Voice cues only through voices that run on this device. */
export function localVoices<T extends { localService: boolean; lang: string }>(
  voices: readonly T[],
  locale: Locale,
): T[] {
  return voices.filter(voice => voice.localService === true && voice.lang.toLowerCase().startsWith(locale));
}

/** 现在有点烦: 4 s in, 6 s out, for 3–5 minutes. Not logged anywhere. */
export function breathingCycles(minutes: number) {
  const clamped = Math.min(5, Math.max(3, Math.round(minutes)));
  return { inhaleSeconds: 4, exhaleSeconds: 6, cycles: clamped * 6, totalSeconds: clamped * 60 };
}
export const breathingPhase = (elapsedSeconds: number) =>
  elapsedSeconds % 10 < 4 ? ('inhale' as const) : ('exhale' as const);

/**
 * Which body-change lines fit the person (v5 §19): postpartum never hears “lighter”; weight lines only for a
 * shape goal in the person's own words or the preset they tapped.
 */
export function bodyRoute(goalText: string | undefined, population: { kind: string } | undefined): Route {
  if (population?.kind === 'postpartum') return 'postpartum';
  return /瘦|减脂|减重|体重|身材|塑形|lose weight|lighter|weight|fat|shape/i.test(goalText ?? '') ? 'shape' : 'health';
}

/** Kinds spoken today stay on screen for the rest of the day; earlier ones count toward the once-a-week rule. */
export const spokenBefore = (spoken: Record<string, string>, today: string): Partial<Record<BodyChangeKind, string>> =>
  Object.fromEntries(Object.entries(spoken).filter(([, date]) => date !== today));

/** Care lines replace praise: with a fast drop or a low BMI nothing else is said. */
export const shownBodyChanges = (events: readonly BodyChangeEvent[]) => {
  const care = events.filter(event => event.kind === 'care-fast-loss' || event.kind === 'care-low-bmi');
  return care.length ? care : events.filter(event => event.kind === 'stronger' || event.kind === 'lighter');
};

/** v5 §19: only events from bodyChangeEvents() are spoken; safety kinds carry no emoji. */
export function bodyChangeLine(
  event: BodyChangeEvent,
  locale: Locale,
  names: { metric: string; from?: string; to?: string; month?: string },
): string | undefined {
  const y = yayaV5[locale],
    amount = Math.abs(Math.round(event.delta * 10) / 10);
  switch (event.kind) {
    case 'stronger':
      return names.from !== undefined && names.to !== undefined
        ? fillLine(y.strongerTest, { item: names.metric, from: names.from, to: names.to })
        : fillLine(y.strongerLift, { exercise: names.metric, kg: amount });
    case 'lighter':
      return fillLine(y.lighter, { kg: amount });
    case 'waist':
      return fillLine(y.waist, { cm: amount, month: names.month ?? '' });
    case 'feel':
      return y.feelSleep;
    case 'care-fast-loss':
      return y.careFast;
    case 'care-low-bmi':
      return y.careLowBmi;
    default:
      return undefined;
  }
}

/** Plausible results per item; anything outside is a typo, not a record. Sit and reach can be negative. */
export const TEST_RANGES: Record<FitnessTestItem, readonly [number, number]> = {
  pushup: [0, 200],
  situp60s: [0, 100],
  sitAndReachCm: [-30, 60],
  singleLegStandEyesClosedS: [0, 300],
  chairStand30s: [0, 60],
  singleLegStandChairS: [0, 300],
};
/** Empty → undefined; a number in range → that number; anything else → 'invalid'. */
export function parseTestValue(item: FitnessTestItem, text: string | undefined): number | 'invalid' | undefined {
  const value = text?.trim() ?? '';
  if (!value) return undefined;
  if (!/^-?\d{1,3}(?:\.\d)?$/.test(value)) return 'invalid';
  const number = Number(value),
    [min, max] = TEST_RANGES[item];
  return number >= min && number <= max ? number : 'invalid';
}

export const testValueText = (item: FitnessTestItem, value: number, locale: Locale) => {
  const unit = planPagesCopy[locale].testUnits[item];
  return unit ? `${value} ${unit}` : String(value);
};

/** Weighted sets from finished workouts, for personal records (local only). */
type LiftSet = { exerciseId: string; reps?: number; loadGrams?: number | null };
export function liftHistory(
  workouts: readonly (Omit<WorkoutLike, 'sets'> & { sets: readonly LiftSet[] })[],
): LiftEntry[] {
  return workouts
    .filter(w => counted(w as WorkoutLike))
    .flatMap(w =>
      w.sets
        .filter(set => (set.loadGrams ?? 0) > 0 && (set.reps ?? 0) > 0)
        .map(set => ({
          exerciseId: set.exerciseId,
          localDate: w.localDate,
          weightKg: set.loadGrams! / 1000,
          reps: set.reps!,
        })),
    );
}
export { addDays as shiftLocalDate };
export const isTestItem = (metric: string): metric is FitnessTestItem =>
  (FITNESS_TEST_ITEMS as readonly string[]).includes(metric);
