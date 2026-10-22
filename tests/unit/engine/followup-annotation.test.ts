import { describe, expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { runGates } from '../../../src/engine/gates';
import { isHardEligible } from '../../../src/engine/candidates';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';

const rules = new Rules();
describe('followup annotation corrections use existing safety filters', () => {
  it('excludes every downward-dog phase from pregnancy as inverted', () => {
    const profile = baseProfile({
      population: {
        kind: 'pregnant',
        week: 20,
        prenatalCareConfirmed: true,
        providerCleared: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 20,
      },
    });
    const gate = runGates(profile, rules);
    const exercises = rules.data.exercises.filter(row => row.slug.startsWith('downward-dog'));
    expect(exercises).toHaveLength(7);
    for (const exercise of exercises) {
      expect(exercise.position, exercise.slug).toContain('inverted');
      expect(isHardEligible(exercise, profile, gate, { rules }), exercise.slug).toBe(false);
    }
  });
  it.each(['pigeon-stretch', 'hero-pose'])('excludes %s for knee caution using its actual deep knee flexion', slug => {
    const profile = baseProfile({ cautions: ['knee'], cautionLevels: { knee: 1 } });
    const exercise = rules.data.exercises.find(row => row.slug === slug)!;
    expect(exercise.flags).toContain('deep_knee_flexion');
    expect(isHardEligible(exercise, profile, runGates(profile, rules), { rules })).toBe(false);
  });
});
