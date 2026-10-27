import type { SessionTemplate } from '../domain/v8/contracts';
import type { DayPlan, EngineProfile, PipelineContext, SessionDraft } from './contracts';
import { condition, restrictedAdjacentIds, stretchHoldRange, type Exercise, type RuleValue } from './data';
import { isHardEligible } from './candidates';
import { prescribe, type Item } from './dose';
import { estimateSeconds } from './fit';
import { pregnancyStandingCap } from './pregnancy-limits';
import { engineExercises } from './yoga-session';

const REST_BETWEEN_POSES_S = 15;
const HOLD_STEP_S = 5;

/**
 * One yoga session in the fixed sequence of week.day.yoga: one hard-eligible pose per position, then
 * hold time and sets are raised (never past the pose's own dose range) to approach the session length.
 */
export function buildYogaSession(
  day: DayPlan,
  ctx: PipelineContext,
  keep = new Set<string>(),
  skip: (e: Exercise) => boolean = () => false,
): SessionDraft {
  const r = ctx.rules,
    p = ctx.profile,
    source = r.get('week.day.yoga'),
    target = day.minutes * 60;
  const pool = yogaPool(ctx, day.weekday).filter(e => !skip(e));
  const allowed: RuleValue[] = source.slots.filter((slot: RuleValue) => !slot.level || slot.level.includes(p.level));
  let slots = allowed.filter(slot => day.minutes >= slot.session_minutes_min);
  if ((day.balanceRequired || older(ctx)) && !slots.some(slot => slot.family === 'balance'))
    slots = allowed.filter(slot => slots.includes(slot) || slot === allowed.find(s => s.family === 'balance'));
  let items = compose(slots, pool, day, ctx, keep);
  // Positions meant for a slightly longer session join, in sequence order, while the session is still short.
  const later = allowed
    .filter(slot => !slots.includes(slot))
    .sort((a, b) => a.session_minutes_min - b.session_minutes_min);
  for (const slot of later) {
    if (estimateSeconds({ items }, r) >= target * r.get('duration.fit.tolerance').band[0]) break;
    slots = allowed.filter(value => value === slot || slots.includes(value));
    items = compose(slots, pool, day, ctx, keep);
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
function compose(slots: RuleValue[], pool: Exercise[], day: DayPlan, ctx: PipelineContext, keep: Set<string>): Item[] {
  const r = ctx.rules,
    p = ctx.profile,
    used = new Set<string>(),
    items: Item[] = [],
    opening = new Set(['centering', 'warmup', 'sun_salutation']);
  let balancePlaced = false;
  for (const [index, slot] of slots.entries()) {
    // A balance position prefers a yoga pose with a true balance pattern (it counts toward balance days).
    // Only when a balance day or an older user needs one does a non-yoga balance drill fill it; a later
    // balance position stays yoga or is left out.
    const own = pool.filter(e => e.yoga_family === slot.family && !used.has(e.id)),
      balance = own.filter(e => e.primary_pattern === 'balance'),
      drills = pool.filter(e => !e.yoga_family && e.primary_pattern === 'balance' && !used.has(e.id)),
      needsBalance = !balancePlaced && (day.balanceRequired || older(ctx)),
      balanceChoices = balance.length
        ? balance
        : needsBalance && drills.length
          ? drills
          : own.length || balancePlaced
            ? own
            : drills,
      // Folds close the floor part of the class: seated folds first, so nobody stands up again.
      folds = own.filter(e => e.position.some(position => position !== 'standing')),
      // No resting pose allowed (supine in pregnancy, floor work, no mat): a calm centering pose closes the class.
      centering = pool.filter(e => e.yoga_family === 'centering' && !used.has(e.id)),
      choices = (
        slot.family === 'balance'
          ? balanceChoices
          : slot.family === 'forward_fold' && folds.length
            ? folds
            : slot.family === 'rest' && !own.length
              ? centering
              : own
      )
        // Older users get down to the floor once: the opening stays standing or seated.
        .filter(e => !older(ctx) || !opening.has(slot.family) || !floorBased(e, ctx))
        .sort((a, b) => a.difficulty - b.difficulty || a.slug.localeCompare(b.slug, 'en'));
    if (!choices.length) continue;
    // Easier poses first for beginners; the week rotates through them so days differ.
    const easy = choices.filter(e => e.difficulty <= (p.level === 'beginner' ? 2 : 3)),
      list = easy.length ? easy : choices,
      // A rebuilt session (today's adjustment) keeps the poses it already had.
      pick =
        choices.find(e => keep.has(e.id)) ??
        list.find(e => e.slug === slot.prefer) ??
        list[(day.index + index) % list.length];
    used.add(pick.id);
    if (slot.family === 'balance') balancePlaced = true;
    items.push(prescribePose(pick, slot.block, slot.pos, ctx));
  }
  // Floor poses form one consecutive block for older users (older.floor.transitions); the sequence is kept otherwise.
  if (older(ctx)) {
    const floor = items.filter(item => floorBased(r.byExercise.get(item.exerciseId)!, ctx));
    items.splice(0, items.length, ...items.filter(item => !floor.includes(item)), ...floor);
  }
  fitYoga(items, day.minutes * 60, r.get('week.day.yoga'), ctx);
  return items;
}

/** Every eligible yoga pose; balance falls back to any eligible balance drill (e.g. supported stands for older users). */
function yogaPool(ctx: PipelineContext, weekday: DayPlan['weekday']): Exercise[] {
  const p = ctx.profile,
    adjacent = restrictedAdjacentIds(ctx.plan?.templates ?? [], weekday, ctx.rules);
  return engineExercises(ctx.rules, 'yoga').filter(
    e =>
      (e.yoga_family || e.primary_pattern === 'balance') &&
      e.default_dose[p.level] &&
      !adjacent.has(e.id) &&
      isHardEligible(e, p, ctx.gate, ctx),
  );
}

/** One pose at its starting hold in a yoga position. */
function prescribePose(
  pick: Exercise,
  block: NonNullable<Item['prescription']>['block'],
  pos: string,
  ctx: PipelineContext,
): Item {
  const item = prescribe(pick, ctx.profile, ctx.rules, ctx.gate.restrictions, block, 1),
    hold = holdRange(pick, ctx);
  if (hold && 'durationSeconds' in item.target)
    item.target = { ...item.target, durationSeconds: Math.min(item.target.durationSeconds, hold[0]) };
  item.prescription = { ...item.prescription!, sourcePosition: pos, restSeconds: REST_BETWEEN_POSES_S };
  return item;
}

/** A swap inside a yoga session stays in the same pose family, position and set count. */
export function substituteYogaPose(item: Item, excluded: Set<string>, ctx: PipelineContext): Item | undefined {
  const r = ctx.rules,
    pos = item.prescription!.sourcePosition!,
    family = r.get('week.day.yoga').slots.find((slot: RuleValue) => slot.pos === pos)?.family,
    level = r.byExercise.get(item.exerciseId)?.difficulty ?? 1;
  const pick = yogaPool(ctx, ctx.currentWeekday)
    .filter(
      e => !excluded.has(e.id) && (family === 'balance' ? e.primary_pattern === 'balance' : e.yoga_family === family),
    )
    .sort(
      (a, b) => Math.abs(a.difficulty - level) - Math.abs(b.difficulty - level) || a.slug.localeCompare(b.slug, 'en'),
    )[0];
  if (!pick) return undefined;
  const next = prescribePose(pick, item.prescription!.block, pos, ctx);
  next.sets = Math.min(item.sets, pick.default_dose[ctx.profile.level]?.sets?.[1] ?? item.sets);
  return next;
}

/** A pose the person chose for a yoga position, prescribed like the sequence; undefined when not an eligible pose. */
export function chosenYogaItem(item: Item, exerciseId: string, ctx: PipelineContext): Item | undefined {
  const pick = yogaPool(ctx, ctx.currentWeekday).find(e => e.id === exerciseId);
  if (!pick || !item.prescription?.sourcePosition) return undefined;
  const next = prescribePose(pick, item.prescription.block, item.prescription.sourcePosition, ctx);
  next.sets = Math.max(1, Math.min(item.sets, pick.default_dose[ctx.profile.level]?.sets?.[1] ?? 1));
  return next;
}

/**
 * After next-week targets or a plan edit: a pose never holds past its own range, and the session stays near its
 * length (grown holds come back first, then extra sets). Mutates the template.
 */
export function settleYogaSession(template: SessionTemplate, p: EngineProfile, ctx: PipelineContext) {
  const r = ctx.rules,
    items = template.items as Item[],
    target = (template.targetMinutes ?? p.sessionMinutes) * 60,
    band = r.get('duration.fit.tolerance').band[1],
    total = () => estimateSeconds({ items }, r),
    range = (item: Item): [number, number] | undefined => {
      const e = r.byExercise.get(item.exerciseId),
        hold = e && holdRange(e, ctx),
        // Pregnancy caps a static standing hold per set (per side counts twice).
        cap = e && pregnancyStandingCap(e, p, r),
        side = item.prescription?.perSide || e?.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
      return hold && cap !== undefined
        ? [Math.min(hold[0], Math.floor(cap / side)), Math.min(hold[1], Math.floor(cap / side))]
        : hold;
    },
    hold = (item: Item) => ('durationSeconds' in item.target ? item.target.durationSeconds : 0);
  for (const item of items) {
    const max = range(item)?.[1];
    if (max && 'durationSeconds' in item.target && item.target.durationSeconds > max)
      item.target = { ...item.target, durationSeconds: max };
  }
  const work = items.filter(item => item.prescription?.sourcePosition !== 'yoga_rest');
  while (total() > target * band) {
    const grown = work.filter(item => hold(item) > (range(item)?.[0] ?? Infinity)).sort((a, b) => hold(b) - hold(a))[0];
    if (grown && 'durationSeconds' in grown.target) {
      grown.target = { ...grown.target, durationSeconds: Math.max(range(grown)![0], hold(grown) - HOLD_STEP_S) };
      continue;
    }
    const extra = work.filter(item => item.sets > 1).sort((a, b) => b.sets - a.sets)[0];
    if (!extra) break;
    extra.sets--;
  }
  template.estimatedSeconds = total();
  template.estimatedMinutes = Math.max(1, Math.ceil(template.estimatedSeconds / 60));
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
