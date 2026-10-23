import { it, expect } from 'vitest';
import { Rules } from '../../src/engine/data';
import { safety } from '../../src/engine/gates/strength-scoring';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
it('screens actual pain areas without asserting symptoms at other caution areas', () => {
  const r = new Rules(),
    p = baseProfile({ cautions: ['back', 'knee'] }),
    keys = r.get('redflag.joint_any').items as string[];
  p.screening.redFlagReview = {
    requiredAt: '2026-10-15T01:00:00Z',
    answeredAt: '2026-10-15T02:00:00Z',
    areas: ['knee'],
    questionKeys: keys,
    answers: Object.fromEntries(keys.map(key => [key, false])),
  };
  // back is still unreviewed, so the caution activation gate pauses training until it is answered.
  expect(
    safety(p, r)
      .gates.filter(g => g.status === 'blocked')
      .map(g => g.ruleId),
  ).toEqual(['caution.activation']);
  p.screening.redFlagReview.areas = [];
  expect(
    safety(p, r)
      .gates.filter(g => g.status === 'blocked')
      .map(g => g.ruleId),
  ).toContain('redflag.screen');
});
