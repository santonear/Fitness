import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { generatePlan } from '../../../src/engine/pipeline';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { loadedPreference } from '../../../src/engine/candidates/loaded-preference';
import { substitute } from '../../../src/engine';
import { prescribe } from '../../../src/engine/dose';
import { runGates } from '../../../src/engine/gates';

const rules = new Rules();
const profile = baseProfile({
  goal: 'muscle',
  level: 'intermediate',
  trainingAgeWeeks: 104,
  daysPerWeek: 3,
  sessionMinutes: 30,
  equipment: ['none', 'dumbbell', 'flat-bench'],
  place: 'home',
});

it('reduces bodyweight strength sets for a dumbbell-and-bench muscle profile without changing target weights', () => {
  const without = structuredClone(rules.data);
  without.rules.find(row => row.id === 'select.rank')!.value!.loaded_preference.marginal_bonus = 0;
  const old = generatePlan(profile, { rules: new Rules(without) }),
    next = generatePlan(profile, { rules });
  const share = (plan: typeof next) => {
    const work = plan.templates
      .flatMap(t => t.items)
      .filter(item => ['main', 'accessory'].includes(item.prescription?.block ?? ''));
    const sets = work.reduce((sum, item) => sum + item.sets, 0);
    return (
      work
        .filter(item => loadedPreference(rules.byExercise.get(item.exerciseId)!, profile, rules) === 0)
        .reduce((sum, item) => sum + item.sets, 0) / sets
    );
  };
  expect(next.templates).toHaveLength(3);
  expect(share(next)).toBeLessThan(share(old));
});

it('keeps an upper push replacement in its original movement pattern', () => {
  const original = rules.data.exercises.find(
    e => e.primary_pattern === 'push_vertical' && loadedPreference(e, profile, rules) > 0 && e.difficulty <= 3,
  )!;
  expect(original).toBeDefined();
  const item = prescribe(original, profile, rules, runGates(profile, rules).restrictions, 'accessory', 2);
  const changed = substitute(item, profile, 'dislike');
  expect(changed.noop).toBe(false);
  const replacement = rules.byExercise.get(changed.value.exerciseId)!;
  expect(replacement.primary_pattern).toBe('push_vertical');
  expect(['strength', 'power', 'isometric']).toContain(replacement.modality);
});

it('prefers an actually owned resistance machine while a bodyweight support is not a load', () => {
  const machine = rules.data.exercises.find(
    e => e.equipment_required.includes('lat-pulldown-machine') && e.modality === 'strength',
  )!;
  const equipped: typeof profile = { ...profile, equipment: ['none', 'lat-pulldown-machine'] };
  expect(loadedPreference(machine, equipped, rules)).toBeGreaterThan(0);
  const bodyweight = rules.data.exercises.find(
    e => e.equipment_required.includes('pull-up-bar') && e.modality === 'strength',
  )!;
  expect(loadedPreference(bodyweight, { ...profile, equipment: ['none', 'pull-up-bar'] }, rules)).toBe(0);
});
