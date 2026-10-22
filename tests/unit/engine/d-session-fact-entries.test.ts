import { expect, it } from 'vitest';
import { beginDefaultScorerBatch, createGenerationScorer, scorePlan } from '../../../src/engine/score';
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

it.each(['health', 'muscle', 'strength', 'mobility'] as const)(
  'retains exact fresh scores and deltas with ordered multi-session fact entries for %s',
  goal => {
    const plan = Object.freeze(fixture()),
      p = { ...profile, goal },
      scorer = createGenerationScorer(),
      end = beginDefaultScorerBatch(scorer, plan, p, rules),
      baseline = JSON.stringify(plan);
    try {
      expect(scorer.score(plan, p, rules)).toEqual(scorePlan(plan, p, rules));
      for (let session = 0; session < plan.templates.length; session++)
        for (const sets of [1, 3, 7]) {
          const t = plan.templates[session],
            item = structuredClone(t.items[0]);
          item.sets = sets;
          item.prescription!.rir = [4, 4];
          const after = {
              ...plan,
              templates: plan.templates.map((old, n) =>
                n === session ? { ...old, items: [item, ...old.items.slice(1)] } : old,
              ),
            },
            change = { kind: 'replace' as const, templateId: t.id, itemIndex: 0, item };
          expect(scorer.marginal(plan, change, p, rules)).toBe(
            scorePlan(after, p, rules).quality - scorePlan(plan, p, rules).quality,
          );
        }
      expect(JSON.stringify(plan)).toBe(baseline);
    } finally {
      end();
    }
  },
);
it('rebuilds entry values for public mutable sessions and for a later owned round', () => {
  const plan = fixture(),
    p = { ...profile },
    scorer = createGenerationScorer();
  for (const sets of [1, 4, 2]) {
    plan.templates[1].items[0].sets = sets;
    const end = beginDefaultScorerBatch(scorer, plan, p, rules);
    try {
      expect(scorer.score(plan, p, rules)).toEqual(scorePlan(plan, p, rules));
    } finally {
      end();
    }
    plan.templates[0].items[1].prescription!.rir = [sets === 4 ? 5 : 2, 2];
    expect(scorer.score(plan, p, rules)).toEqual(scorePlan(plan, p, rules));
  }
});
