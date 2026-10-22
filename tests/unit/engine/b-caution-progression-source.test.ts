import { it, expect } from 'vitest';
import { nextTargets, validatePlan } from '../../../src/engine';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import type { EnginePlan } from '../../../src/engine/contracts';
import type { WorkoutRecord } from '../../../src/domain/v8/contracts';
const r = new Rules(),
  e = r.data.exercises.find(e => e.slug === 'bodyweight-squat')!,
  loaded = r.data.exercises.find(e => e.id === 'd16325d9-fc00-4c41-88a1-000000000001')!;
function fixture(reps = 15) {
  const p = baseProfile({
      level: 'intermediate',
      trainingAgeWeeks: 52,
      cautions: ['knee'],
      equipment: ['none', 'dumbbell'],
      availableLoadsKg: { [loaded.id]: [10, 10.5, 11] },
    }),
    plan: EnginePlan = {
      weeklyTarget: 1,
      sessionMinutes: 30,
      templates: [
        {
          id: 'caution',
          name: 'caution',
          estimatedMinutes: 30,
          items: [
            {
              exerciseId: loaded.id,
              equipment: 'dumbbell',
              sets: 2,
              target: { metricType: 'reps_load', reps, loadGrams: 10000 },
              prescription: {
                pattern: loaded.primary_pattern,
                block: 'main',
                rir: [3, 4],
                restSeconds: 90,
                structure: 'straight',
              },
            },
          ],
        },
      ],
      meta: { engineVersion: '2.0.0', rulesVersion: r.data.rulesVersion, seed: 'caution' },
      trace: [],
      notices: [],
      gates: [],
    };
  const history: WorkoutRecord[] = ['2026-10-12', '2026-10-14'].map(day => ({
    id: day,
    templateId: 'caution',
    startedAt: day + 'T08:00:00Z',
    endedAt: day + 'T09:00:00Z',
    localDate: day,
    timeZone: 'UTC',
    status: 'complete',
    plannedSetCount: 2,
    sets: [0, 1].map(setIndex => ({
      exerciseId: loaded.id,
      itemIndex: 0,
      setIndex,
      reps,
      loadGrams: 10000,
      completedAt: day + 'T08:20:00Z',
    })),
    setFeedbackEvents: [0, 1].map(setIndex => ({
      id: day + setIndex,
      exerciseId: loaded.id,
      itemIndex: 0,
      setIndex,
      effort: setIndex === 1 ? ('too_light' as const) : ('right' as const),
      rir: 4,
      painArea: 'knee' as const,
      painScore: 2,
      createdAt: day + 'T08:21:00Z',
    })),
  }));
  return { p, plan, history };
}
function load(f: ReturnType<typeof fixture>) {
  const item = nextTargets(f.history, f.plan, f.p).value.templates[0].items[0];
  if (item.target.metricType !== 'reps_load') throw Error();
  return item.target.loadGrams;
}
it('two complete explicit low-pain sessions at rep maximum permit load progression', () => {
  expect(load(fixture())).toBeGreaterThan(10000);
});
it('low report cannot mask another high or unknown report for an actually completed joint-loaded set', () => {
  for (const score of [4, undefined]) {
    const f = fixture();
    f.history[0].setFeedbackEvents!.push({ ...f.history[0].setFeedbackEvents![0], id: 'extra', painScore: score });
    expect(load(f)).toBe(10000);
  }
});
it('every actually completed set needs an explicit score in both sessions', () => {
  const f = fixture();
  f.history[0].setFeedbackEvents!.pop();
  expect(load(f)).toBe(10000);
});
it('a different joint-loaded workout between two low same-exercise sessions is not skipped', () => {
  const f = fixture(),
    middle: WorkoutRecord = {
      ...structuredClone(f.history[0]),
      id: 'middle',
      localDate: '2026-10-13',
      startedAt: '2026-10-13T08:00:00Z',
      endedAt: '2026-10-13T09:00:00Z',
      sets: [{ exerciseId: e.id, itemIndex: 0, setIndex: 0, reps: 8, completedAt: '2026-10-13T08:30:00Z' }],
      setFeedbackEvents: [],
    };
  f.history.push(middle);
  expect(load(f)).toBe(10000);
});
it('source progression order increases volume before load until completed rep maximum', () => {
  expect(load(fixture(8))).toBe(10000);
  const f = fixture(8),
    item = nextTargets(f.history, f.plan, f.p).value.templates[0].items[0];
  if (item.target.metricType !== 'reps_load') throw Error();
  expect(item.target.reps).toBe(9);
});

it('partial or incomplete prior sessions do not establish the two complete low-pain sessions', () => {
  for (const mode of ['partial', 'missing']) {
    const f = fixture();
    if (mode === 'partial') f.history[0].status = 'partial';
    else f.history[0].sets.pop();
    expect(load(f)).toBe(10000);
  }
});

it('independent validation uses the current source gate id for forged load increases', () => {
  const f = fixture(8),
    bad = structuredClone(f.plan);
  bad.templates[0].items[0].target = { metricType: 'reps_load', reps: 8, loadGrams: 11000 };
  const issues = validatePlan(bad, f.p, { progression: { baseline: f.plan, history: f.history } });
  expect(issues.some(i => i.ruleId === 'caution.progression_gate')).toBe(true);
  expect(issues.some(i => i.ruleId === 'caution.progression')).toBe(false);
});
