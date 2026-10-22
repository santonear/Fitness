import { expect, it } from 'vitest';
import { getEligibleExercises } from '../../../src/engine';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';

const rules = new Rules();
const fallback = rules.get('postpartum.gate.caesarean').candidate_fallback.exercise_id;
const walking = rules.data.exercises.find(exercise => exercise.slug === 'walking')!.id;

it.each(['mat', 'small', 'medium'] as const)(
  'public eligibility exposes only the approved walking fallback in %s space',
  space => {
    const profile = baseProfile({
      population: {
        kind: 'postpartum',
        weeksSinceBirth: 6,
        delivery: 'cesarean',
        cleared: false,
      },
      constraints: { space, quiet: false, noJump: true },
    });
    const ids = getEligibleExercises(profile).map(exercise => exercise.exerciseId);
    expect(ids).toContain(fallback);
    expect(ids).not.toContain(walking);
  },
);

it('public eligibility keeps original walking and hides the fallback when large space is available', () => {
  const profile = baseProfile({
    population: {
      kind: 'postpartum',
      weeksSinceBirth: 6,
      delivery: 'cesarean',
      cleared: false,
    },
    constraints: { space: 'large', quiet: false, noJump: true },
  });
  const ids = getEligibleExercises(profile).map(exercise => exercise.exerciseId);
  expect(ids).toContain(walking);
  expect(ids).not.toContain(fallback);
});

it('public eligibility does not advertise this fallback outside its approved population', () => {
  expect(getEligibleExercises(baseProfile()).map(exercise => exercise.exerciseId)).not.toContain(fallback);
});
