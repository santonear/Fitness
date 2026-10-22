import { expect, it } from 'vitest';
import { runGates } from '../../../src/engine/gates';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
const rules = new Rules();
it('never infers negative red flags when a caution is first selected', () => {
  const p = baseProfile({ cautions: ['knee'] });
  delete p.screening.redFlagReview;
  expect(runGates(p, rules).reasons).toContainEqual(
    expect.objectContaining({ ruleId: 'caution.activation', status: 'blocked' }),
  );
});
it('accepts explicitly answered current negative red flags without cancelling the caution', () => {
  const p = baseProfile({ cautions: ['knee'] });
  expect(p.screening.redFlagReview?.answers).toBeDefined();
  expect(runGates(p, rules).status).not.toBe('blocked');
  expect(p.cautions).toEqual(['knee']);
});
it('positive or unanswered source questions still block an activated caution', () => {
  for (const value of [true, undefined]) {
    const p = baseProfile({ cautions: ['knee'] }),
      review = p.screening.redFlagReview!;
    const key = review.questionKeys[0];
    if (value === undefined) delete review.answers![key];
    else review.answers![key] = value;
    expect(runGates(p, rules).status).toBe('blocked');
  }
});
