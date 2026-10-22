import { expect, it } from 'vitest';
import {
  allocatedVolumeCapacity,
  allocateVolumeBudget,
  assignDose,
  prescribe,
  credit,
  volumeLimits,
} from '../../../src/engine/dose';
import type { PipelineContext, SessionDraft } from '../../../src/engine/contracts';
import { equipmentItemSchema } from '../../../src/engine/contracts';
import { Rules } from '../../../src/engine/data';
import { runGates } from '../../../src/engine/gates';
import { buildWeek } from '../../../src/engine/structure';
import { estimateSeconds } from '../../../src/engine/fit';
import { fixtureProfile } from './fixtures';
import { planFixture } from './fixtures';
const rules = new Rules(),
  profile = { ...fixtureProfile, trainingAgeWeeks: 52, equipment: [...equipmentItemSchema.options] };
const capacity = (p = profile) => allocatedVolumeCapacity(p, runGates(p, rules), rules);
it('uses actual source RT days rather than multiplying all available activity days', () => {
  const p = { ...profile, goal: 'mobility' as const, daysPerWeek: 6 },
    g = runGates(p, rules),
    days = buildWeek(p, g, rules).days;
  const result = allocatedVolumeCapacity(p, g, rules, days);
  expect(result.days.map(day => day.dayId)).toEqual(
    days.filter(day => ['full', 'upper', 'lower'].includes(day.kind)).map(day => day.id),
  );
  expect(result.days).toHaveLength(2);
});
it('preserves fixed budgets and costs real straight prescriptions conservatively in both short and long sessions', () => {
  for (const minutes of [10, 60]) {
    const p = { ...profile, sessionMinutes: minutes },
      result = capacity(p);
    expect(result.days.length).toBeGreaterThan(0);
    for (const day of result.days) {
      expect(day.fixedSeconds).toBeGreaterThan(0);
      const items = day.items.map(value => value.item).filter(item => item.sets > 0);
      if (!items.length) continue;
      expect(day.usedSeconds).toBeLessThanOrEqual(day.targetSeconds);
      expect(estimateSeconds({ items }, rules) + day.fixedSeconds).toBeCloseTo(day.usedSeconds, 8);
      expect(items.every(item => item.prescription?.structure === 'straight')).toBe(true);
    }
  }
  expect(capacity({ ...profile, sessionMinutes: 60 }).totalWorkingSets).toBeGreaterThan(
    capacity({ ...profile, sessionMinutes: 10 }).totalWorkingSets,
  );
});
it('allocates one joint pool of sets and exactly replays primary, secondary and effort credit', () => {
  const result = capacity(),
    totals: Record<string, number> = {};
  let sets = 0;
  for (const day of result.days)
    for (const value of day.items) {
      sets += value.item.sets;
      expect(value.unitCredit).toEqual(credit({ ...value.item, sets: 1 }, rules));
      for (const [group, n] of Object.entries(credit(value.item, rules))) totals[group] = (totals[group] ?? 0) + n;
    }
  expect(sets).toBe(result.totalWorkingSets);
  expect(sets).toBeGreaterThan(0);
  for (const [group, value] of Object.entries(result.byMuscle))
    expect(value).toBe((totals[group] ?? 0) > 0 ? totals[group] : null);
  expect(Object.values(result.byMuscle).some(value => value !== null && value < sets)).toBe(true);
  expect(
    result.days.some(day => day.items.some(value => Object.values(value.unitCredit).some(n => n > 0 && n < 1))),
  ).toBe(true);
});
it('returns unknown rather than zero when the complete legal catalog is unavailable', () => {
  const p = {
      ...profile,
      preferences: { ...profile.preferences, excludedExerciseIds: rules.data.exercises.map(e => e.id) },
    },
    result = capacity(p);
  expect(result.totalWorkingSets).toBe(0);
  expect(Object.values(result.byMuscle).every(value => value === null)).toBe(true);
  expect(result.days.every(day => day.stoppedBy === 'missing_candidates')).toBe(true);
});
it.each(['minimum_dose', 'missing_candidates'] as const)(
  'does not claim complete weekly capacity from a positive partial week: %s',
  mode => {
    const p = { ...profile, sessionMinutes: 60, equipment: [...equipmentItemSchema.options] },
      g = runGates(p, rules),
      days = buildWeek(p, g, rules).days.filter(day => ['full', 'upper', 'lower'].includes(day.kind));
    expect(days.length).toBeGreaterThan(1);
    if (mode === 'minimum_dose') days[1] = { ...days[1], minutes: 10 };
    else days[1] = { ...days[1], sourceDayRuleId: 'week.day.l1', kind: 'lower' };
    const data = structuredClone(rules.data);
    if (mode === 'minimum_dose')
      data.rules
        .find(rule => rule.id === 'duration.capacity.table')!
        .value!.sessions.find((row: { minutes: number }) => row.minutes === 10).warmup = 10;
    if (mode === 'missing_candidates') {
      const dayRule = data.rules.find(rule => rule.id === 'week.day.l1')!;
      dayRule.value!.slots = dayRule.value!.slots.map((slot: { pos: string }) =>
        slot.pos === 'main_1' ? { ...slot, pattern: ['throw_upper'] } : slot,
      );
    }
    const r = new Rules(data),
      result = allocatedVolumeCapacity(p, g, r, days);
    expect(result.totalWorkingSets).toBeGreaterThan(0);
    expect(result.days.some(day => day.stoppedBy === mode)).toBe(true);
    expect(Object.values(result.byMuscle).every(value => value === null)).toBe(true);
    expect(allocateVolumeBudget(p, g, r, days)).toEqual({ weeklyTargets: {}, bySlot: {} });
  },
);
it('uses the same nearest-lower source recipe for a nonstandard session duration', () => {
  const result = capacity({ ...profile, sessionMinutes: 40 });
  for (const day of result.days) {
    expect(day.sourceMinutes).toBe(30);
    expect(
      day.items.every(value =>
        ['M1-main_1', 'SS1-main_2', 'SS1-main_3', 'SS2-acc_1', 'SS2-core_1'].some(suffix =>
          value.item.prescription!.sourcePosition!.endsWith(suffix),
        ),
      ),
    ).toBe(true);
    expect(day.referenceSetLimit).toBe(
      rules.get('duration.capacity.table').sessions.find((row: { minutes: number }) => row.minutes === 30)
        .straight_only_sets,
    );
  }
});
it('does not impose capacity-table reference counts or exercise counts as hard limits', () => {
  const data = structuredClone(rules.data),
    row = data.rules
      .find(rule => rule.id === 'duration.capacity.table')!
      .value!.sessions.find((row: { minutes: number }) => row.minutes === 30);
  row.working_sets = 1;
  row.sets_range = [1, 1];
  row.straight_only_sets = 1;
  row.exercises = 1;
  const modified = new Rules(data),
    g = runGates(profile, modified),
    result = allocatedVolumeCapacity(profile, g, modified);
  expect(result.totalWorkingSets).toBeGreaterThan(result.days.length);
  expect(result.days.some(day => day.items.filter(value => value.item.sets > 0).length > 1)).toBe(true);
  for (const day of result.days) expect(day.referenceSetLimit).toBe(1);
});
it('propagates the actual RIR-four half credit rather than assigning full sets to every primary group', () => {
  const g = runGates(profile, rules);
  g.restrictions.rirMin = 4;
  const result = allocatedVolumeCapacity(profile, g, rules);
  const items = result.days.flatMap(day => day.items);
  expect(items.length).toBeGreaterThan(0);
  for (const value of items) {
    expect(value.item.prescription!.rir[0]).toBeGreaterThanOrEqual(4);
    expect(
      Object.values(value.unitCredit).every(n => n <= rules.get('dose.volume.fractional').set_effort_multiplier.rir_4),
    ).toBe(true);
  }
  expect(items.some(value => Object.values(value.unitCredit).includes(0.5))).toBe(true);
});
it('retains introductory exercise, set, effort, session and whole-week caps', () => {
  const p = { ...profile, trainingAgeWeeks: 0, daysPerWeek: 6, sessionMinutes: 60 },
    g = runGates(p, rules),
    result = allocatedVolumeCapacity(p, g, rules),
    intro = rules.get('progression.new.week_caps').week_1,
    weekly: Record<string, number> = {};
  expect(result.days.length).toBeLessThanOrEqual(intro.rt_sessions_max);
  for (const day of result.days) {
    expect(day.items.length).toBeLessThanOrEqual(intro.exercises_per_session[1]);
    const session: Record<string, number> = {};
    for (const value of day.items) {
      expect(value.item.sets).toBeLessThanOrEqual(intro.sets_per_exercise[1]);
      expect(value.item.prescription!.rir[0]).toBeGreaterThanOrEqual(intro.rir_min);
      for (const [group, n] of Object.entries(credit(value.item, rules))) {
        session[group] = (session[group] ?? 0) + n;
        weekly[group] = (weekly[group] ?? 0) + n;
      }
    }
    for (const n of Object.values(session))
      expect(n).toBeLessThanOrEqual(rules.get('dose.sets_session.cap').per_muscle_fractional_sets_max.beginner);
  }
  for (const n of Object.values(weekly)) expect(n).toBeLessThanOrEqual(volumeLimits(p, rules).max);
});
it('keeps conditioning and required balance time outside the shared strength budget', () => {
  const plain = capacity({ ...profile, goal: 'health', sessionMinutes: 60 }),
    old = {
      ...profile,
      goal: 'health' as const,
      sessionMinutes: 60,
      birthYearMonth: '1956-06',
      population: { kind: 'older_adult' as const, fallsAnswers: [false, false, false, false] },
    };
  for (const day of plain.days) expect(day.fixedSeconds).toBeGreaterThanOrEqual((7 + 4 + 8) * 60 + 180);
  const older = allocatedVolumeCapacity(old, runGates(old, rules), rules);
  for (const day of older.days)
    expect(day.fixedSeconds).toBeGreaterThanOrEqual(
      (7 + 4 + 8) * 60 + 180 + rules.get('session.warmup.balance_older').add_slot.seconds[0],
    );
});
it('is pure and deterministic, and reports no invented capacity for blocked or non-RT weeks', () => {
  const p = structuredClone(profile),
    g = runGates(p, rules),
    before = JSON.stringify([p, g]);
  expect(allocatedVolumeCapacity(p, g, rules)).toEqual(allocatedVolumeCapacity(p, g, rules));
  expect(JSON.stringify([p, g])).toBe(before);
  const blocked = { ...g, status: 'blocked' as const };
  expect(allocatedVolumeCapacity(p, blocked, rules).days).toEqual([]);
  expect(Object.values(allocatedVolumeCapacity(p, g, rules, []).byMuscle).every(value => value === null)).toBe(true);
});
function context(p = profile): PipelineContext {
  return {
    profile: p,
    gate: runGates(p, rules),
    rules,
    variant: 0,
    profileHash: 'manual-budget',
    rng: () => 0,
    trace: [],
    usedIds: new Set(),
    usedLadders: new Set(),
  };
}
function oneSlot(p = profile) {
  const ctx = context(p),
    e = rules.data.exercises.find(
      e =>
        e.modality === 'strength' &&
        e.metricType === 'reps' &&
        e.equipment_required.every(k => k === 'none') &&
        e.use.includes('accessory'),
    )!,
    item = prescribe(e, p, rules, ctx.gate.restrictions, 'accessory');
  item.prescription!.sourcePosition = 'manual-slot';
  const draft: SessionDraft = {
    id: 'manual-day',
    name: 'Manual dose',
    estimatedMinutes: p.sessionMinutes,
    slots: [],
    items: [item],
  };
  return { ctx, e, item, draft };
}
it('sets each measured weekly target to the resolved midpoint clipped to its own jointly allocated credit', () => {
  const g = runGates(profile, rules),
    available = allocatedVolumeCapacity(profile, g, rules),
    budget = allocateVolumeBudget(profile, g, rules),
    range = volumeLimits(profile, rules);
  for (const [group, n] of Object.entries(available.byMuscle)) {
    if (n === null) expect(budget.weeklyTargets[group]).toBeUndefined();
    else expect(budget.weeklyTargets[group]).toBe(Math.min(n, (range.min + range.max) / 2));
  }
  const p = {
    ...profile,
    preferences: { ...profile.preferences, excludedExerciseIds: rules.data.exercises.map(e => e.id) },
  };
  expect(allocateVolumeBudget(p, runGates(p, rules), rules)).toEqual({ weeklyTargets: {}, bySlot: {} });
});
it('distributes only witnessed shared capacity across days and slots while improving the midpoint distance', () => {
  for (const p of [
    profile,
    { ...profile, sessionMinutes: 60 },
    { ...profile, goal: 'muscle' as const, level: 'intermediate' as const, sessionMinutes: 45 },
    { ...profile, trainingAgeWeeks: 0, sessionMinutes: 60 },
  ]) {
    const g = runGates(p, rules),
      available = allocatedVolumeCapacity(p, g, rules),
      budget = allocateVolumeBudget(p, g, rules),
      totals: Record<string, number> = {},
      minimum: Record<string, number> = {};
    let sets = 0;
    for (const day of available.days) {
      const items = day.items
        .filter(value => value.item.sets > 0)
        .map(value => {
          const n = budget.bySlot[value.item.prescription!.sourcePosition!];
          if (n === undefined) return;
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(value.minimumSets);
          expect(n).toBeLessThanOrEqual(value.item.sets);
          sets += n;
          for (const [group, credit] of Object.entries(value.unitCredit)) {
            totals[group] = (totals[group] ?? 0) + credit * n;
            minimum[group] = (minimum[group] ?? 0) + credit * value.minimumSets;
          }
          return { ...value.item, sets: n };
        })
        .filter((item): item is NonNullable<typeof item> => !!item);
      if (items.length)
        expect(estimateSeconds({ items }, rules) + day.fixedSeconds).toBeLessThanOrEqual(day.targetSeconds + 1e-8);
    }
    expect(sets).toBeLessThanOrEqual(available.totalWorkingSets);
    const distance = (counts: Record<string, number>) =>
      Object.entries(budget.weeklyTargets).reduce(
        (n, [group, target]) => n + Math.abs(target - (counts[group] ?? 0)),
        0,
      );
    expect(distance(totals)).toBeLessThanOrEqual(distance(minimum));
  }
});
it('prescribes a typed context slot override rather than reverting to the exercise default', () => {
  const { ctx, e, item, draft } = oneSlot(),
    desired = item.sets === 2 ? 3 : 2;
  ctx.volumeBudget = { weeklyTargets: {}, bySlot: { 'manual-slot': desired } };
  const result = assignDose(draft, profile, ctx.gate, rules, ctx);
  expect(result.items).toHaveLength(1);
  expect(result.items[0].sets).toBe(desired);
  expect(result.items[0].prescription?.sourcePosition).toBe('manual-slot');
  expect(result.items[0].target).toEqual(
    prescribe(e, profile, rules, ctx.gate.restrictions, 'accessory', desired).target,
  );
  expect(result.items[0].prescription?.rir).toEqual(item.prescription?.rir);
});
it('allocates by joint need instead of assigning the same exercise default to every slot', () => {
  const p = { ...profile, sessionMinutes: 60 },
    g = runGates(p, rules),
    capacity = allocatedVolumeCapacity(p, g, rules),
    budget = allocateVolumeBudget(p, g, rules),
    slots = capacity.days.flatMap(day => day.items.filter(value => value.item.sets > 0));
  expect(Object.keys(budget.weeklyTargets).length).toBeGreaterThan(0);
  expect(slots.some(value => budget.bySlot[value.item.prescription!.sourcePosition!] > value.minimumSets)).toBe(true);
  expect(
    slots.some(value => {
      const role = value.item.prescription!.goalRole ?? value.item.prescription!.block,
        defaultItem = prescribe(rules.byExercise.get(value.item.exerciseId)!, p, rules, g.restrictions, role);
      return budget.bySlot[value.item.prescription!.sourcePosition!] !== defaultItem.sets;
    }),
  ).toBe(true);
});
it('keeps the actual assigned witness prescriptions within each slot dose and each daily shared clock', () => {
  for (const p of [
    { ...profile, sessionMinutes: 60 },
    { ...profile, goal: 'strength' as const, level: 'intermediate' as const, sessionMinutes: 60 },
  ]) {
    const ctx = context(p),
      capacity = allocatedVolumeCapacity(p, ctx.gate, rules);
    ctx.volumeBudget = allocateVolumeBudget(p, ctx.gate, rules);
    const plan = planFixture();
    plan.templates = [];
    ctx.plan = plan;
    expect(Object.keys(ctx.volumeBudget.bySlot).length).toBeGreaterThan(0);
    for (const day of capacity.days) {
      const values = day.items.filter(value => value.item.sets > 0),
        draft: SessionDraft = {
          id: day.dayId,
          name: 'Budget witness',
          estimatedMinutes: p.sessionMinutes,
          slots: [],
          items: values.map(value => value.item),
        },
        assigned = assignDose(draft, p, ctx.gate, rules, ctx);
      for (const item of assigned.items) {
        const value = values.find(
          value => value.item.prescription!.sourcePosition === item.prescription!.sourcePosition,
        )!;
        expect(item.sets).toBeLessThanOrEqual(value.item.sets);
        expect(item.sets).toBeLessThanOrEqual(ctx.volumeBudget.bySlot[item.prescription!.sourcePosition!]);
      }
      expect(estimateSeconds(assigned, rules) + day.fixedSeconds).toBeLessThanOrEqual(day.targetSeconds + 1e-8);
      plan.templates.push(assigned);
    }
  }
});
it('preserves the legacy API with no context, no budget or an unmeasured slot', () => {
  const { ctx, draft } = oneSlot(),
    legacy = assignDose(draft, profile, ctx.gate, rules);
  expect(assignDose(draft, profile, ctx.gate, rules, ctx)).toEqual(legacy);
  ctx.volumeBudget = { weeklyTargets: {}, bySlot: {} };
  expect(assignDose(draft, profile, ctx.gate, rules, ctx)).toEqual(legacy);
});
it('cannot use a budget override to bypass introductory per-exercise or remaining weekly caps', () => {
  const p = { ...profile, trainingAgeWeeks: 0 },
    data = oneSlot(p);
  data.ctx.volumeBudget = { weeklyTargets: {}, bySlot: { 'manual-slot': 999 } };
  const first = assignDose(data.draft, p, data.ctx.gate, rules, data.ctx);
  expect(first.items).toHaveLength(1);
  expect(first.items[0].sets).toBeLessThanOrEqual(rules.get('progression.new.week_caps').week_1.sets_per_exercise[1]);
  const plan = planFixture(),
    prior = { ...data.item, sets: volumeLimits(p, rules).max * 2 };
  plan.templates[0].items = [prior];
  data.ctx.plan = plan;
  const next = assignDose(data.draft, p, data.ctx.gate, rules, data.ctx);
  expect(next.items).toEqual([]);
});
