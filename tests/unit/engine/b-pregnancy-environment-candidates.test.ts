import { it, expect } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { runGates } from '../../../src/engine/gates';
import { isHardEligible } from '../../../src/engine/candidates';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
it('rejects only explicit source pregnancy environment slugs without inventing attribute filters', () => {
  const r = new Rules(),
    p = baseProfile({
      population: {
        kind: 'pregnant',
        week: 20,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 20,
      },
    }),
    g = runGates(p, r),
    e = r.data.exercises.find(e => isHardEligible(e, p, g, { rules: r }))!;
  expect(e).toBeDefined();
  for (const slug of r.get('pregnancy.environment').content_blacklist) {
    expect(
      isHardEligible({ ...e, slug: slug.replaceAll('_', '-') }, p, g, {
        rules: r,
      }),
      slug,
    ).toBe(false);
  }
  expect(isHardEligible({ ...e, slug: 'ordinary-yoga' }, p, g, { rules: r })).toBe(true);
  const adult = baseProfile(),
    ag = runGates(adult, r);
  expect(isHardEligible({ ...e, slug: 'hot-yoga' }, adult, ag, { rules: r })).toBe(true);
});
