import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { independentlyPossibleIds, matches } from '../../../tools/eval/training-engine-quality';
import type { EngineProfile } from '../../../src/engine/contracts';
const r = new Rules(),
  source = r.get('postpartum.gate.caesarean'),
  id = source.candidate_fallback.exercise_id as string,
  primary = r.data.exercises.find(e => matches(source.candidate_fallback.primary_if, e, {}))!;
function profile(space: EngineProfile['constraints']['space'] = 'mat') {
  return baseProfile({
    population: { kind: 'postpartum', weeksSinceBirth: 2, delivery: 'cesarean', cleared: false },
    constraints: { noJump: false, quiet: false, space },
  });
}
it.each(['mat', 'small'] as const)(
  'independently admits only the approved fallback when original walking cannot fit %s',
  space => {
    const p = profile(space),
      before = structuredClone(p),
      pool = independentlyPossibleIds(p, r);
    expect(pool).toContain(id);
    expect(pool).not.toContain(primary.id);
    expect(p).toEqual(before);
  },
);
it('independently excludes fallback when the true large-space primary is available', () => {
  const p = profile('large'),
    pool = independentlyPossibleIds(p, r);
  expect(pool).toContain(primary.id);
  expect(pool).not.toContain(id);
});
it.each([
  { kind: 'general' },
  { kind: 'postpartum', weeksSinceBirth: 2, delivery: 'vaginal', cleared: false },
  { kind: 'postpartum', weeksSinceBirth: 20, delivery: 'cesarean', cleared: true },
] as EngineProfile['population'][])(
  'does not admit the source-scoped fallback for population $kind outside the actual gate',
  population => {
    const p = { ...profile(), population };
    expect(independentlyPossibleIds(p, r)).not.toContain(id);
  },
);
it('preserves existing independent exclusions and pain restrictions without mutating real profile facts', () => {
  const p = profile(),
    excluded = { ...p, preferences: { ...p.preferences, excludedExerciseIds: [id] } },
    pain = { ...p, painState: [{ pattern: 'cardio_cyclic' as const, remainingSessions: 1 }] };
  expect(independentlyPossibleIds(excluded, r)).not.toContain(id);
  expect(independentlyPossibleIds(pain, r)).not.toContain(id);
  expect(p.preferences.excludedExerciseIds).toEqual([]);
});
it('uses the authored primary selector and exact fallback id rather than names or literal business ids', () => {
  const data = structuredClone(r.data),
    rule = data.rules.find(rule => rule.id === 'postpartum.gate.caesarean')!;
  rule.value!.candidate_fallback.primary_if = { field: 'id', eq: id + '-missing' };
  expect(independentlyPossibleIds(profile('large'), new Rules(data))).toContain(id);
  const large = profile('large'),
    before = structuredClone(large);
  large.preferences.excludedExerciseIds = [primary.id];
  expect(independentlyPossibleIds(large, r)).toContain(id);
  expect(before.preferences.excludedExerciseIds).toEqual([]);
});
