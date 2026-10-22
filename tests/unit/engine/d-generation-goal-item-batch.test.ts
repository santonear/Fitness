import { afterEach, expect, it, vi } from 'vitest';
import { beginDefaultScorerBatch, createGenerationScorer, scorePlan } from '../../../src/engine/score';
import * as dosing from '../../../src/engine/dose';
import * as protection from '../../../src/engine/gates/strength-scoring';
import { Rules } from '../../../src/engine/data';
import { fixtureProfile, planFixture } from './fixtures';
const rules = new Rules(),
  profile = { ...fixtureProfile, goal: 'strength' as const, level: 'intermediate' as const, trainingAgeWeeks: 52 };
function fixture() {
  const plan = planFixture(),
    base = plan.templates[0],
    patterns = ['squat', 'push_horizontal', 'hinge'];
  plan.templates = [0, 1, 2].map(day => ({
    ...structuredClone(base),
    id: `roles-${day}`,
    items: patterns.map((pattern, index) => {
      const e = rules.data.exercises.find(
        e => e.modality === 'strength' && e.metricType === 'reps' && e.primary_pattern === pattern,
      )!;
      return {
        exerciseId: e.id,
        equipment: e.equipment_required[0],
        sets: 2,
        target: { metricType: 'reps' as const, reps: index < 2 ? 6 : 10 },
        prescription: {
          pattern: e.primary_pattern,
          block: 'main' as const,
          sourcePosition: `main_${index + 1}`,
          goalRole: index < 2 ? ('main' as const) : ('accessory' as const),
          rir: [3, 3] as [number, number],
          restSeconds: 120,
          structure: 'straight' as const,
        },
      };
    }),
  }));
  return plan;
}

afterEach(() => vi.restoreAllMocks());
it('reuses only bound baseline item checks while recomputing actual role changes', () => {
  const plan = fixture();
  for (const t of plan.templates) for (const i of t.items) i.prescription!.sourcePosition = undefined;
  const scorer = createGenerationScorer(),
    end = beginDefaultScorerBatch(scorer, plan, profile, rules),
    spy = vi.spyOn(dosing, 'prescribedRepRange'),
    safetySpy = vi.spyOn(protection, 'safety');
  try {
    expect(scorer.score(plan, profile, rules)).toEqual(scorePlan(plan, profile, rules));
    spy.mockClear();
    safetySpy.mockClear();
    scorer.score(plan, profile, rules);
    expect(spy).not.toHaveBeenCalled();
    expect(safetySpy).not.toHaveBeenCalled();
    // Keep the item identity but put it first in a changed session: the actual role may change.
    const t = plan.templates[0],
      next = {
        ...plan,
        templates: [{ ...t, items: [t.items[2], t.items[0], t.items[1]] }, ...plan.templates.slice(1)],
      };
    expect(dosing.strengthRoles(t.items, profile, rules).get(t.items[2])).toBe('accessory');
    expect(dosing.strengthRoles(next.templates[0].items, profile, rules).get(t.items[2])).toBe('main');
    const expected = scorePlan(next, profile, rules);
    spy.mockClear();
    expect(scorer.score(next, profile, rules)).toEqual(expected);
    for (const sets of [1, 3]) {
      const item = { ...t.items[0], sets, target: { metricType: 'reps' as const, reps: 11 } },
        changed = { ...plan, templates: [{ ...t, items: [item, ...t.items.slice(1)] }, ...plan.templates.slice(1)] };
      expect(scorer.score(changed, profile, rules)).toEqual(scorePlan(changed, profile, rules));
    }
  } finally {
    end();
  }
  spy.mockClear();
  scorer.score(plan, profile, rules);
  expect(spy).toHaveBeenCalledTimes(9);
});
it('keeps goal source identity and goal names distinct and recomputes changed tempo', () => {
  const plan = fixture(),
    p = { ...profile, goal: 'mobility' as const },
    r = new Rules(structuredClone(rules.data)),
    scorer = createGenerationScorer(),
    end = beginDefaultScorerBatch(scorer, plan, p, r);
  try {
    const initial = scorer.score(plan, p, r);
    expect(initial).toEqual(scorePlan(plan, p, r));
    const source = r.get('goal.params.mobility'),
      row = r.data.rules.find(rule => rule.id === 'goal.params.mobility')!;
    row.value = { ...source, rir: [99, 99], eccentric_s: 3, concentric_s: 3, pause_s: 1, rep_duration_min_s: 7 };
    const replaced = scorer.score(plan, p, r);
    expect(replaced).toEqual(scorePlan(plan, p, r));
    expect(replaced).not.toEqual(initial);
    const t = plan.templates[0],
      item = structuredClone(t.items[0]);
    item.prescription!.tempo = { eccentricSeconds: 3, concentricSeconds: 3, pauseSeconds: 1 };
    item.prescription!.secondsPerRep = 7;
    const changed = { ...plan, templates: [{ ...t, items: [item, ...t.items.slice(1)] }, ...plan.templates.slice(1)] };
    const changedScore = scorer.score(changed, p, r);
    expect(changedScore).toEqual(scorePlan(changed, p, r));
    expect(changedScore).not.toEqual(replaced);
    const other = { ...p, goal: 'muscle' as const };
    expect(scorer.score(plan, other, r)).toEqual(scorePlan(plan, other, r));
  } finally {
    end();
  }
  plan.templates[0].items[0].sets = 5;
  expect(scorer.score(plan, p, r)).toEqual(scorePlan(plan, p, r));
});

it('rechecks changed muscle sets where zero RIR is allowed only for a single set', () => {
  const plan = fixture(),
    p = { ...profile, goal: 'muscle' as const },
    e = rules.data.exercises.find(
      e => e.modality === 'strength' && e.metricType === 'reps' && e.nsca_class === 'isolation',
    )!,
    item = plan.templates[0].items[0];
  item.exerciseId = e.id;
  item.sets = 1;
  item.prescription!.rir = [0, 0];
  const scorer = createGenerationScorer(),
    end = beginDefaultScorerBatch(scorer, plan, p, rules);
  try {
    const initial = scorer.score(plan, p, rules),
      t = plan.templates[0],
      changed = {
        ...plan,
        templates: [{ ...t, items: [{ ...item, sets: 2 }, ...t.items.slice(1)] }, ...plan.templates.slice(1)],
      };
    const actual = scorer.score(changed, p, rules);
    expect(actual).toEqual(scorePlan(changed, p, rules));
    expect(actual.perRule.find(r => r.id === 'goal.params.muscle')).not.toEqual(
      initial.perRule.find(r => r.id === 'goal.params.muscle'),
    );
  } finally {
    end();
  }
});
