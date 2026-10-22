import { assertBoundedDuration } from './assert-bounded-duration';
import { describe, it, expect } from 'vitest';
import { createContext, generatePlan } from '../../../src/engine/pipeline';
import { estimateMinutes, fitDuration } from '../../../src/engine/fit';
import { improve } from '../../../src/engine/improve';
import { adjust, substituteItem } from '../../../src/engine/operations';
import { checkHard } from '../../../src/engine/hard-checks';
import { prescribe } from '../../../src/engine/dose';
import { Rules } from '../../../src/engine/data';
import { fixtureProfile, sessionFixture, planFixture } from './fixtures';
describe('C source timing and bounded operations', () => {
  it.each([10, 15, 20, 30, 45, 60, 90])(
    'fits continuous aerobic work to %i minutes without mutating input',
    minutes => {
      const s = sessionFixture(),
        before = structuredClone(s),
        ctx = createContext({ ...fixtureProfile, sessionMinutes: minutes });
      const fitted = fitDuration(s, minutes, ctx);
      const actual = estimateMinutes(fitted, ctx.rules);
      if (minutes <= 45) expect(actual).toBeCloseTo(minutes, 6);
      else {
        expect(actual).toBeLessThanOrEqual(minutes);
        const plan = { ...planFixture(), sessionMinutes: minutes, templates: [fitted] };
        assertBoundedDuration(
          plan,
          ctx.profile,
          ctx.rules,
          actual < minutes * ctx.rules.get('duration.fit.bounds').duration_band[0],
        );
        expect(new Set(fitted.items.map(item => item.exerciseId)).size).toBe(fitted.items.length);
      }
      expect(s).toEqual(before);
      expect(fitted.targetMinutes).toBe(minutes);
    },
  );
  it('counts per-side work, setup, overhead and between-set rest once', () => {
    const r = new Rules(structuredClone(new Rules().data)),
      s = sessionFixture(),
      e = r.byExercise.get(s.items[0].exerciseId)!;
    e.modality = 'strength';
    s.items[0].sets = 2;
    s.items[0].target = { metricType: 'reps', reps: 10 };
    s.items[0].prescription = { ...s.items[0].prescription!, perSide: true, restSeconds: 60, secondsPerRep: 3 };
    const seconds =
      2 *
        (10 * 3 * r.get('session.time.model').per_side_multiplier + r.get('duration.set.overhead').overhead_s_per_set) +
      60 +
      e.time.setup_s +
      r.get('duration.transition.setup').buffer_s;
    expect(estimateMinutes(s, r) * 60).toBeCloseTo(seconds, 8);
  });
  it('rounds per-side timed work to integer seconds without widening timed strength dose', () => {
    const r = new Rules(structuredClone(new Rules().data)),
      s = sessionFixture(),
      e = r.byExercise.get(s.items[0].exerciseId)!;
    s.items[0].prescription!.perSide = true;
    s.items[0].sets = 3;
    const ctx = createContext({ ...fixtureProfile, level: 'intermediate', trainingAgeWeeks: 52 }, 0, r),
      out = fitDuration(s, 20, ctx);
    expect(out.items.every(i => !('durationSeconds' in i.target) || Number.isInteger(i.target.durationSeconds))).toBe(
      true,
    );
    e.modality = 'strength';
    e.default_dose.intermediate = { sets: [1, 1], reps: null, seconds: [15, 30], rir: [4, 4] };
    const single = {
      ...s,
      items: [
        {
          ...s.items[0],
          sets: 1,
          target: { metricType: 'duration' as const, durationSeconds: 20 },
          prescription: { ...s.items[0].prescription!, block: 'main' as const },
        },
      ],
    };
    const fitted = fitDuration(single, 90, { ...ctx, focus: 'core' });
    expect(fitted.items[0].target).toMatchObject({ durationSeconds: 30 });
  });
  it('does not change locked items', () => {
    const s = sessionFixture(),
      ctx = createContext(fixtureProfile);
    ctx.lockedItemIndexes = [0];
    expect(fitDuration(s, 10, ctx).items).toEqual(s.items);
  });
  it('stops local improvement when no score gain exists', () => {
    const plan = planFixture(),
      before = structuredClone(plan),
      ctx = createContext(fixtureProfile),
      score = { quality: 1, perRule: [], advice: [] };
    const out = improve(
      plan,
      ctx,
      {
        score: baseline => {
          expect(Object.isFrozen(baseline)).toBe(true);
          return score;
        },
        marginal: () => 0,
      },
      99,
    );
    expect(out).toEqual(plan);
    expect(Object.isFrozen(plan)).toBe(false);
    expect(Object.isFrozen(out)).toBe(false);
    expect(plan).toEqual(before);
    expect(ctx.trace.filter(t => t.step === 'improve')).toHaveLength(0);
  });
  it('focuses an adjustment on upper body within the requested duration', () => {
    const r = new Rules(),
      s = sessionFixture(),
      p = { ...fixtureProfile, level: 'intermediate' as const, trainingAgeWeeks: 52 };
    const out = adjust(s, p, { focus: 'upper', minutes: 30 }, r);
    expect(out.noop).toBe(false);
    expect(estimateMinutes(out.value, r)).toBeGreaterThanOrEqual(27);
    expect(estimateMinutes(out.value, r)).toBeLessThanOrEqual(33);
    expect(
      out.value.items.every(i =>
        ['push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical', 'isolation_upper'].includes(
          r.byExercise.get(i.exerciseId)!.primary_pattern,
        ),
      ),
    ).toBe(true);
  });
  it.each([10, 20, 45, 90])('generates a legal source-timed real %i minute session', minutes => {
    const p = { ...fixtureProfile, sessionMinutes: minutes, daysPerWeek: 1 },
      plan = generatePlan(p),
      ctx = createContext(p);
    expect(plan.templates.length).toBeGreaterThan(0);
    expect(checkHard(plan, p, ctx.gate, ctx.rules)).toEqual([]);
  });
  it('replaces a carry with a stationary non-squat action', () => {
    const r = new Rules(),
      e = r.data.exercises.find(e => e.primary_pattern === 'carry' && e.equipment_required.includes('dumbbell'))!,
      p = {
        ...fixtureProfile,
        equipment: ['none', 'dumbbell'] as typeof fixtureProfile.equipment,
        level: 'intermediate' as const,
        trainingAgeWeeks: 52,
      },
      item = { ...sessionFixture().items[0], exerciseId: e.id },
      out = substituteItem(item, p, 'dislike', r);
    expect(out.noop).toBe(false);
    expect(['squat', 'lunge', 'carry']).not.toContain(r.byExercise.get(out.value.exerciseId)!.primary_pattern);
  });
  it('fills legal working and mobility sets while retaining actual warmup and cooldown', () => {
    const p = {
        ...fixtureProfile,
        level: 'intermediate' as const,
        trainingAgeWeeks: 52,
        daysPerWeek: 1,
        sessionMinutes: 45,
      },
      ctx = createContext(p),
      r = ctx.rules;
    ctx.focus = 'full';
    const item = (slug: string, block: 'warmup' | 'main' | 'cooldown' | 'mobility', sets: number) =>
        prescribe(
          r.data.exercises.find(e => e.slug === slug)!,
          p,
          r,
          ctx.gate.restrictions,
          block,
          sets,
        ),
      warmup = item('walking', 'warmup', 1),
      work = item('bodyweight-squat', 'main', 2),
      cooldown = item('standing-quad-stretch', 'cooldown', 1),
      mobility = item('standing-calf-stretch', 'mobility', 1),
      session = {
        id: 'source-set-regression',
        name: 'Training',
        estimatedMinutes: 45,
        items: [warmup, work, cooldown, mobility],
        slots: [],
      };
    const fitted = fitDuration(session, 45, ctx);
    expect(session.items.map(source => fitted.items.find(i => i.exerciseId === source.exerciseId)?.sets)).toEqual([
      1,
      r.get('duration.fit.bounds').sets_per_exercise_max.intermediate,
      1,
      mobility.sets,
    ]);
    expect(session.items.map(i => i.sets)).toEqual([1, 2, 1, 1]);
    const over = structuredClone(session);
    over.items[1].sets = 4;
    over.items[2].sets = 2;
    over.items[3].sets = 2;
    const shortened = fitDuration(over, 10, { ...ctx, profile: { ...p, sessionMinutes: 10 } });
    expect(shortened.items.filter(i => i.prescription?.block !== 'main').map(i => i.sets)).toEqual([1, 2, 2]);
  });
  it('returns an explicit noop for a blocked adjustment and substitution', () => {
    const p = { ...fixtureProfile, screening: { ...fixtureProfile.screening, symptoms: true } },
      r = new Rules(),
      s = sessionFixture();
    expect(adjust(s, p, { minutes: 15 }, r).noop).toBe(true);
    expect(substituteItem(s.items[0], p, 'dislike', r).noop).toBe(true);
  });
});
