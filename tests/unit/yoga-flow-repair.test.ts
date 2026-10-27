import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../src/engine';
import { checkHard } from '../../src/engine/hard-checks';
import { runGates } from '../../src/engine/gates';
import { Rules } from '../../src/engine/data';
import { repairYogaFlowTargets } from '../../src/persistence/yoga-flow-repair';
import { activeWorkoutSeconds, trainingMinutes } from '../../src/application/workout-duration';
import { baseProfile } from '../../tools/eval/training-engine-profiles';

const r = new Rules();
const flow = [...r.byExercise.values()].find(e => e.slug === 'downward-dog-to-plank')!;

describe('yoga flow repair (Bo 2026-10-27)', () => {
  // A yoga plan as saved before the fix: the flow held 60 s in a yoga position.
  const plan = generatePlan(baseProfile({ goal: 'yoga', daysPerWeek: 2, sessionMinutes: 45 }));
  const old = structuredClone(plan);
  old.templates[0].items.splice(1, 0, {
    exerciseId: flow.id,
    equipment: 'none',
    sets: 2,
    target: { metricType: 'duration', durationSeconds: 60 },
    prescription: {
      pattern: flow.primary_pattern,
      block: 'warmup',
      rir: [0, 0],
      restSeconds: 15,
      sourcePosition: 'yoga_sun',
    },
  } as never);
  const version = { id: 'v1', templates: old.templates, enginePlan: old };

  it('turns the timed flow into reps everywhere it is saved, once', () => {
    const [fixed] = repairYogaFlowTargets([version]);
    for (const templates of [fixed.templates, fixed.enginePlan.templates]) {
      const item = templates[0].items[1];
      expect(item.exerciseId).toBe(flow.id);
      expect(item.target.metricType).toBe('reps');
    }
    expect(repairYogaFlowTargets([fixed])).toEqual([]);
    expect(repairYogaFlowTargets([{ id: 'v2', templates: plan.templates }])).toEqual([]);
  });

  it('gives a rep target the hard check accepts at every level', () => {
    const [fixed] = repairYogaFlowTargets([version]);
    for (const level of ['beginner', 'intermediate'] as const) {
      const p = baseProfile({ goal: 'yoga', daysPerWeek: 2, sessionMinutes: 45, level, trainingAgeWeeks: 0 });
      const issues = checkHard(fixed.enginePlan, p, runGates(p, r), r).filter(
        issue => issue.severity === 'error' && issue.templateId === fixed.templates[0].id && issue.itemIndex === 1,
      );
      expect(issues).toEqual([]);
    }
  });
});

describe('active workout time (Bo 2026-10-27)', () => {
  const at = (minutes: number) => new Date(Date.parse('2026-10-27T08:00:00Z') + minutes * 60_000).toISOString();
  it('leaves out long idle gaps but keeps real holds and hand corrections', () => {
    const workout = {
      startedAt: at(0),
      sets: [
        { completedAt: at(2), durationSeconds: 30 },
        { completedAt: at(4), durationSeconds: 30 },
        // Left open for two hours before the next set.
        { completedAt: at(124), durationSeconds: 30 },
      ],
    };
    expect(trainingMinutes(activeWorkoutSeconds(workout, at(126)))).toBe(4 + 10 + 2);
    // A 30-minute run recorded as one set is training, not idle time.
    expect(
      trainingMinutes(
        activeWorkoutSeconds({ startedAt: at(0), sets: [{ completedAt: at(31), durationSeconds: 1800 }] }, at(32)),
      ),
    ).toBe(32);
    expect(
      activeWorkoutSeconds({ ...workout, timeCorrections: [{ startedAt: at(0), endedAt: at(60) }] }, at(126)),
    ).toBe(3600);
    expect(trainingMinutes(40)).toBe(0);
  });
});
