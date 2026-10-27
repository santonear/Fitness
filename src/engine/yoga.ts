import type { DayPlan, PipelineContext, SessionDraft } from './contracts';
import { condition, restrictedAdjacentIds, stretchHoldRange, type Exercise, type RuleValue } from './data';
import { isHardEligible } from './candidates';
import { prescribe, type Item } from './dose';
import { estimateSeconds } from './fit';

const REST_BETWEEN_POSES_S = 15;
const HOLD_STEP_S = 5;

/**
 * One yoga session in the fixed sequence of week.day.yoga: one hard-eligible pose per position, then
 * hold time and sets are raised (never past the pose's own dose range) to approach the session length.
 */
export function buildYogaSession(day: DayPlan, ctx: PipelineContext): SessionDraft {
  const r = ctx.rules,
    p = ctx.profile,
    source = r.get('week.day.yoga'),
    target = day.minutes * 60;
  const adjacent = restrictedAdjacentIds(ctx.plan?.templates ?? [], day.weekday, r);
  // Balance falls back to any eligible balance drill (e.g. supported stands for older users).
  const pool = [...r.data.exercises, ...(r.data.yogaExercises ?? [])].filter(
    e =>
      (e.yoga_family || e.primary_pattern === 'balance') &&
      e.default_dose[p.level] &&
      !adjacent.has(e.id) &&
      isHardEligible(e, p, ctx.gate, ctx),
  );
  const allowed: RuleValue[] = source.slots.filter((slot: RuleValue) => !slot.level || slot.level.includes(p.level));
  let slots = allowed.filter(slot => day.minutes >= slot.session_minutes_min);
  if ((day.balanceRequired || older(ctx)) && !slots.some(slot => slot.family === 'balance'))
    slots = allowed.filter(slot => slots.includes(slot) || slot === allowed.find(s => s.family === 'balance'));
  let items = compose(slots, pool, day, ctx);
  // Positions meant for a slightly longer session join, in sequence order, while the session is still short.
  const later = allowed
    .filter(slot => !slots.includes(slot))
    .sort((a, b) => a.session_minutes_min - b.session_minutes_min);
  for (const slot of later) {
    if (estimateSeconds({ items }, r) >= target * r.get('duration.fit.tolerance').band[0]) break;
    slots = allowed.filter(value => value === slot || slots.includes(value));
    items = compose(slots, pool, day, ctx);
  }
  ctx.rules.trace(ctx.trace, 'week.day.yoga', 'fixed_yoga_sequence', { positions: items.length });
  const seconds = estimateSeconds({ items }, r);
  return {
    id: day.id,
    name: p.locale === 'en' ? 'Yoga' : '瑜伽',
    estimatedMinutes: Math.max(1, Math.ceil(seconds / 60)),
    estimatedSeconds: seconds,
    targetMinutes: day.minutes,
    items,
    slots: [],
  };
}

/** One pose per position in sequence order, then fitted to the session length. */
function compose(slots: RuleValue[], pool: Exercise[], day: DayPlan, ctx: PipelineContext): Item[] {
  const r = ctx.rules,
    p = ctx.profile,
    used = new Set<string>(),
    items: Item[] = [],
    opening = new Set(['centering', 'warmup', 'sun_salutation']);
  for (const [index, slot] of slots.entries()) {
    // The balance position needs a true balance pattern (it counts toward balance days); other yoga
    // balance poses and then any eligible balance drill are the fallbacks.
    const own = pool.filter(e => e.yoga_family === slot.family && !used.has(e.id)),
      balance = own.filter(e => e.primary_pattern === 'balance'),
      drills = pool.filter(e => !e.yoga_family && e.primary_pattern === 'balance' && !used.has(e.id)),
      choices = (slot.family !== 'balance' ? own : balance.length ? balance : drills.length ? drills : own)
        // Older users get down to the floor once: the opening stays standing or seated.
        .filter(e => !older(ctx) || !opening.has(slot.family) || !floorBased(e, ctx))
        .sort((a, b) => a.difficulty - b.difficulty || a.slug.localeCompare(b.slug, 'en'));
    if (!choices.length) continue;
    // Easier poses first for beginners; the week rotates through them so days differ.
    const easy = choices.filter(e => e.difficulty <= (p.level === 'beginner' ? 2 : 3)),
      list = easy.length ? easy : choices,
      pick = list.find(e => e.slug === slot.prefer) ?? list[(day.index + index) % list.length];
    used.add(pick.id);
    const item = prescribe(pick, p, r, ctx.gate.restrictions, slot.block, 1),
      hold = holdRange(pick, ctx);
    if (hold && 'durationSeconds' in item.target)
      item.target = { ...item.target, durationSeconds: Math.min(item.target.durationSeconds, hold[0]) };
    item.prescription = { ...item.prescription!, sourcePosition: slot.pos, restSeconds: REST_BETWEEN_POSES_S };
    items.push(item);
  }
  // Floor poses form one consecutive block for older users (older.floor.transitions); the sequence is kept otherwise.
  if (older(ctx)) {
    const floor = items.filter(item => floorBased(r.byExercise.get(item.exerciseId)!, ctx));
    items.splice(0, items.length, ...items.filter(item => !floor.includes(item)), ...floor);
  }
  fitYoga(items, day.minutes * 60, r.get('week.day.yoga'), ctx);
  return items;
}

const older = (ctx: PipelineContext) => ctx.gate.restrictions.population === 'older_adult';
const floorBased = (e: Exercise, ctx: PipelineContext) =>
  e.requires_floor_transition ?? condition(ctx.rules.get('older.floor.transitions').floor_based_if, e, {});

/** The pose's own hold range, narrowed by the static-stretch source range for static stretches. */
function holdRange(e: Exercise, ctx: PipelineContext): [number, number] | undefined {
  const own = e.default_dose[ctx.profile.level]?.seconds;
  if (!own) return undefined;
  const stretch =
    e.mobility_type === 'static' ? stretchHoldRange(e, ctx.rules, ctx.gate.restrictions.population) : undefined;
  if (!stretch) return [own[0], own[1]];
  const low = Math.max(own[0], stretch[0]),
    high = Math.min(own[1], stretch[1]);
  return low <= high ? [low, high] : stretch;
}

/** Raise holds, then sets, then the closing rest, without exceeding the target or any pose's dose range. */
function fitYoga(items: Item[], target: number, source: RuleValue, ctx: PipelineContext) {
  const r = ctx.rules,
    p = ctx.profile,
    exercise = (item: Item) => r.byExercise.get(item.exerciseId) as Exercise,
    rest = items.at(-1)?.prescription?.sourcePosition === 'yoga_rest' ? items.at(-1) : undefined,
    work = items.filter(item => item !== rest),
    total = () => estimateSeconds({ items }, r);
  // Pregnant users keep the prescribed standing holds; only sets grow.
  const holdsMayGrow = p.population.kind !== 'pregnant';
  const steps: ((item: Item) => boolean)[] = [
    item => {
      const max = holdRange(exercise(item), ctx)?.[1];
      if (!holdsMayGrow || !max || !('durationSeconds' in item.target) || item.target.durationSeconds >= max)
        return false;
      item.target = { ...item.target, durationSeconds: Math.min(max, item.target.durationSeconds + HOLD_STEP_S) };
      return true;
    },
    item => {
      const max = Math.min(source.sets_max, exercise(item).default_dose[p.level]?.sets?.[1] ?? 1);
      if (item.sets >= max) return false;
      item.sets++;
      return true;
    },
  ];
  for (const step of steps) {
    let grew = true;
    while (grew && total() < target) {
      grew = false;
      for (const item of work) {
        if (total() >= target) break;
        const before = structuredClone(item);
        if (!step(item)) continue;
        if (total() > target) Object.assign(item, before);
        else grew = true;
      }
    }
  }
  if (rest && 'durationSeconds' in rest.target) {
    const [min, max] = exercise(rest).default_dose[p.level]?.seconds ?? [rest.target.durationSeconds, 0],
      room = target - total() + rest.target.durationSeconds,
      cap = Math.max(min, Math.min(max, Math.floor((target * source.rest_share_max) / 30) * 30));
    rest.target = { ...rest.target, durationSeconds: Math.max(min, Math.min(cap, room)) };
  }
  // A short session drops optional middle positions until it fits; rest and the opening stay.
  const droppable = () => work.filter((item, index) => index > 0 && exercise(item).primary_pattern !== 'balance');
  while (total() > target * 1.1 && droppable().length > 1) {
    const list = droppable(),
      drop = list[Math.floor(list.length / 2)];
    work.splice(work.indexOf(drop), 1);
    items.splice(items.indexOf(drop), 1);
  }
}
