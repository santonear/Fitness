import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { runGates } from '../../../src/engine/gates';
import { checkHard } from '../../../src/engine/hard-checks';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { boundedCardioPlanFixture as planFixture } from './bounded-cardio-fixture';
const rules = new Rules();
function inspect(days: 2 | 3) {
  const profile = baseProfile({
    level: 'beginner',
    trainingAgeWeeks: 1,
    sessionMinutes: 10,
    daysPerWeek: days,
    preferredDays: days === 2 ? ['mon', 'wed'] : ['mon', 'wed', 'fri'],
    constraints: { noJump: false, quiet: false, space: 'large' },
  });
  const plan = planFixture(),
    squat = rules.data.exercises.find(e => e.slug === 'bodyweight-squat')!;
  const template = plan.templates[0];
  template.items.unshift({
    exerciseId: squat.id,
    equipment: 'none',
    sets: 2,
    target: { metricType: 'reps', reps: 12 },
    prescription: {
      pattern: squat.primary_pattern,
      block: 'main',
      rir: [3, 3],
      restSeconds: 60,
      secondsPerRep: 3,
      structure: 'straight',
    },
  });
  plan.weeklyTarget = days;
  plan.templates = Array.from({ length: days }, (_, index) => ({
    ...structuredClone(template),
    id: `manual-${index}`,
  }));
  return checkHard(plan, profile, runGates(profile, rules), rules);
}
it('allows the source second-week two-session path', () => {
  expect(inspect(2)).toEqual([]);
});
it('rejects a third second-week resistance session while its evidence path is deferred', () => {
  expect(rules.get('progression.new.week_caps')).toMatchObject({ week_2: { three_sessions_path: { deferred: true } } });
  expect(inspect(3)).toContainEqual(
    expect.objectContaining({ ruleId: 'progression.new.week_caps', severity: 'error' }),
  );
});
