import { legacySampledProfile } from './v1-inputs';
import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';

it('protects credited work after cooldown replay changes item indices', () => {
  const profile = legacySampledProfile(71),
    before = structuredClone(profile),
    plan = generatePlan(profile),
    issues = validatePlan(plan, profile);
  expect(issues.filter(issue => issue.code === 'weekly_volume_floor')).toEqual([]);
  expect(
    issues.filter(issue =>
      [
        'weekly_volume_cap',
        'session_volume_cap',
        'excluded_exercise',
        'intensity_cap',
        'isometric_hold_bounds',
      ].includes(issue.code),
    ),
  ).toEqual([]);
  expect(profile).toEqual(before);
});
