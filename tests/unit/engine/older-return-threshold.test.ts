import { expect, it } from 'vitest';
import { nextTargets, validatePlan } from '../../../src/engine';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import type { EnginePlan } from '../../../src/engine/contracts';
import type { WorkoutRecord } from '../../../src/domain/v8/contracts';
const r = new Rules(),
  id = 'd16325d9-fc00-4c41-88a1-000000000001';
function fixture(older = true, gap = 4) {
  const p = baseProfile({
    level: 'intermediate',
    trainingAgeWeeks: 52,
    birthYearMonth: older ? '1956-01' : '1996-01',
    population: older ? { kind: 'older_adult', fallsAnswers: [false, false, false, false] } : { kind: 'general' },
    equipment: ['none', 'dumbbell'],
  });
  const plan: EnginePlan = {
    weeklyTarget: 1,
    sessionMinutes: 30,
    templates: [
      {
        id: 'return',
        name: 'return',
        estimatedMinutes: 30,
        items: [
          {
            exerciseId: id,
            equipment: 'dumbbell',
            sets: 3,
            target: { metricType: 'reps_load', reps: 8, loadGrams: 10000 },
            prescription: { pattern: 'squat', block: 'main', rir: [3, 4], restSeconds: 90, structure: 'straight' },
          },
        ],
      },
    ],
    meta: { engineVersion: '2.0.0', rulesVersion: r.data.rulesVersion, seed: 'return' },
    trace: [],
    notices: [],
    gates: [],
  };
  const date = new Date(p.asOfDate! + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - gap);
  const day = date.toISOString().slice(0, 10);
  const history: WorkoutRecord[] = [
    {
      id: 'actual-return',
      templateId: 'return',
      startedAt: day + 'T08:00:00Z',
      endedAt: day + 'T09:00:00Z',
      localDate: day,
      timeZone: 'UTC',
      status: 'complete',
      plannedSetCount: 3,
      sets: [0, 1, 2].map(setIndex => ({
        exerciseId: id,
        itemIndex: 0,
        setIndex,
        reps: 8,
        loadGrams: 10000,
        completedAt: day + 'T08:30:00Z',
      })),
    },
  ];
  return { p, plan, history };
}
it('older return dose starts at the actual source halved detraining threshold', () => {
  const f = fixture(),
    out = nextTargets(f.history, f.plan, f.p).value.templates[0].items[0];
  expect(out.sets).toBeLessThan(3);
  if (out.target.metricType !== 'reps_load') throw Error();
  expect(out.target.loadGrams).toBeLessThan(10000);
});
it('independent validation rejects unchanged prebreak older dose at the same threshold', () => {
  const f = fixture();
  expect(validatePlan(f.plan, f.p, { progression: { baseline: f.plan, history: f.history } })).toContainEqual(
    expect.objectContaining({ ruleId: 'progression.return.first_session_cap', severity: 'error' }),
  );
});
it('does not bring the general threshold earlier or trigger older return before its source boundary', () => {
  for (const f of [fixture(false, 4), fixture(true, 3)]) {
    expect(
      validatePlan(f.plan, f.p, { progression: { baseline: f.plan, history: f.history } }).some(
        issue => issue.ruleId === 'progression.return.first_session_cap',
      ),
    ).toBe(false);
  }
});
