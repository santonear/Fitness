import { describe, it, expect, vi } from 'vitest';
import type { EngineProfile, Plan, PlanChange } from '../../../src/engine/contracts';
import { Rules } from '../../../src/engine/data';
import { scorePlan, marginal } from '../../../src/engine/score';
import * as dosing from '../../../src/engine/dose';
import { fixtureProfile, planFixture } from './fixtures';
const rules = new Rules();
type Item = Plan['templates'][number]['items'][number];
function manualPlan(days = 3): Plan {
  const plan = planFixture(),
    seed = plan.templates[0].items[0],
    strength = rules.data.exercises.filter(e => e.modality === 'strength' && e.primaryMuscles?.length).slice(0, 6),
    dynamic = rules.data.exercises.find(e => e.mobility_type === 'dynamic')!,
    stretch = rules.data.exercises.find(e => e.mobility_type === 'static' && e.stretch_targets?.length)!,
    balance = rules.data.exercises.find(e => e.primary_pattern === 'balance')!;
  plan.templates = Array.from({ length: days }, (_, day) => ({
    ...structuredClone(plan.templates[0]),
    id: `cache-day-${day}`,
    items: [
      ...strength.map((e, index) => ({
        ...structuredClone(seed),
        exerciseId: e.id,
        sets: 2,
        target: { metricType: 'reps' as const, reps: 10 },
        prescription: {
          ...seed.prescription!,
          pattern: e.primary_pattern,
          block: index < 2 ? ('main' as const) : ('accessory' as const),
          rir: [2, 2] as [number, number],
          restSeconds: 90,
          setupSeconds: e.time.setup_s,
          secondsPerRep: e.time.s_per_rep,
        },
      })),
      {
        ...structuredClone(seed),
        target: { metricType: 'duration' as const, durationSeconds: 600 },
        prescription: {
          ...seed.prescription!,
          targetRpe: [5, 5] as [number, number],
        },
      },
      {
        ...structuredClone(seed),
        exerciseId: dynamic.id,
        target: { metricType: 'duration' as const, durationSeconds: 60 },
        prescription: {
          ...seed.prescription!,
          pattern: dynamic.primary_pattern,
          block: 'warmup' as const,
        },
      },
      {
        ...structuredClone(seed),
        exerciseId: stretch.id,
        target: { metricType: 'duration' as const, durationSeconds: 60 },
        prescription: {
          ...seed.prescription!,
          pattern: stretch.primary_pattern,
          block: 'cooldown' as const,
        },
      },
      {
        ...structuredClone(seed),
        exerciseId: balance.id,
        target: { metricType: 'duration' as const, durationSeconds: 90 },
        prescription: {
          ...seed.prescription!,
          pattern: balance.primary_pattern,
          block: 'balance' as const,
        },
      },
    ],
  }));
  plan.preferredDays = days === 2 ? ['mon', 'fri'] : ['mon', 'wed', 'fri'];
  return plan;
}
function fresh(plan: Plan, change: PlanChange, p: EngineProfile) {
  const after = structuredClone(plan),
    t = after.templates.find(t => t.id === change.templateId)!;
  if (change.kind === 'replace') t.items[change.itemIndex!] = structuredClone(change.item!);
  if (change.kind === 'add') t.items.push(structuredClone(change.item!));
  if (change.kind === 'move-set') {
    t.items[change.fromIndex!].sets--;
    t.items[change.toIndex!].sets++;
  }
  return scorePlan(after, p, rules).quality - scorePlan(plan, p, rules).quality;
}
const profiles: EngineProfile[] = [
  fixtureProfile,
  { ...fixtureProfile, goal: 'strength', level: 'intermediate' },
  { ...fixtureProfile, goal: 'mobility' },
  { ...fixtureProfile, population: { kind: 'older_adult' }, daysPerWeek: 2 },
  {
    ...fixtureProfile,
    population: {
      kind: 'pregnant',
      week: 20,
      providerCleared: true,
      prenatalCareConfirmed: true,
      contraindicationsConfirmedNone: true,
    },
  },
  {
    ...fixtureProfile,
    population: {
      kind: 'postpartum',
      weeksSinceBirth: 8,
      delivery: 'vaginal',
      cleared: true,
    },
  },
  { ...fixtureProfile, trainingAgeWeeks: 0, cautions: ['back'] },
];
const variants: [string, (item: Item) => void][] = [
  [
    'exercise identity',
    i => {
      i.exerciseId = rules.data.exercises.find(e => e.primary_pattern === 'hinge')!.id;
    },
  ],
  [
    'sets',
    i => {
      i.sets = 3;
    },
  ],
  [
    'repetitions',
    i => {
      i.target = { metricType: 'reps', reps: 5 };
    },
  ],
  [
    'absolute load',
    i => {
      i.target = { metricType: 'reps_load', reps: 12, loadGrams: 2500 };
    },
  ],
  [
    'timed target',
    i => {
      i.target = { metricType: 'duration', durationSeconds: 45 };
    },
  ],
  [
    'distance target',
    i => {
      i.target = {
        metricType: 'duration_distance',
        durationSeconds: 45,
        distanceMeters: 10,
      };
    },
  ],
  [
    'half effort credit',
    i => {
      i.prescription!.rir = [4, 4];
    },
  ],
  [
    'zero effort credit',
    i => {
      i.prescription!.rir = [5, 5];
    },
  ],
  [
    'rest',
    i => {
      i.prescription!.restSeconds = 150;
    },
  ],
  [
    'round rest',
    i => {
      i.prescription!.roundRestSeconds = 60;
    },
  ],
  [
    'RPE',
    i => {
      i.prescription!.targetRpe = [7, 7];
    },
  ],
  [
    'per-side time',
    i => {
      i.prescription!.perSide = true;
    },
  ],
  [
    'setup time',
    i => {
      i.prescription!.setupSeconds = 55;
    },
  ],
  [
    'repetition time',
    i => {
      i.prescription!.secondsPerRep = 8;
    },
  ],
  [
    'tempo',
    i => {
      i.prescription!.tempo = {
        eccentricSeconds: 3,
        concentricSeconds: 1,
        pauseSeconds: 2,
      };
    },
  ],
  [
    'source position',
    i => {
      i.prescription!.sourcePosition = 'main_1';
    },
  ],
  [
    'goal role',
    i => {
      i.prescription!.goalRole = 'accessory';
    },
  ],
  [
    'circuit structure',
    i => {
      i.prescription!.structure = 'circuit';
    },
  ],
  [
    'superset structure',
    i => {
      i.prescription!.structure = 'superset';
      i.prescription!.groupId = 'pair';
    },
  ],
  [
    'conditioning role',
    i => {
      i.prescription!.block = 'conditioning';
    },
  ],
  [
    'warmup role',
    i => {
      i.prescription!.block = 'warmup';
    },
  ],
  [
    'static cooldown',
    i => {
      i.exerciseId = rules.data.exercises.find(e => e.mobility_type === 'static' && e.stretch_targets?.length)!.id;
      i.target = { metricType: 'duration', durationSeconds: 60 };
      i.prescription!.block = 'cooldown';
    },
  ],
  [
    'balance role',
    i => {
      i.exerciseId = rules.data.exercises.find(e => e.primary_pattern === 'balance')!.id;
      i.target = { metricType: 'duration', durationSeconds: 90 };
      i.prescription!.block = 'balance';
    },
  ],
];
describe('D frozen-item contribution cache preserves complete candidate semantics', () => {
  for (const [profileIndex, profile] of profiles.entries())
    for (const [name, edit] of variants)
      it(`${profileIndex}: ${name}`, () => {
        const plan = Object.freeze(manualPlan(profile.daysPerWeek === 2 ? 2 : 3)),
          before = JSON.stringify(plan),
          replacement = structuredClone(plan.templates[0].items[0]);
        edit(replacement);
        const change: PlanChange = {
          kind: 'replace',
          templateId: plan.templates[0].id,
          itemIndex: 0,
          item: replacement,
        };
        expect(marginal(plan, change, profile, rules)).toBeCloseTo(fresh(plan, change, profile), 12);
        expect(JSON.stringify(plan)).toBe(before);
      });
  for (const profile of profiles)
    for (const kind of ['add', 'move-set'] as const)
      it(`${profile.population.kind}/${profile.goal}: ${kind}`, () => {
        const plan = Object.freeze(manualPlan(profile.daysPerWeek === 2 ? 2 : 3)),
          change: PlanChange =
            kind === 'add'
              ? {
                  kind,
                  templateId: plan.templates[0].id,
                  item: structuredClone(plan.templates[0].items[6]),
                }
              : {
                  kind,
                  templateId: plan.templates[0].id,
                  fromIndex: 0,
                  toIndex: 2,
                };
        expect(marginal(plan, change, profile, rules)).toBeCloseTo(fresh(plan, change, profile), 12);
      });
  it('mutable nested item and profile edits invalidate the public baseline', () => {
    const plan = manualPlan(),
      profile = structuredClone(fixtureProfile),
      replacement = structuredClone(plan.templates[0].items[0]),
      change: PlanChange = {
        kind: 'replace',
        templateId: plan.templates[0].id,
        itemIndex: 0,
        item: replacement,
      };
    marginal(plan, change, profile, rules);
    plan.templates[0].items[1].prescription!.rir = [5, 5];
    plan.templates[0].items[2].sets = 3;
    profile.goal = 'strength';
    expect(marginal(plan, change, profile, rules)).toBeCloseTo(fresh(plan, change, profile), 12);
  });
  it('recomputes all public mutable work-item credits while frozen batches recompute only the changed item', () => {
    const mutable = manualPlan(),
      frozen = Object.freeze({ ...mutable, templates: [...mutable.templates] }),
      replacement = structuredClone(mutable.templates[0].items[0]),
      change: PlanChange = {
        kind: 'replace',
        templateId: mutable.templates[0].id,
        itemIndex: 0,
        item: replacement,
      },
      spy = vi.spyOn(dosing, 'credit');
    replacement.sets = 3;
    try {
      marginal(mutable, change, fixtureProfile, rules);
      marginal(frozen, change, fixtureProfile, rules);
      spy.mockClear();
      marginal(frozen, change, fixtureProfile, rules);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockClear();
      marginal(mutable, change, fixtureProfile, rules);
      expect(spy).toHaveBeenCalledTimes(6);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
it('compares cached and uncached candidate outputs and exact credit work without historical artifacts', () => {
  const mutable = manualPlan(),
    frozen = Object.freeze({ ...mutable, templates: [...mutable.templates] }),
    profile = fixtureProfile,
    changes: PlanChange[] = variants.map(([, edit]) => {
      const item = structuredClone(mutable.templates[0].items[0]);
      edit(item);
      return {
        kind: 'replace',
        templateId: mutable.templates[0].id,
        itemIndex: 0,
        item,
      };
    });
  expect(scorePlan(frozen, profile, rules)).toEqual(scorePlan(mutable, profile, rules));
  marginal(frozen, changes[0], profile, rules);
  marginal(mutable, changes[0], profile, rules);
  const spy = vi.spyOn(dosing, 'credit');
  try {
    for (const change of changes) {
      spy.mockClear();
      const cached = marginal(frozen, change, profile, rules),
        isWork = ['main', 'accessory'].includes(change.item!.prescription?.block ?? '');
      expect(spy).toHaveBeenCalledTimes(isWork ? 1 : 0);
      spy.mockClear();
      const uncached = marginal(mutable, change, profile, rules);
      expect(spy).toHaveBeenCalledTimes(isWork ? 6 : 5);
      expect(cached).toBeCloseTo(uncached, 12);
      expect(cached).toBeCloseTo(fresh(mutable, change, profile), 12);
    }
    const run = (plan: Plan) => {
      let checksum = 0;
      for (let i = 0; i < 1000; i++) checksum += marginal(plan, changes[i % changes.length], profile, rules);
      return checksum;
    };
    expect(run(frozen)).toBeCloseTo(run(mutable), 10);
  } finally {
    vi.restoreAllMocks();
  }
});
