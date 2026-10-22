import { expect, it } from 'vitest';
import fixture from '../../fixtures/training-engine/cardio-duration-index827.json';
import { engineProfileSchema } from '../../../src/engine/contracts';
import { Rules } from '../../../src/engine/data';
import { generatePlan, validatePlan } from '../../../src/engine';
import { externalIssues } from '../../../tools/eval/training-engine-invariants';
import { independentlyPossibleIds } from '../../../tools/eval/training-engine-quality';
it('keeps missing postpartum return-to-running readiness locked when proving index827 safe capacity', () => {
  const p = engineProfileSchema.parse(fixture.profile),
    r = new Rules(),
    possible = new Set(independentlyPossibleIds(p, r));
  for (const slug of ['heel-flicks', 'high-knees']) {
    const e = r.data.exercises.find(e => e.slug === slug)!;
    expect(possible.has(e.id), slug).toBe(false);
  }
  const plan = generatePlan(p);
  expect(plan.templates.length).toBeGreaterThan(0);
  expect(validatePlan(plan, p).filter(issue => issue.severity === 'error')).toEqual([]);
  expect(externalIssues(plan, p)).toEqual([]);
});
it('allows the same source return-to-running actions into the independent possible pool only after explicit readiness', () => {
  const p = engineProfileSchema.parse(fixture.profile),
    r = new Rules();
  if (p.population.kind !== 'postpartum') throw Error('Expected postpartum source fixture');
  const ids = ['heel-flicks', 'high-knees'].map(slug => r.data.exercises.find(e => e.slug === slug)!.id);
  p.population.readinessChecklistPassed = true;
  for (const id of ids) expect(independentlyPossibleIds(p, r)).toContain(id);
  p.population.readinessChecklistPassed = false;
  for (const id of ids) expect(independentlyPossibleIds(p, r)).not.toContain(id);
});
