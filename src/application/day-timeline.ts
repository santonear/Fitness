import type { PlannedItem, SessionTemplate, WorkoutRecord } from '../domain/v8/contracts';

/**
 * 今天 › 日视图: the session as an ordered timeline with estimated clock times.
 * Read-only presentation; estimates are scaled to the session's own estimated length so the
 * timeline never disagrees with the minutes shown elsewhere. Nothing here is stored.
 */
export type TimelinePhase = 'warmup' | 'main' | 'cooldown';
interface TimelineStep {
  /** 1-based order shown to the user. */
  number: number;
  /** Index into template.items; absent for the light prepare/stretch steps of plans without warm-up or cool-down items. */
  itemIndex?: number;
  kind: 'item' | 'prepare' | 'stretch';
  phase: TimelinePhase;
  /** Seconds from the planned start. */
  startOffset: number;
  durationSeconds: number;
}
interface SessionTimeline {
  steps: TimelineStep[];
  totalSeconds: number;
}

const TRANSITION_SECONDS = 60,
  DEFAULT_REST_SECONDS = 90,
  PREPARE_SECONDS = 300;
const itemPhase = (item: Pick<PlannedItem, 'prescription'>): TimelinePhase =>
  item.prescription?.block === 'warmup' ? 'warmup' : item.prescription?.block === 'cooldown' ? 'cooldown' : 'main';

/** Raw seconds of one item: same model as the plan duration estimate (reps ×3 s, at least 20 s a set; 90 s rest). */
function itemSeconds(item: Pick<PlannedItem, 'sets' | 'target' | 'prescription'>): number {
  const p = item.prescription,
    target = item.target,
    sides = p?.perSide ? 2 : 1;
  const work =
    target.metricType === 'duration' || target.metricType === 'duration_distance'
      ? target.durationSeconds
      : Math.max(20, target.reps * (p?.secondsPerRep || 3));
  const rest = p ? p.restSeconds : DEFAULT_REST_SECONDS;
  return (
    Math.max(1, item.sets) * work * sides +
    Math.max(0, item.sets - 1) * rest +
    (p?.setupSeconds ?? 0) +
    (p?.warmupSeconds ?? 0)
  );
}

export function sessionTimeline(
  template: Pick<SessionTemplate, 'items' | 'estimatedMinutes' | 'estimatedSeconds'>,
): SessionTimeline {
  const items = template.items;
  const target = Math.max(60, template.estimatedSeconds ?? template.estimatedMinutes * 60);
  const raw = items.map(itemSeconds),
    transitions = Math.max(0, items.length - 1) * TRANSITION_SECONDS;
  const hasWarmup = items.some(item => itemPhase(item) === 'warmup'),
    hasCooldown = items.some(item => itemPhase(item) === 'cooldown');
  // Plans without warm-up/cool-down items get light framing steps only from time the estimate already leaves free.
  let slack = Math.max(0, target - raw.reduce((sum, value) => sum + value, 0) - transitions);
  const prepare = !hasWarmup && items.length ? Math.min(PREPARE_SECONDS, slack) : 0;
  slack -= prepare;
  const stretch = !hasCooldown && items.length ? Math.min(PREPARE_SECONDS, slack) : 0;
  const framing = (prepare >= 60 ? prepare : 0) + (stretch >= 60 ? stretch : 0);
  const available = Math.max(items.length * 30, target - framing - transitions),
    rawSum = raw.reduce((sum, value) => sum + value, 0) || 1;
  const scale = available / rawSum;
  const steps: TimelineStep[] = [];
  let offset = 0;
  const push = (step: Omit<TimelineStep, 'number' | 'startOffset'>) => {
    steps.push({ ...step, number: steps.length + 1, startOffset: offset });
    offset += step.durationSeconds;
  };
  if (prepare >= 60) push({ kind: 'prepare', phase: 'warmup', durationSeconds: Math.round(prepare) });
  items.forEach((item, index) => {
    if (index > 0) offset += TRANSITION_SECONDS;
    push({
      kind: 'item',
      itemIndex: index,
      phase: itemPhase(item),
      durationSeconds: Math.max(30, Math.round(raw[index] * scale)),
    });
  });
  if (stretch >= 60) push({ kind: 'stretch', phase: 'cooldown', durationSeconds: Math.round(stretch) });
  return { steps, totalSeconds: offset };
}

/* ---------- Clock helpers (wall time in the user's time zone) ---------- */
const pad = (value: number) => String(value).padStart(2, '0');
export const clockMinutes = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};
const minutesClock = (minutes: number) => {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
};
export const validClock = (clock: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(clock);
/** HH:MM of an instant in a time zone. */
export function clockIn(timeZone: string, at: Date | string | number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  return `${parts.find(part => part.type === 'hour')?.value ?? '00'}:${parts.find(part => part.type === 'minute')?.value ?? '00'}`;
}
/** Default planned start: now, rounded up to the next 5 minutes. */
export const defaultStartClock = (timeZone: string, now = new Date()) =>
  minutesClock(Math.ceil(clockMinutes(clockIn(timeZone, now)) / 5) * 5);
/** Planned clock of a step: start + offset (rounded to the minute). */
export const stepClock = (startClock: string, offsetSeconds: number) =>
  minutesClock(clockMinutes(startClock) + offsetSeconds / 60);

function zoneOffsetMs(timeZone: string, at: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(at))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  );
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    Math.floor(at / 1000) * 1000
  );
}
/** UTC instant of a wall-clock time on a local date in a time zone. */
export function zonedInstant(date: string, clock: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number),
    [h, mi] = clock.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let at = guess - zoneOffsetMs(timeZone, guess);
  at = guess - zoneOffsetMs(timeZone, at);
  return new Date(at).toISOString();
}

/* ---------- Actual times of a finished workout ---------- */
interface WorkoutTimes {
  startedAt: string;
  endedAt?: string;
  corrected: boolean;
  recorded: { startedAt: string; endedAt?: string };
}
/** Recorded start/end, or the latest user correction (kept beside the record, which stays unchanged). */
export function workoutTimes(workout: Pick<WorkoutRecord, 'startedAt' | 'endedAt' | 'timeCorrections'>): WorkoutTimes {
  const latest = workout.timeCorrections?.at(-1);
  return latest
    ? {
        startedAt: latest.startedAt,
        endedAt: latest.endedAt,
        corrected: true,
        recorded: { startedAt: workout.startedAt, endedAt: workout.endedAt },
      }
    : {
        startedAt: workout.startedAt,
        endedAt: workout.endedAt,
        corrected: false,
        recorded: { startedAt: workout.startedAt, endedAt: workout.endedAt },
      };
}
/** First and last completed-set time of each item of a workout, by item index. */
export function itemActualTimes(workout: Pick<WorkoutRecord, 'sets'>) {
  const times = new Map<number, { first: string; last: string; sets: number }>();
  for (const set of workout.sets) {
    const current = times.get(set.itemIndex);
    if (!current) times.set(set.itemIndex, { first: set.completedAt, last: set.completedAt, sets: 1 });
    else
      times.set(set.itemIndex, {
        first: set.completedAt < current.first ? set.completedAt : current.first,
        last: set.completedAt > current.last ? set.completedAt : current.last,
        sets: current.sets + 1,
      });
  }
  return times;
}
export const durationMinutes = (from: string, to?: string) =>
  to ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000)) : undefined;
