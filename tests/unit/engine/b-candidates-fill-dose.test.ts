import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { describe, it, expect } from 'vitest';
import { Rules, type Exercise } from '../../../src/engine/data';
import { createContext, generatePlan } from '../../../src/engine/pipeline';
import { candidatesFor, isHardEligible } from '../../../src/engine/candidates';
import { fillSlots } from '../../../src/engine/fill';
import { assignDose, credit, volumeLimits } from '../../../src/engine/dose';
import type { Scorer, Slot } from '../../../src/engine/contracts';
import { fixtureProfile, planFixture, typicalProfiles } from './fixtures';
const rules = new Rules(),
  base = rules.data.exercises.find(e => e.slug === 'walking')!;
const slot: Slot = {
  id: 'test',
  role: 'conditioning',
  patterns: ['cardio_cyclic'],
  priority: 1,
  optional: false,
  sourceRuleId: 'select.pipeline',
};
const fake = (id: string, changes: Partial<Exercise> = {}): Exercise => ({
  ...structuredClone(base),
  id,
  ladder: { id: null, step: 1 },
  ...changes,
});
function context(exercises: Exercise[], profile = fixtureProfile) {
  return createContext(profile, 0, new Rules({ ...rules.data, exercises }));
}
const scorer: Scorer = {
  score: () => ({ quality: 0, perRule: [], advice: [] }),
  marginal: (_p, c) => (c.item?.exerciseId === 'best' ? 10 : 0),
};
describe('B hard candidates and greedy filling', () => {
  it('scores every safe option, uses marginal gain and never repeats within a session', () => {
    const ctx = context([fake('a'), fake('best')]);
    const result = fillSlots([slot, { ...slot, id: 'two' }, { ...slot, id: 'three' }], ctx, scorer);
    expect(result.items.map(i => i.exerciseId)).toEqual(['best', 'a']);
  });
  it('selects higher priority first while retaining authored workout order', () => {
    const ctx = context([fake('a'), fake('best')]);
    const result = fillSlots(
      [
        { ...slot, id: 'warmup', priority: 0 },
        { ...slot, id: 'main', priority: 10 },
      ],
      ctx,
      scorer,
    );
    expect(result.items.map(i => i.prescription?.sourcePosition)).toEqual(['warmup', 'main']);
    expect(result.items[1].exerciseId).toBe('best');
  });
  it('reuses an immutable per-slot marginal baseline without freezing the caller plan', () => {
    const ctx = context([fake('a'), fake('best')]);
    ctx.plan = planFixture();
    const baselines = new WeakMap<object, string>(),
      seen = new Set<object>(),
      values: number[] = [];
    const caching: Scorer = {
      ...scorer,
      marginal: (plan, change, profile, source) => {
        expect(Object.isFrozen(plan)).toBe(true);
        const snapshot = JSON.stringify(plan);
        expect(baselines.get(plan) ?? snapshot).toBe(snapshot);
        baselines.set(plan, snapshot);
        seen.add(plan);
        const first = scorer.marginal(plan, change, profile, source),
          second = scorer.marginal(plan, change, profile, source);
        expect(first).toBe(second);
        values.push(first);
        return second;
      },
    };
    const result = fillSlots([slot, { ...slot, id: 'two' }], ctx, caching);
    expect(result.items.map(i => i.exerciseId)).toEqual(['best', 'a']);
    expect(seen.size).toBe(2);
    expect(values).toHaveLength(3);
    expect(Object.isFrozen(ctx.plan)).toBe(false);
  });
  it('has seeded repeatable ties and variant diversity', () => {
    const exercises = [fake('a'), fake('b')],
      zero = { ...scorer, marginal: () => 0 };
    const choose = (variant: number) => {
      const ctx = context(exercises);
      const actual = createContext(ctx.profile, variant, ctx.rules);
      return fillSlots([slot], actual, zero).items[0].exerciseId;
    };
    expect(choose(0)).toBe(choose(0));
    expect(new Set(Array.from({ length: 12 }, (_, i) => choose(i))).size).toBe(2);
  });
  it('accepts equipment alternatives but respects every required component', () => {
    const e = fake('alt', {
        equipment_required: ['dumbbell'],
        equipment_alternatives: { dumbbell: ['water-bottles'] },
      }),
      p = { ...fixtureProfile, equipment: ['water-bottles'] as const };
    const ctx = context([e], { ...p, equipment: [...p.equipment] });
    expect(candidatesFor(slot, ctx.profile, ctx.gate, ctx)).toHaveLength(1);
    e.equipment_required.push('flat-bench');
    const missing = context([e], ctx.profile);
    expect(candidatesFor(slot, missing.profile, missing.gate, missing)).toEqual([]);
  });
  it.each([
    { noise: 1 },
    { space: 'large' },
    { flags: ['jumping'] },
    { flags: ['heavy_axial_load'] },
    { position: ['kneeling'] },
    { difficulty: 5 },
  ])('never loosens hard filters in fallback: %j', changes => {
    const profile = {
      ...fixtureProfile,
      trainingAgeWeeks: 0,
      constraints: { noJump: true, quiet: true, space: 'mat' as const },
      preferences: { excludedExerciseIds: [], cannotDo: ['kneeling' as const] },
    };
    const e = fake('excluded', changes);
    const ctx = context([e], profile);
    expect(candidatesFor({ ...slot, patterns: ['hinge'] }, profile, ctx.gate, ctx)).toEqual([]);
  });
  it('retains complete-pool hard eligibility across typical populations and joint restrictions', () => {
    for (const profile of typicalProfiles) {
      const ctx = createContext(profile);
      for (const candidate of candidatesFor(slot, profile, ctx.gate, ctx)) {
        expect(isHardEligible(candidate, profile, ctx.gate, ctx)).toBe(true);
      }
    }
  });
  it('produces an actual late pregnancy quiet knee-caution class with only two safe exercises', () => {
    const profile = baseProfile({
      ...fixtureProfile,
      population: {
        kind: 'pregnant' as const,
        week: 32,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 32,
      },
      cautions: ['knee' as const],
      constraints: { noJump: true, quiet: true, space: 'mat' as const },
    });
    const full = createContext(profile),
      safe = candidatesFor(slot, profile, full.gate, full).slice(0, 2);
    expect(safe.length).toBeGreaterThan(0);
    const ctx = context(safe, profile),
      draft = fillSlots([slot, { ...slot, id: 'two' }, { ...slot, id: 'three' }], ctx, scorer);
    expect(draft.items).toHaveLength(safe.length);
    expect(new Set(draft.items.map(i => i.exerciseId)).size).toBe(safe.length);
  });
  it('handles one or two safe candidates and a real zero-pool without inventing a gate', () => {
    for (const count of [0, 1, 2]) {
      const ctx = context(Array.from({ length: count }, (_, i) => fake(`safe-${i}`)));
      const status = ctx.gate.status;
      expect(fillSlots([slot, { ...slot, id: 'second' }], ctx, scorer).items).toHaveLength(count);
      expect(ctx.gate.status).toBe(status);
    }
  });
  it('fails closed with empty_plan when the catalogue is artificially cleared without inventing a health gate', () => {
    const profile = structuredClone(fixtureProfile),
      before = structuredClone(profile),
      missing = new Rules({ ...rules.data, exercises: [] }),
      ctx = createContext(profile, 0, missing);
    expect(ctx.gate.status).not.toBe('blocked');
    expect(ctx.gate.reasons.some(g => g.status === 'blocked')).toBe(false);
    expect(() => generatePlan(profile, { rules: missing })).toThrow(
      /No hard-safe generation checkpoint at availability-return: empty_plan/,
    );
    expect(profile).toEqual(before);
  });
  it('returns a nonempty hard-safe plan with the real complete catalogue', () => {
    const result = generatePlan(fixtureProfile, { rules });
    expect(result.templates.length).toBeGreaterThan(0);
    expect(result.templates.every(t => t.items.length > 0)).toBe(true);
    expect(result.quality?.issues.some(issue => issue.severity === 'error')).toBe(false);
    expect(result.gates.some(g => g.status === 'blocked')).toBe(false);
  });
  it('exports a complete hard pool independently of role matching, used IDs and used ladders', () => {
    const exercises = [
      fake('safe', { use: ['cooldown'], ladder: { id: 'used', step: 1 } }),
      fake('noisy', { noise: 1 }),
      fake('excluded'),
    ];
    const profile = {
        ...fixtureProfile,
        constraints: { ...fixtureProfile.constraints, quiet: true },
        preferences: {
          ...fixtureProfile.preferences,
          excludedExerciseIds: ['excluded'],
        },
      },
      ctx = context(exercises, profile);
    ctx.usedIds.add('safe');
    ctx.usedLadders.add('used');
    expect(exercises.filter(e => isHardEligible(e, profile, ctx.gate, ctx)).map(e => e.id)).toEqual(['safe']);
    expect(candidatesFor(slot, profile, ctx.gate, ctx)).toEqual([]);
    expect(isHardEligible(exercises[0], profile, { ...ctx.gate, status: 'blocked' }, ctx)).toBe(false);
  });
  it('honors gate positions, flags, explicit exclusions and used ladders', () => {
    const ctx = context([
      fake('a', { position: ['supine'] }),
      fake('b', { flags: ['overhead_load'] }),
      fake('c'),
      fake('d', { ladder: { id: 'used', step: 1 } }),
    ]);
    ctx.gate.restrictions.excludePositions = ['supine'];
    ctx.gate.restrictions.excludeFlags = ['overhead_load'];
    ctx.profile.preferences.excludedExerciseIds = ['c'];
    ctx.usedLadders.add('used');
    expect(candidatesFor(slot, ctx.profile, ctx.gate, ctx)).toEqual([]);
  });
});
describe('B source doses', () => {
  const lift: Exercise = {
    ...rules.data.exercises.find(
      e => e.metricType === 'reps_load' && e.modality === 'strength' && e.difficulty <= 2 && !e.flags.length,
    )!,
    equipment_required: ['none'],
  };
  function draft(ctx: ReturnType<typeof context>) {
    return fillSlots([{ ...slot, role: 'main', patterns: [lift.primary_pattern] }], ctx, scorer);
  }
  it('uses a positive supplied weight or registered relative-load copy, never zero kg', () => {
    for (const load of [undefined, 12]) {
      const p = {
          ...fixtureProfile,
          equipmentLoadsKg: load ? { [lift.id]: load } : undefined,
        },
        ctx = context([lift], p);
      const result = assignDose(draft(ctx), p, ctx.gate, ctx.rules, ctx).items[0];
      if (load)
        expect(result.target).toMatchObject({
          metricType: 'reps_load',
          loadGrams: 12000,
        });
      else {
        expect(result.target.metricType).toBe('reps');
        expect(result.prescription?.loadDescription).toEqual(rules.text('meta.copy.load_light'));
      }
    }
  });
  it('caps session volume and introductory weekly volume using prior days', () => {
    const profile = {
        ...fixtureProfile,
        trainingAgeWeeks: 0,
        level: 'beginner' as const,
      },
      ctx = context([lift], profile),
      first = assignDose(draft(ctx), profile, ctx.gate, ctx.rules, ctx),
      limit = volumeLimits(profile, ctx.rules).max;
    ctx.plan = {
      ...planFixture(),
      templates: [
        {
          ...first,
          id: 'previous',
          items: first.items.map(i => ({ ...i, sets: 100 })),
        },
      ],
    };
    const next = assignDose(first, profile, ctx.gate, ctx.rules, ctx);
    expect(next.items).toHaveLength(0);
    for (const item of first.items) {
      expect(item.sets).toBeLessThanOrEqual(2);
      for (const amount of Object.values(credit(item, ctx.rules))) expect(amount).toBeLessThanOrEqual(limit);
    }
  });
  it('uses prescribed sets instead of treating a placeholder one-set fill as a source dose', () => {
    const profile = {
        ...fixtureProfile,
        trainingAgeWeeks: 30,
        level: 'intermediate' as const,
      },
      ctx = context([lift], profile),
      input = draft(ctx);
    input.items[0].sets = 1;
    expect(assignDose(input, profile, ctx.gate, ctx.rules, ctx).items[0].sets).toBeGreaterThan(1);
  });
});
